-- Memento Mundi / Supabase migration 002 — editor visual de scrapbooks
--
-- Pensada para el proyecto real (esquema con profiles, scrapbooks, scrapbook_members,
-- scrapbook_photos, scrapbook_elements, stickers, trips/posts...). Es AUTOCONTENIDA:
-- incluye lo de 001_scrapbook_canvas.sql de forma idempotente, así que puede
-- ejecutarse aunque 001 no se haya ejecutado nunca. Se puede ejecutar varias veces.
--
-- NO borra tablas, columnas ni filas.
-- SÍ reemplaza las políticas RLS de las tablas de scrapbooks: las actuales de
-- `scrapbooks` y `scrapbook_members` se consultan entre sí y provocan
-- "infinite recursion detected in policy" en cualquier lectura. Las nuevas usan
-- funciones SECURITY DEFINER y mantienen las mismas reglas:
--   · el propietario lee y edita sus scrapbooks;
--   · los miembros invitados (viewer/editor/owner) leen los scrapbooks compartidos;
--   · los miembros editor/owner modifican páginas, elementos y fotos;
--   · nadie lee scrapbooks privados de otros usuarios (salvo is_public = true).
--
-- Las fotos nunca se guardan como bytes en la base de datos: van al bucket privado
-- `scrapbook-media` con la ruta <scrapbook_id>/<user_id>/<asset_id>.<ext>.
--
-- Uso: Supabase › SQL Editor › pegar este archivo completo › Run.

begin;

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Convierte texto a uuid sin lanzar error (rutas de Storage manipuladas).
create or replace function public.safe_uuid(value text)
returns uuid language plpgsql immutable as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

/* ------------------------------------------------------------------ */
/* profiles                                                            */
/* ------------------------------------------------------------------ */

alter table public.profiles add column if not exists email text;

-- Crea el perfil al registrarse con Supabase Auth (scrapbooks.owner_id apunta a profiles).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

/* ------------------------------------------------------------------ */
/* scrapbooks                                                          */
/* ------------------------------------------------------------------ */

alter table public.scrapbooks add column if not exists cover_image_url text;
alter table public.scrapbooks add column if not exists location_name text;
update public.scrapbooks set cover_image_url = cover_url where cover_image_url is null and cover_url is not null;
update public.scrapbooks
  set location_name = concat_ws(', ', nullif(city, ''), nullif(country, ''))
  where location_name is null and (city is not null or country is not null);
comment on column public.scrapbooks.cover_image_url is 'Miniatura de la tarjeta en Home. La experiencia principal es la composición (scrapbook_pages + scrapbook_elements).';

/* ------------------------------------------------------------------ */
/* scrapbook_members                                                   */
/* ------------------------------------------------------------------ */

alter table public.scrapbook_members add column if not exists created_at timestamptz not null default now();
create index if not exists scrapbook_members_user_id_idx on public.scrapbook_members(user_id);

/* ------------------------------------------------------------------ */
/* scrapbook_pages (lienzo)                                            */
/* ------------------------------------------------------------------ */

create table if not exists public.scrapbook_pages (
  id uuid primary key default gen_random_uuid(),
  scrapbook_id uuid not null references public.scrapbooks(id) on delete cascade,
  name text not null default 'Página 1',
  width integer not null default 1200 check (width between 320 and 10000),
  height integer not null default 900 check (height between 320 and 10000),
  background text not null default '#EAE7DA',
  -- textura, marco general, formato e imagen de fondo
  background_json jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Si 001 se ejecutó antes, la tabla existe con background_color: se añaden las columnas nuevas.
alter table public.scrapbook_pages add column if not exists background text not null default '#EAE7DA';
alter table public.scrapbook_pages add column if not exists background_json jsonb not null default '{}'::jsonb;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scrapbook_pages' and column_name = 'background_color') then
    execute 'update public.scrapbook_pages set background = background_color where background = ''#EAE7DA'' and background_color is not null';
  end if;
end;
$$;

create index if not exists scrapbook_pages_scrapbook_id_idx on public.scrapbook_pages(scrapbook_id, sort_order);

/* ------------------------------------------------------------------ */
/* scrapbook_elements                                                  */
/* ------------------------------------------------------------------ */

alter table public.scrapbook_elements
  add column if not exists page_id uuid references public.scrapbook_pages(id) on delete cascade,
  add column if not exists x double precision not null default 0,
  add column if not exists y double precision not null default 0,
  add column if not exists width double precision,
  add column if not exists height double precision,
  add column if not exists rotation double precision not null default 0,
  add column if not exists scale double precision not null default 1,
  add column if not exists opacity double precision not null default 1,
  add column if not exists z_index integer not null default 0,
  add column if not exists content text,
  add column if not exists src text,
  add column if not exists frame_id text,
  add column if not exists filter_name text not null default 'original',
  add column if not exists locked boolean not null default false,
  add column if not exists visible boolean not null default true,
  add column if not exists style_json jsonb not null default '{}'::jsonb,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb;

alter table public.scrapbook_elements alter column filter_name set default 'original';

-- Admite el tipo 'decoration' (amplía el check; no modifica filas).
alter table public.scrapbook_elements drop constraint if exists scrapbook_elements_element_type_check;
alter table public.scrapbook_elements
  add constraint scrapbook_elements_element_type_check
  check (element_type in ('photo', 'text', 'frame', 'sticker', 'shape', 'decoration'));

-- Restricciones nuevas como NOT VALID: se aplican a filas nuevas sin romper datos antiguos.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'scrapbook_elements_src_not_inline') then
    alter table public.scrapbook_elements
      add constraint scrapbook_elements_src_not_inline check (src is null or src !~* '^(data|blob):') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scrapbook_elements_filter_name_check') then
    alter table public.scrapbook_elements
      add constraint scrapbook_elements_filter_name_check
      check (filter_name in ('original', 'normal', 'noir', 'vivid', 'contrast', 'vintage', 'warm', 'cool', 'fade', 'sepia')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scrapbook_elements_transform_limits') then
    alter table public.scrapbook_elements
      add constraint scrapbook_elements_transform_limits
      check (rotation between -180 and 180 and scale between 0.25 and 3 and opacity between 0 and 1) not valid;
  end if;
end;
$$;

create index if not exists scrapbook_elements_scrapbook_id_idx on public.scrapbook_elements(scrapbook_id);
create index if not exists scrapbook_elements_page_z_idx on public.scrapbook_elements(page_id, z_index);

/* ------------------------------------------------------------------ */
/* scrapbook_assets (metadatos de archivos; los bytes van a Storage)   */
/* ------------------------------------------------------------------ */

create table if not exists public.scrapbook_assets (
  id uuid primary key default gen_random_uuid(),
  scrapbook_id uuid not null references public.scrapbooks(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  public_url text,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  created_at timestamptz not null default now()
);

create index if not exists scrapbook_assets_scrapbook_id_idx on public.scrapbook_assets(scrapbook_id);

/* ------------------------------------------------------------------ */
/* updated_at automático                                               */
/* ------------------------------------------------------------------ */

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at on public.scrapbooks;
create trigger set_updated_at before update on public.scrapbooks for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at on public.scrapbook_pages;
create trigger set_updated_at before update on public.scrapbook_pages for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at on public.scrapbook_elements;
create trigger set_updated_at before update on public.scrapbook_elements for each row execute procedure public.set_updated_at();

/* ------------------------------------------------------------------ */
/* Funciones de permisos (SECURITY DEFINER: no pasan por RLS y así no  */
/* hay recursión entre scrapbooks y scrapbook_members)                 */
/* ------------------------------------------------------------------ */

create or replace function public.is_scrapbook_owner(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.scrapbooks s where s.id = target and s.owner_id = auth.uid());
$$;

create or replace function public.can_read_scrapbook(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.scrapbooks s
    where s.id = target
      and (
        s.owner_id = auth.uid()
        or s.is_public
        or exists (select 1 from public.scrapbook_members m where m.scrapbook_id = s.id and m.user_id = auth.uid())
      )
  );
$$;

create or replace function public.can_edit_scrapbook(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.scrapbooks s
    where s.id = target
      and (
        s.owner_id = auth.uid()
        or exists (
          select 1 from public.scrapbook_members m
          where m.scrapbook_id = s.id and m.user_id = auth.uid() and m.role in ('editor', 'owner')
        )
      )
  );
$$;

create or replace function public.page_scrapbook_id(target uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select scrapbook_id from public.scrapbook_pages where id = target;
$$;

revoke all on function public.is_scrapbook_owner(uuid) from public;
revoke all on function public.can_read_scrapbook(uuid) from public;
revoke all on function public.can_edit_scrapbook(uuid) from public;
revoke all on function public.page_scrapbook_id(uuid) from public;
grant execute on function public.is_scrapbook_owner(uuid) to authenticated;
grant execute on function public.can_read_scrapbook(uuid) to authenticated, anon;
grant execute on function public.can_edit_scrapbook(uuid) to authenticated;
grant execute on function public.page_scrapbook_id(uuid) to authenticated, anon;

/* ------------------------------------------------------------------ */
/* RLS: se eliminan las políticas antiguas de estas tablas (incluidas  */
/* las recursivas) y se crean las nuevas.                              */
/* ------------------------------------------------------------------ */

do $$
declare
  policy record;
begin
  for policy in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('scrapbooks', 'scrapbook_members', 'scrapbook_pages', 'scrapbook_elements', 'scrapbook_photos', 'scrapbook_assets')
  loop
    execute format('drop policy if exists %I on public.%I', policy.policyname, policy.tablename);
  end loop;
end;
$$;

alter table public.scrapbooks enable row level security;
alter table public.scrapbook_members enable row level security;
alter table public.scrapbook_pages enable row level security;
alter table public.scrapbook_elements enable row level security;
alter table public.scrapbook_photos enable row level security;
alter table public.scrapbook_assets enable row level security;

-- scrapbooks
create policy "Read own, shared or public scrapbooks" on public.scrapbooks
  for select using (public.can_read_scrapbook(id));
create policy "Create own scrapbooks" on public.scrapbooks
  for insert with check (owner_id = auth.uid());
-- Solo el propietario cambia los metadatos (así un editor no puede apropiarse del scrapbook).
create policy "Owners update scrapbooks" on public.scrapbooks
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owners delete scrapbooks" on public.scrapbooks
  for delete using (owner_id = auth.uid());

-- scrapbook_members
create policy "Read memberships of readable scrapbooks" on public.scrapbook_members
  for select using (user_id = auth.uid() or public.can_read_scrapbook(scrapbook_id));
create policy "Owners add members" on public.scrapbook_members
  for insert with check (public.is_scrapbook_owner(scrapbook_id));
create policy "Owners update members" on public.scrapbook_members
  for update using (public.is_scrapbook_owner(scrapbook_id)) with check (public.is_scrapbook_owner(scrapbook_id));
create policy "Owners remove members or members leave" on public.scrapbook_members
  for delete using (public.is_scrapbook_owner(scrapbook_id) or user_id = auth.uid());

-- scrapbook_pages
create policy "Read pages of readable scrapbooks" on public.scrapbook_pages
  for select using (public.can_read_scrapbook(scrapbook_id));
create policy "Editors manage pages" on public.scrapbook_pages
  for all using (public.can_edit_scrapbook(scrapbook_id)) with check (public.can_edit_scrapbook(scrapbook_id));

-- scrapbook_elements
create policy "Read elements of readable scrapbooks" on public.scrapbook_elements
  for select using (public.can_read_scrapbook(scrapbook_id));
create policy "Editors insert elements" on public.scrapbook_elements
  for insert with check (
    public.can_edit_scrapbook(scrapbook_id)
    and created_by = auth.uid()
    and (page_id is null or public.page_scrapbook_id(page_id) = scrapbook_id)
  );
create policy "Editors update elements" on public.scrapbook_elements
  for update using (public.can_edit_scrapbook(scrapbook_id))
  with check (public.can_edit_scrapbook(scrapbook_id) and (page_id is null or public.page_scrapbook_id(page_id) = scrapbook_id));
create policy "Editors delete elements" on public.scrapbook_elements
  for delete using (public.can_edit_scrapbook(scrapbook_id));

-- scrapbook_photos
create policy "Read photos of readable scrapbooks" on public.scrapbook_photos
  for select using (public.can_read_scrapbook(scrapbook_id));
create policy "Editors add photos" on public.scrapbook_photos
  for insert with check (public.can_edit_scrapbook(scrapbook_id) and uploaded_by = auth.uid());
create policy "Editors update photos" on public.scrapbook_photos
  for update using (public.can_edit_scrapbook(scrapbook_id)) with check (public.can_edit_scrapbook(scrapbook_id));
create policy "Uploaders or owners delete photos" on public.scrapbook_photos
  for delete using (uploaded_by = auth.uid() or public.is_scrapbook_owner(scrapbook_id));

-- scrapbook_assets
create policy "Read assets of readable scrapbooks" on public.scrapbook_assets
  for select using (public.can_read_scrapbook(scrapbook_id));
create policy "Editors add assets" on public.scrapbook_assets
  for insert with check (public.can_edit_scrapbook(scrapbook_id) and uploaded_by = auth.uid());
create policy "Uploaders or owners delete assets" on public.scrapbook_assets
  for delete using (uploaded_by = auth.uid() or public.is_scrapbook_owner(scrapbook_id));

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

-- Bucket privado: las fotos se sirven con URLs firmadas. Máximo 15 MB por archivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scrapbook-media', 'scrapbook-media', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists "Scrapbook readers can view media" on storage.objects;
create policy "Scrapbook readers can view media" on storage.objects
  for select using (
    bucket_id = 'scrapbook-media'
    and public.can_read_scrapbook(public.safe_uuid((storage.foldername(name))[1]))
  );

drop policy if exists "Scrapbook editors can upload media" on storage.objects;
create policy "Scrapbook editors can upload media" on storage.objects
  for insert with check (
    bucket_id = 'scrapbook-media'
    and public.can_edit_scrapbook(public.safe_uuid((storage.foldername(name))[1]))
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Uploaders can replace their media" on storage.objects;
create policy "Uploaders can replace their media" on storage.objects
  for update using (
    bucket_id = 'scrapbook-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.can_edit_scrapbook(public.safe_uuid((storage.foldername(name))[1]))
  );

drop policy if exists "Uploaders and owners can delete media" on storage.objects;
create policy "Uploaders and owners can delete media" on storage.objects
  for delete using (
    bucket_id = 'scrapbook-media'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_scrapbook_owner(public.safe_uuid((storage.foldername(name))[1]))
    )
  );

commit;

-- Comprobación rápida tras ejecutar (debe devolver filas sin error de recursión):
--   select id, title from public.scrapbooks limit 1;
