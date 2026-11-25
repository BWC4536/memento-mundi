-- 006 · Red social de Explorar (beta)
--
-- Lugares (ciudad / país / región) con su portada, publicaciones con varias fotos o vídeos,
-- likes, guardados, comentarios, seguir a personas y seguir a lugares.
--
-- · Los vídeos solo existen aquí (red social y mapa); los scrapbooks siguen siendo solo de fotos.
-- · Los archivos van al bucket público `social-media`, cada usuario en su carpeta (<user_id>/...).
-- · Las cuentas privadas (profiles.is_private) no aparecen en la red social: la política de
--   lectura de posts se apoya en la RLS de profiles. Seguimiento con solicitud = fase 2.
-- · Las tablas antiguas `cities`, `places`, `posts` y `trip_participants` no se usan.

-- ── Lugares ──────────────────────────────────────────────────────────────────
create table if not exists public.social_places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 1 and 80),
  country text not null check (char_length(country) between 1 and 80),
  kind text not null default 'city' check (kind in ('city', 'country', 'region', 'spot')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- Portada del lugar (no la de ningún scrapbook). Ruta de /public o URL absoluta.
  cover_url text,
  created_at timestamptz not null default now()
);

alter table public.scrapbooks add column if not exists place_id uuid references public.social_places(id) on delete set null;
create index if not exists scrapbooks_place_idx on public.scrapbooks (place_id);

-- ── Publicaciones ────────────────────────────────────────────────────────────
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid references public.social_places(id) on delete set null,
  caption text check (caption is null or char_length(caption) <= 2200),
  created_at timestamptz not null default now()
);
create index if not exists social_posts_created_idx on public.social_posts (created_at desc);
create index if not exists social_posts_place_idx on public.social_posts (place_id, created_at desc);
create index if not exists social_posts_author_idx on public.social_posts (author_id, created_at desc);

create table if not exists public.social_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  url text not null,
  -- Ruta en el bucket social-media (null para las muestras servidas desde /public).
  storage_path text,
  width integer,
  height integer,
  duration_seconds numeric,
  position smallint not null default 0
);
create index if not exists social_post_media_post_idx on public.social_post_media (post_id, position);

create table if not exists public.social_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists social_likes_user_idx on public.social_likes (user_id);

create table if not exists public.social_saves (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists social_saves_user_idx on public.social_saves (user_id, created_at desc);

create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists social_comments_post_idx on public.social_comments (post_id, created_at);

create table if not exists public.social_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists social_follows_followee_idx on public.social_follows (followee_id);

create table if not exists public.social_place_follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid not null references public.social_places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
create index if not exists social_place_follows_place_idx on public.social_place_follows (place_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.social_places enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_post_media enable row level security;
alter table public.social_likes enable row level security;
alter table public.social_saves enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_follows enable row level security;
alter table public.social_place_follows enable row level security;

drop policy if exists "Lugares visibles" on public.social_places;
create policy "Lugares visibles" on public.social_places for select using (true);

-- Un post se ve si es mío o si su autor es visible (profiles ya oculta las cuentas privadas).
drop policy if exists "Posts visibles" on public.social_posts;
create policy "Posts visibles" on public.social_posts for select to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.profiles pr where pr.id = author_id));
drop policy if exists "Publicar como yo" on public.social_posts;
create policy "Publicar como yo" on public.social_posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "Editar mis posts" on public.social_posts;
create policy "Editar mis posts" on public.social_posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "Borrar mis posts" on public.social_posts;
create policy "Borrar mis posts" on public.social_posts for delete to authenticated using (author_id = auth.uid());

drop policy if exists "Media de posts visibles" on public.social_post_media;
create policy "Media de posts visibles" on public.social_post_media for select to authenticated
  using (exists (select 1 from public.social_posts p where p.id = post_id));
drop policy if exists "Media en mis posts" on public.social_post_media;
create policy "Media en mis posts" on public.social_post_media for insert to authenticated
  with check (exists (select 1 from public.social_posts p where p.id = post_id and p.author_id = auth.uid()));
drop policy if exists "Borrar media de mis posts" on public.social_post_media;
create policy "Borrar media de mis posts" on public.social_post_media for delete to authenticated
  using (exists (select 1 from public.social_posts p where p.id = post_id and p.author_id = auth.uid()));

drop policy if exists "Likes visibles" on public.social_likes;
create policy "Likes visibles" on public.social_likes for select to authenticated using (true);
drop policy if exists "Dar like" on public.social_likes;
create policy "Dar like" on public.social_likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.social_posts p where p.id = post_id));
drop policy if exists "Quitar like" on public.social_likes;
create policy "Quitar like" on public.social_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Mis guardados" on public.social_saves;
create policy "Mis guardados" on public.social_saves for select to authenticated using (user_id = auth.uid());
drop policy if exists "Guardar" on public.social_saves;
create policy "Guardar" on public.social_saves for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.social_posts p where p.id = post_id));
drop policy if exists "Quitar guardado" on public.social_saves;
create policy "Quitar guardado" on public.social_saves for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Comentarios de posts visibles" on public.social_comments;
create policy "Comentarios de posts visibles" on public.social_comments for select to authenticated
  using (exists (select 1 from public.social_posts p where p.id = post_id));
drop policy if exists "Comentar como yo" on public.social_comments;
create policy "Comentar como yo" on public.social_comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.social_posts p where p.id = post_id));
-- Borra el autor del comentario o el autor del post (moderar su propio post).
drop policy if exists "Borrar comentarios" on public.social_comments;
create policy "Borrar comentarios" on public.social_comments for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.social_posts p where p.id = post_id and p.author_id = auth.uid()));

drop policy if exists "Seguimientos visibles" on public.social_follows;
create policy "Seguimientos visibles" on public.social_follows for select to authenticated using (true);
drop policy if exists "Seguir" on public.social_follows;
create policy "Seguir" on public.social_follows for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists "Dejar de seguir" on public.social_follows;
create policy "Dejar de seguir" on public.social_follows for delete to authenticated using (follower_id = auth.uid());

drop policy if exists "Seguimientos de lugares visibles" on public.social_place_follows;
create policy "Seguimientos de lugares visibles" on public.social_place_follows for select to authenticated using (true);
drop policy if exists "Seguir lugar" on public.social_place_follows;
create policy "Seguir lugar" on public.social_place_follows for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Dejar de seguir lugar" on public.social_place_follows;
create policy "Dejar de seguir lugar" on public.social_place_follows for delete to authenticated using (user_id = auth.uid());

-- ── Funciones de lectura (security invoker: respetan la RLS de quien llama) ──
create or replace function public.social_feed(
  p_scope text default 'all',
  p_place uuid default null,
  p_author uuid default null,
  p_post uuid default null,
  p_before timestamptz default null,
  p_limit integer default 10
) returns jsonb
language sql stable security invoker set search_path = public
as $$
  select coalesce(jsonb_agg(s.item order by s.created_at desc), '[]'::jsonb)
  from (
    select p.created_at, jsonb_build_object(
      'id', p.id,
      'caption', p.caption,
      'created_at', p.created_at,
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
      and (p_before is null or p.created_at < p_before)
      and (
        p_scope = 'all'
        or (p_scope = 'following' and (
          p.author_id = auth.uid()
          or exists (select 1 from public.social_follows f where f.follower_id = auth.uid() and f.followee_id = p.author_id)
          or exists (select 1 from public.social_place_follows pf where pf.user_id = auth.uid() and pf.place_id = p.place_id)
        ))
        or (p_scope = 'saved' and exists (select 1 from public.social_saves sv where sv.post_id = p.id and sv.user_id = auth.uid()))
      )
    order by p.created_at desc
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
  ) s;
$$;

create or replace function public.social_places_overview()
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pl.id, 'slug', pl.slug, 'name', pl.name, 'country', pl.country, 'kind', pl.kind,
    'lat', pl.latitude, 'lng', pl.longitude, 'cover_url', pl.cover_url,
    'post_count', (select count(*) from public.social_posts p where p.place_id = pl.id),
    'follower_count', (select count(*) from public.social_place_follows f where f.place_id = pl.id),
    'following', exists (select 1 from public.social_place_follows f where f.place_id = pl.id and f.user_id = auth.uid()),
    'latest_at', (select max(p.created_at) from public.social_posts p where p.place_id = pl.id),
    -- Mis scrapbooks (propios o compartidos conmigo) de este lugar.
    'my_scrapbook_ids', (
      select coalesce(jsonb_agg(s.id), '[]'::jsonb) from public.scrapbooks s
      where s.place_id = pl.id
        and (s.owner_id = auth.uid() or exists (select 1 from public.scrapbook_members m where m.scrapbook_id = s.id and m.user_id = auth.uid()))
    )
  ) order by pl.name), '[]'::jsonb)
  from public.social_places pl;
$$;

create or replace function public.social_profile(p_user uuid)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select jsonb_build_object(
    'id', a.id, 'username', a.username, 'display_name', a.display_name, 'avatar_url', a.avatar_url,
    'bio', a.bio, 'website_url', a.website_url,
    'post_count', (select count(*) from public.social_posts p where p.author_id = a.id),
    'follower_count', (select count(*) from public.social_follows f where f.followee_id = a.id),
    'following_count', (select count(*) from public.social_follows f where f.follower_id = a.id),
    'followed_by_me', exists (select 1 from public.social_follows f where f.follower_id = auth.uid() and f.followee_id = a.id),
    'follows_me', exists (select 1 from public.social_follows f where f.follower_id = a.id and f.followee_id = auth.uid())
  )
  from public.profiles a where a.id = p_user;
$$;

-- Cuentas con publicaciones a las que aún no sigo (las más activas primero).
create or replace function public.social_suggestions(p_limit integer default 6)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select coalesce(jsonb_agg(s.item order by s.posts desc), '[]'::jsonb)
  from (
    select c.posts, jsonb_build_object(
      'id', a.id, 'username', a.username, 'display_name', a.display_name, 'avatar_url', a.avatar_url, 'post_count', c.posts,
      'preview_url', (select m.url from public.social_posts p join public.social_post_media m on m.post_id = p.id
                      where p.author_id = a.id and m.kind = 'photo' order by p.created_at desc, m.position limit 1)
    ) as item
    from public.profiles a
    cross join lateral (select count(*) as posts from public.social_posts p where p.author_id = a.id) c
    where a.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
      and c.posts > 0
      and not exists (select 1 from public.social_follows f where f.follower_id = auth.uid() and f.followee_id = a.id)
    order by c.posts desc
    limit least(greatest(coalesce(p_limit, 6), 1), 20)
  ) s;
$$;

revoke execute on function public.social_feed(text, uuid, uuid, uuid, timestamptz, integer) from anon;
revoke execute on function public.social_places_overview() from anon;
revoke execute on function public.social_profile(uuid) from anon;
revoke execute on function public.social_suggestions(integer) from anon;

-- ── Storage: fotos y vídeos de la red social ─────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-media', 'social-media', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Social: subir a mi carpeta" on storage.objects;
create policy "Social: subir a mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Social: borrar lo mío" on storage.objects;
create policy "Social: borrar lo mío" on storage.objects for delete to authenticated
  using (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text);
