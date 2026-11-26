-- 008 · Red social: publicaciones privadas, pestaña "@usuario" y paginación estable
--
-- · social_posts.visibility: 'public' (por defecto) o 'private'. Una publicación privada
--   solo la ve su autor (RLS), y no aparece en "Para ti", "Siguiendo", lugares ni sugerencias.
-- · social_feed gana:
--     - p_scope = 'mine': solo lo que he subido yo (público y privado). Usa auth.uid(),
--       así que nadie puede pedir la pestaña de otra persona.
--     - p_visibility: filtra 'public' / 'private' (null = todas).
--     - p_before_id: cursor compuesto (created_at, id) para que el scroll infinito no
--       salte ni repita posts publicados en el mismo instante.
--     - devuelve 'visibility' en cada post.
-- Requiere 006_social.sql. Se puede ejecutar varias veces.

alter table public.social_posts
  add column if not exists visibility text not null default 'public';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'social_posts_visibility_check') then
    alter table public.social_posts
      add constraint social_posts_visibility_check check (visibility in ('public', 'private'));
  end if;
end $$;

-- Índices para el cursor (created_at, id) en el feed general y en el de cada autor.
create index if not exists social_posts_created_id_idx on public.social_posts (created_at desc, id desc);
create index if not exists social_posts_author_created_id_idx on public.social_posts (author_id, created_at desc, id desc);

-- Un post se ve si es mío, o si es público y su autor es visible (profiles oculta las cuentas privadas).
drop policy if exists "Posts visibles" on public.social_posts;
create policy "Posts visibles" on public.social_posts for select to authenticated
  using (
    author_id = auth.uid()
    or (visibility = 'public' and exists (select 1 from public.profiles pr where pr.id = author_id))
  );

-- La firma cambia (nuevos parámetros): se borra la anterior para no dejar sobrecargas ambiguas en PostgREST.
drop function if exists public.social_feed(text, uuid, uuid, uuid, timestamptz, integer);

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
        select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'url', m.url, 'width', m.width, 'height', m.height, 'duration', m.duration_seconds) order by m.position), '[]'::jsonb)
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
      -- Cursor compuesto: estrictamente "después" del último post recibido.
      and (
        p_before is null
        or p.created_at < p_before
        or (p_before_id is not null and p.created_at = p_before and p.id < p_before_id)
      )
      -- Lo privado (solo mío por RLS) aparece en mi pestaña, en mi perfil o al abrirlo por enlace;
      -- nunca mezclado en los feeds generales ni en las fichas de lugar.
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

-- Contadores públicos: ni el lugar ni las sugerencias deben delatar posts privados.
create or replace function public.social_places_overview()
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pl.id, 'slug', pl.slug, 'name', pl.name, 'country', pl.country, 'kind', pl.kind,
    'lat', pl.latitude, 'lng', pl.longitude, 'cover_url', pl.cover_url,
    'post_count', (select count(*) from public.social_posts p where p.place_id = pl.id and p.visibility = 'public'),
    'follower_count', (select count(*) from public.social_place_follows f where f.place_id = pl.id),
    'following', exists (select 1 from public.social_place_follows f where f.place_id = pl.id and f.user_id = auth.uid()),
    'latest_at', (select max(p.created_at) from public.social_posts p where p.place_id = pl.id and p.visibility = 'public'),
    'my_scrapbook_ids', (
      select coalesce(jsonb_agg(s.id), '[]'::jsonb) from public.scrapbooks s
      where s.place_id = pl.id
        and (s.owner_id = auth.uid() or exists (select 1 from public.scrapbook_members m where m.scrapbook_id = s.id and m.user_id = auth.uid()))
    )
  ) order by pl.name), '[]'::jsonb)
  from public.social_places pl;
$$;

create or replace function public.social_suggestions(p_limit integer default 6)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select coalesce(jsonb_agg(s.item order by s.posts desc), '[]'::jsonb)
  from (
    select c.posts, jsonb_build_object(
      'id', a.id, 'username', a.username, 'display_name', a.display_name, 'avatar_url', a.avatar_url, 'post_count', c.posts,
      'preview_url', (select m.url from public.social_posts p join public.social_post_media m on m.post_id = p.id
                      where p.author_id = a.id and p.visibility = 'public' and m.kind = 'photo' order by p.created_at desc, m.position limit 1)
    ) as item
    from public.profiles a
    cross join lateral (select count(*) as posts from public.social_posts p where p.author_id = a.id and p.visibility = 'public') c
    where a.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
      and c.posts > 0
      and not exists (select 1 from public.social_follows f where f.follower_id = auth.uid() and f.followee_id = a.id)
    order by c.posts desc
    limit least(greatest(coalesce(p_limit, 6), 1), 20)
  ) s;
$$;

revoke execute on function public.social_places_overview() from anon;
revoke execute on function public.social_suggestions(integer) from anon;
