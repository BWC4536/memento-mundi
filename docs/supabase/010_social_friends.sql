-- 010 · Red social: buscar amigos y listas de conexiones
--
-- · social_search_users(p_query): busca personas por @usuario o nombre, sin distinguir
--   mayúsculas ni tildes ("lucia" encuentra a "Lucía"). Primero coincidencias exactas,
--   luego las que empiezan por el texto, y entre ellas las que ya conoces (os seguís, te sigue…).
-- · social_connections(p_kind): mis amigos (nos seguimos), quién me sigue y a quién sigo.
-- · Las cuentas privadas no salen (la RLS de profiles ya las oculta) ni cuento sus posts privados.
-- Requiere 006 y 009 (009 ya incluye 008). Se puede ejecutar varias veces.

-- Quita tildes y pasa a minúsculas sin depender de la extensión unaccent.
create or replace function public.social_fold(p_text text)
returns text
language sql immutable parallel safe set search_path = public
as $$
  select translate(lower(coalesce(p_text, '')), 'áàâäãéèêëíìîïóòôöõúùûüñç', 'aaaaaeeeeiiiiooooouuuunc');
$$;

-- Índices de expresión para que el "empieza por" del @usuario y del nombre vaya rápido.
create index if not exists profiles_username_fold_idx on public.profiles (public.social_fold(username) text_pattern_ops);
create index if not exists profiles_display_name_fold_idx on public.profiles (public.social_fold(display_name) text_pattern_ops);

-- Ficha de persona para listas (misma forma en búsqueda y conexiones).
-- Recibe el id y lee solo columnas permitidas: profiles tiene permisos por columna (005) y `email` no se puede leer.
create or replace function public.social_user_card(p_user uuid)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select jsonb_build_object(
    'id', a.id, 'username', a.username, 'display_name', a.display_name, 'avatar_url', a.avatar_url, 'bio', a.bio,
    'post_count', (select count(*) from public.social_posts p where p.author_id = a.id and p.visibility = 'public'),
    'follower_count', (select count(*) from public.social_follows f where f.followee_id = a.id),
    'followed_by_me', exists (select 1 from public.social_follows f where f.follower_id = auth.uid() and f.followee_id = a.id),
    'follows_me', exists (select 1 from public.social_follows f where f.follower_id = a.id and f.followee_id = auth.uid())
  )
  from public.profiles a where a.id = p_user;
$$;

drop function if exists public.social_user_card(public.profiles);

create or replace function public.social_search_users(p_query text, p_limit integer default 20)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  with pattern as (
    -- Sin "@" inicial, sin tildes y con los comodines de LIKE escapados.
    select term, replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') as safe
    from (select public.social_fold(btrim(regexp_replace(coalesce(p_query, ''), '^\s*@', ''))) as term) q
  ), found as (
    select a.id, a.username,
      case
        when public.social_fold(a.username) = pattern.term then 0
        when public.social_fold(a.username) like pattern.safe || '%' escape '\' then 1
        when public.social_fold(a.display_name) like pattern.safe || '%' escape '\' then 2
        when public.social_fold(a.display_name) like '% ' || pattern.safe || '%' escape '\' then 3
        else 4
      end as rank,
      (exists (select 1 from public.social_follows f where f.follower_id = auth.uid() and f.followee_id = a.id))::int
        + (exists (select 1 from public.social_follows f where f.follower_id = a.id and f.followee_id = auth.uid()))::int as closeness
    from public.profiles a, pattern
    where char_length(pattern.term) >= 1
      and a.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
      and (
        public.social_fold(a.username) like '%' || pattern.safe || '%' escape '\'
        or public.social_fold(a.display_name) like '%' || pattern.safe || '%' escape '\'
      )
    order by rank, closeness desc, a.username nulls last
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select coalesce(jsonb_agg(public.social_user_card(found.id) order by found.rank, found.closeness desc, found.username nulls last), '[]'::jsonb)
  from found;
$$;

-- p_kind: 'friends' (nos seguimos), 'followers' (me siguen), 'following' (sigo).
create or replace function public.social_connections(p_kind text default 'friends', p_limit integer default 100)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select coalesce(jsonb_agg(public.social_user_card(c.id) order by c.since desc), '[]'::jsonb)
  from (
    select a.id, coalesce(mine.created_at, theirs.created_at) as since
    from public.profiles a
    left join public.social_follows mine on mine.follower_id = auth.uid() and mine.followee_id = a.id
    left join public.social_follows theirs on theirs.follower_id = a.id and theirs.followee_id = auth.uid()
    where a.id <> auth.uid()
      and case p_kind
        when 'friends' then mine.follower_id is not null and theirs.follower_id is not null
        when 'followers' then theirs.follower_id is not null
        when 'following' then mine.follower_id is not null
        else false
      end
    order by since desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ) c;
$$;

revoke execute on function public.social_user_card(uuid) from anon;
revoke execute on function public.social_search_users(text, integer) from anon;
revoke execute on function public.social_connections(text, integer) from anon;
