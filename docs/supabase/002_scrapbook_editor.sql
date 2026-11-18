-- Memento Mundi / Supabase migration 002 — editor visual de scrapbooks
-- Ejecutar después de docs/supabase-schema.sql y docs/supabase/001_scrapbook_canvas.sql.
--
-- Migración ADITIVA: no borra tablas, columnas ni datos. Solo añade columnas,
-- tablas, funciones y políticas, y amplía el check de tipos de elemento.
-- Las fotos NUNCA se guardan como bytes en la base de datos: viven en el bucket
-- `scrapbook-media` y aquí solo se guardan URLs, claves (storage_path) y metadatos.
--
-- Correspondencia con el modelo del cliente (client/src/lib/supabase-composition.ts):
--   CanvasElement.type   -> scrapbook_elements.element_type
--   CanvasElement.z      -> scrapbook_elements.z_index
--   CanvasElement.filter -> scrapbook_elements.filter_name
--   textStyle/color/crop -> scrapbook_elements.style_json
--   sampleId/asset/...   -> scrapbook_elements.metadata_json

begin;

/* ----------------------------- Utilidades ----------------------------- */

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Convierte texto a uuid sin lanzar error (para rutas de Storage manipuladas).
create or replace function public.safe_uuid(value text)
returns uuid language plpgsql immutable as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

/* ------------------------------ profiles ------------------------------ */

alter table public.profiles add column if not exists email text;

/* ------------------------------ scrapbooks ----------------------------- */

alter table public.scrapbooks add column if not exists cover_image_url text;
update public.scrapbooks set cover_image_url = cover_url where cover_image_url is null and cover_url is not null;
comment on column public.scrapbooks.cover_image_url is 'Miniatura para la tarjeta de Home. La experiencia principal es la composición (scrapbook_pages + scrapbook_elements).';

/* -------------------------- scrapbook_members -------------------------- */

alter table public.scrapbook_members add column if not exists created_at timestamptz not null default now();

/* --------------------------- scrapbook_pages --------------------------- */

alter table public.scrapbook_pages add column if not exists background text;
update public.scrapbook_pages set background = background_color where background is null;
alter table public.scrapbook_pages alter column background set default '#EAE7DA';
-- Textura, marco general, formato e imagen de fondo del lienzo.
alter table public.scrapbook_pages add column if not exists background_json jsonb not null default '{}'::jsonb;

/* -------------------------- scrapbook_elements ------------------------- */

alter table public.scrapbook_elements
  add column if not exists z_index integer not null default 0,
  add column if not exists content text,
  add column if not exists src text,
  add column if not exists frame_id text,
  add column if not exists style_json jsonb not null default '{}'::jsonb,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb;

alter table public.scrapbook_elements alter column filter_name set default 'original';

-- Amplía los tipos admitidos con 'decoration' (no modifica filas existentes).
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
      check (rotation between -180 and 180 and scale between 0.25 and 3) not valid;
  end if;
end;
$$;

create index if not exists scrapbook_elements_page_z_idx on public.scrapbook_elements(page_id, z_index);

/* --------------------------- scrapbook_assets -------------------------- */

create table if not exists public.scrapbook_assets (
  id uuid primary key default gen_random_uuid(),
  scrapbook_id uuid not null references public.scrapbooks(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  -- Ruta en el bucket scrapbook-media: <scrapbook_id>/<user_id>/<asset_id>.<ext>
  storage_path text not null unique,
  public_url text,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  created_at timestamptz not null default now()
);

create index if not exists scrapbook_assets_scrapbook_id_idx on public.scrapbook_assets(scrapbook_id);

/* ------------------------------- Triggers ------------------------------ */

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at on public.scrapbooks;
create trigger set_updated_at before update on public.scrapbooks for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at on public.scrapbook_pages;
create trigger set_updated_at before update on public.scrapbook_pages for each row execute procedure public.set_updated_at();
drop trigger if exists set_updated_at on public.scrapbook_elements;
create trigger set_updated_at before update on public.scrapbook_elements for each row execute procedure public.set_updated_at();

/* --------------------------- Permisos (RLS) ---------------------------- */

-- SECURITY DEFINER evita recursión entre las políticas de scrapbooks y scrapbook_members.
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

revoke all on function public.can_read_scrapbook(uuid) from public;
revoke all on function public.can_edit_scrapbook(uuid) from public;
grant execute on function public.can_read_scrapbook(uuid) to authenticated, anon;
grant execute on function public.can_edit_scrapbook(uuid) to authenticated;

-- Elementos: los invitados (viewer) pueden leer; los editores pueden modificar
-- elementos creados por otros (la política antigua exigía created_by = auth.uid()).
alter table public.scrapbook_elements enable row level security;
drop policy if exists "Readers can read scrapbook elements" on public.scrapbook_elements;
create policy "Readers can read scrapbook elements" on public.scrapbook_elements
  for select using (public.can_read_scrapbook(scrapbook_id));
drop policy if exists "Editors can insert scrapbook elements" on public.scrapbook_elements;
create policy "Editors can insert scrapbook elements" on public.scrapbook_elements
  for insert with check (public.can_edit_scrapbook(scrapbook_id) and created_by = auth.uid());
drop policy if exists "Editors can update scrapbook elements" on public.scrapbook_elements;
create policy "Editors can update scrapbook elements" on public.scrapbook_elements
  for update using (public.can_edit_scrapbook(scrapbook_id)) with check (public.can_edit_scrapbook(scrapbook_id));
drop policy if exists "Editors can delete scrapbook elements" on public.scrapbook_elements;
create policy "Editors can delete scrapbook elements" on public.scrapbook_elements
  for delete using (public.can_edit_scrapbook(scrapbook_id));

-- Assets: metadatos de archivos. Leer con acceso de lectura; subir/borrar con permiso de edición.
alter table public.scrapbook_assets enable row level security;
drop policy if exists "Readers can read scrapbook assets" on public.scrapbook_assets;
create policy "Readers can read scrapbook assets" on public.scrapbook_assets
  for select using (public.can_read_scrapbook(scrapbook_id));
drop policy if exists "Editors can add scrapbook assets" on public.scrapbook_assets;
create policy "Editors can add scrapbook assets" on public.scrapbook_assets
  for insert with check (public.can_edit_scrapbook(scrapbook_id) and uploaded_by = auth.uid());
drop policy if exists "Uploaders and owners can delete scrapbook assets" on public.scrapbook_assets;
create policy "Uploaders and owners can delete scrapbook assets" on public.scrapbook_assets
  for delete using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.scrapbooks s where s.id = scrapbook_id and s.owner_id = auth.uid())
  );

/* ------------------------------- Storage ------------------------------- */

-- Bucket privado: las fotos se sirven con URLs firmadas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scrapbook-media', 'scrapbook-media', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- Rutas: <scrapbook_id>/<user_id>/<asset_id>.<ext>
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
      or exists (
        select 1 from public.scrapbooks s
        where s.id = public.safe_uuid((storage.foldername(name))[1]) and s.owner_id = auth.uid()
      )
    )
  );

commit;
