-- 009 · Red social: fotos y vídeos de publicaciones privadas en un bucket privado
--
-- · Bucket nuevo `social-private` (no público): cada usuario solo lee/escribe su carpeta
--   <user_id>/... y los archivos se sirven con URLs firmadas que caducan.
-- · social_post_media.bucket indica dónde vive cada archivo. Los privados no guardan URL
--   pública (url = null): el feed devuelve su ruta y la app la firma al pintar.
-- · social_set_visibility(): cambia la privacidad del post y actualiza sus medios en una sola
--   transacción, después de que la app haya movido los archivos de bucket.
-- Requiere 006 y 008. Se puede ejecutar varias veces.

-- ── Columna bucket y url opcional ────────────────────────────────────────────
alter table public.social_post_media add column if not exists bucket text not null default 'social-media';
alter table public.social_post_media alter column url drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'social_post_media_bucket_check') then
    alter table public.social_post_media
      add constraint social_post_media_bucket_check check (bucket in ('social-media', 'social-private'));
  end if;
  -- Un archivo público tiene URL; uno privado nunca la guarda (se firma al vuelo).
  if not exists (select 1 from pg_constraint where conname = 'social_post_media_url_check') then
    alter table public.social_post_media
      add constraint social_post_media_url_check check (
        (bucket = 'social-private' and url is null and storage_path is not null)
        or (bucket = 'social-media' and url is not null)
      );
  end if;
end $$;

-- El autor puede actualizar los medios de sus posts (al cambiar la privacidad).
drop policy if exists "Editar media de mis posts" on public.social_post_media;
create policy "Editar media de mis posts" on public.social_post_media for update to authenticated
  using (exists (select 1 from public.social_posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.social_posts p where p.id = post_id and p.author_id = auth.uid()));

-- ── Bucket privado ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-private', 'social-private', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Social privado: ver lo mío" on storage.objects;
create policy "Social privado: ver lo mío" on storage.objects for select to authenticated
  using (bucket_id = 'social-private' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Social privado: subir a mi carpeta" on storage.objects;
create policy "Social privado: subir a mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'social-private' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Social privado: mover lo mío" on storage.objects;
create policy "Social privado: mover lo mío" on storage.objects for update to authenticated
  using (bucket_id = 'social-private' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('social-private', 'social-media') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Social privado: borrar lo mío" on storage.objects;
create policy "Social privado: borrar lo mío" on storage.objects for delete to authenticated
  using (bucket_id = 'social-private' and (storage.foldername(name))[1] = auth.uid()::text);

-- Para mover archivos entre buckets, Storage necesita poder leer y actualizar el origen
-- también en el bucket público (solo la carpeta propia).
drop policy if exists "Social: ver lo mío" on storage.objects;
create policy "Social: ver lo mío" on storage.objects for select to authenticated
  using (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Social: mover lo mío" on storage.objects;
create policy "Social: mover lo mío" on storage.objects for update to authenticated
  using (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('social-private', 'social-media') and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Cambiar privacidad (post + medios a la vez) ──────────────────────────────
create or replace function public.social_set_visibility(p_post uuid, p_visibility text, p_public_base text)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if p_visibility not in ('public', 'private') then
    raise exception 'Visibilidad no válida' using errcode = '22023';
  end if;
  if p_visibility = 'public' and (p_public_base is null or p_public_base !~ '^https://[^/]+/storage/v1/object/public/social-media/?$') then
    raise exception 'URL pública no válida' using errcode = '22023';
  end if;

  update public.social_posts set visibility = p_visibility where id = p_post and author_id = auth.uid();
  if not found then
    raise exception 'Publicación no encontrada' using errcode = 'P0002';
  end if;

  -- Las muestras servidas desde /public (sin storage_path) no se tocan.
  update public.social_post_media
  set bucket = case when p_visibility = 'private' then 'social-private' else 'social-media' end,
      url = case when p_visibility = 'private' then null else rtrim(p_public_base, '/') || '/' || storage_path end
  where post_id = p_post and storage_path is not null;
end;
$$;

revoke execute on function public.social_set_visibility(uuid, text, text) from anon;

-- ── Feed: devuelve el bucket y, solo para lo privado, la ruta a firmar ────────
create or replace function public.social_feed(
  p_scope text default 'all',
  p_place uuid default null,
  p_author uuid default null,
  p_post uuid default null,
  p_before timestamptz default null,
  p_limit integer default 10,
  p_before_id uuid default null,
  p_visibility text default null
) returns jsonb
language sql stable security invoker set search_path = public
as $$
  select coalesce(jsonb_agg(s.item order by s.created_at desc, s.id desc), '[]'::jsonb)
  from (
    select p.created_at, p.id, jsonb_build_object(
      'id', p.id,
      'caption', p.caption,
      'created_at', p.created_at,
      'visibility', p.visibility,
      'author', jsonb_build_object('id', a.id, 'username', a.username, 'display_name', a.display_name, 'avatar_url', a.avatar_url),
      'place', case when pl.id is null then null else jsonb_build_object('id', pl.id, 'slug', pl.slug, 'name', pl.name, 'country', pl.country) end,
      'media', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', m.id, 'kind', m.kind, 'url', m.url, 'width', m.width, 'height', m.height, 'duration', m.duration_seconds,
          'bucket', m.bucket,
          'path', case when m.bucket = 'social-private' then m.storage_path end
        ) order by m.position), '[]'::jsonb)
        from public.social_post_media m where m.post_id = p.id
      ),
      'like_count', (select count(*) from public.social_likes l where l.post_id = p.id),
      'comment_count', (select count(*) from public.social_comments c where c.post_id = p.id),
      'liked', exists (select 1 from public.social_likes l where l.post_id = p.id and l.user_id = auth.uid()),
      'saved', exists (select 1 from public.social_saves sv where sv.post_id = p.id and sv.user_id = auth.uid()),
      'following_author', exists (select 1 from public.social_follows f where f.follower_id = auth.uid() and f.followee_id = p.author_id),
      'preview_comments', (
        select coalesce(jsonb_agg(z.item order by z.created_at), '[]'::jsonb)
        from (
          select c.created_at, jsonb_build_object('id', c.id, 'body', c.body, 'created_at', c.created_at,
            'author', jsonb_build_object('id', ca.id, 'username', ca.username, 'display_name', ca.display_name, 'avatar_url', ca.avatar_url)) as item
          from public.social_comments c join public.profiles ca on ca.id = c.author_id
          where c.post_id = p.id order by c.created_at desc limit 2
        ) z
      )
    ) as item
    from public.social_posts p
    join public.profiles a on a.id = p.author_id
    left join public.social_places pl on pl.id = p.place_id
    where (p_post is null or p.id = p_post)
      and (p_place is null or p.place_id = p_place)
      and (p_author is null or p.author_id = p_author)
      and (p_visibility is null or p.visibility = p_visibility)
      and (
        p_before is null
        or p.created_at < p_before
        or (p_before_id is not null and p.created_at = p_before and p.id < p_before_id)
      )
      and (
        p.visibility = 'public'
        or p_scope = 'mine'
        or p_post is not null
        or p_author = auth.uid()
      )
      and (
        p_scope = 'all'
        or (p_scope = 'mine' and p.author_id = auth.uid())
        or (p_scope = 'following' and (
          p.author_id = auth.uid()
          or exists (select 1 from public.social_follows f where f.follower_id = auth.uid() and f.followee_id = p.author_id)
          or exists (select 1 from public.social_place_follows pf where pf.user_id = auth.uid() and pf.place_id = p.place_id)
        ))
        or (p_scope = 'saved' and exists (select 1 from public.social_saves sv where sv.post_id = p.id and sv.user_id = auth.uid()))
      )
    order by p.created_at desc, p.id desc
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
  ) s;
$$;

revoke execute on function public.social_feed(text, uuid, uuid, uuid, timestamptz, integer, uuid, text) from anon;
