-- Memento Mundi / Supabase migration 001
-- Ejecutar después de docs/supabase-schema.sql.
-- El lienzo se guarda como elementos posicionables; Storage conserva los bytes.

create table if not exists public.scrapbook_pages (
  id uuid primary key default gen_random_uuid(),
  scrapbook_id uuid not null references public.scrapbooks(id) on delete cascade,
  name text not null default 'Página sin título',
  width integer not null default 1920 check (width between 320 and 10000),
  height integer not null default 1080 check (height between 320 and 10000),
  background_color text not null default '#EAE7DA',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scrapbook_elements
  add column if not exists page_id uuid references public.scrapbook_pages(id) on delete cascade,
  add column if not exists x double precision not null default 0,
  add column if not exists y double precision not null default 0,
  add column if not exists width double precision,
  add column if not exists height double precision,
  add column if not exists rotation double precision not null default 0,
  add column if not exists scale double precision not null default 1,
  add column if not exists opacity double precision not null default 1 check (opacity between 0 and 1),
  add column if not exists filter_name text not null default 'normal',
  add column if not exists locked boolean not null default false,
  add column if not exists visible boolean not null default true;

create index if not exists scrapbook_pages_scrapbook_id_idx on public.scrapbook_pages(scrapbook_id);
create index if not exists scrapbook_elements_page_id_idx on public.scrapbook_elements(page_id);

alter table public.scrapbook_pages enable row level security;
drop policy if exists "Members can read scrapbook pages" on public.scrapbook_pages;
create policy "Members can read scrapbook pages" on public.scrapbook_pages for select using (
  exists (select 1 from public.scrapbooks s where s.id = scrapbook_id and (s.owner_id = auth.uid() or s.is_public or exists (select 1 from public.scrapbook_members m where m.scrapbook_id = s.id and m.user_id = auth.uid()))
);
drop policy if exists "Editors can manage scrapbook pages" on public.scrapbook_pages;
create policy "Editors can manage scrapbook pages" on public.scrapbook_pages for all using (
  exists (select 1 from public.scrapbooks s where s.id = scrapbook_id and (s.owner_id = auth.uid() or exists (select 1 from public.scrapbook_members m where m.scrapbook_id = s.id and m.user_id = auth.uid() and m.role = 'editor')))
) with check (
  exists (select 1 from public.scrapbooks s where s.id = scrapbook_id and (s.owner_id = auth.uid() or exists (select 1 from public.scrapbook_members m where m.scrapbook_id = s.id and m.user_id = auth.uid() and m.role = 'editor')))
);

-- Storage: crear manualmente el bucket scrapbook-media si aún no existe.
-- Recomendado: bucket privado y URLs firmadas para fotos de usuarios.
-- Los paths sugeridos son: <user-id>/<scrapbook-id>/<photo-id>.<extension>
