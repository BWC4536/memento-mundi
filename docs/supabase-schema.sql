-- Memento Mundi / Supabase
-- Perfiles, viajes, pegatinas físicas, scrapbooks colaborativos y productos.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  city text not null,
  country text not null,
  cover_url text,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  title text not null,
  image_url text,
  latitude double precision,
  longitude double precision,
  rotation smallint not null default 0 check (rotation >= -180 and rotation <= 180),
  unlocked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.scrapbooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  cover_url text,
  location_name text,
  country text,
  latitude double precision,
  longitude double precision,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scrapbook_members (
  scrapbook_id uuid not null references public.scrapbooks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'editor' check (role in ('viewer', 'editor', 'owner')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (scrapbook_id, user_id)
);

create table if not exists public.scrapbook_photos (
  id uuid primary key default gen_random_uuid(),
  scrapbook_id uuid not null references public.scrapbooks(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  thumbnail_path text,
  caption text,
  latitude double precision,
  longitude double precision,
  taken_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.scrapbook_elements (
  id uuid primary key default gen_random_uuid(),
  scrapbook_id uuid not null references public.scrapbooks(id) on delete cascade,
  photo_id uuid references public.scrapbook_photos(id) on delete cascade,
  element_type text not null check (element_type in ('photo', 'text', 'sticker', 'frame', 'shape')),
  payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'EUR',
  image_url text,
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_owner_id_idx on public.trips(owner_id);
create index if not exists stickers_trip_id_idx on public.stickers(trip_id);
create index if not exists stickers_owner_id_idx on public.stickers(owner_id);
create index if not exists scrapbooks_owner_id_idx on public.scrapbooks(owner_id);
create index if not exists scrapbook_members_user_id_idx on public.scrapbook_members(user_id);
create index if not exists scrapbook_photos_scrapbook_id_idx on public.scrapbook_photos(scrapbook_id);
create index if not exists scrapbook_elements_scrapbook_id_idx on public.scrapbook_elements(scrapbook_id);
create index if not exists products_active_idx on public.products(is_active);

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.stickers enable row level security;
alter table public.scrapbooks enable row level security;
alter table public.scrapbook_members enable row level security;
alter table public.scrapbook_photos enable row level security;
alter table public.scrapbook_elements enable row level security;
alter table public.products enable row level security;

drop policy if exists "Profiles are private" on public.profiles;
create policy "Profiles are private" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Users can manage their trips" on public.trips;
create policy "Users can manage their trips" on public.trips for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "Users can manage their stickers" on public.stickers;
create policy "Users can manage their stickers" on public.stickers for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Scrapbook members can read scrapbooks" on public.scrapbooks;
create policy "Scrapbook members can read scrapbooks" on public.scrapbooks for select using (auth.uid() = owner_id or exists (select 1 from public.scrapbook_members m where m.scrapbook_id = id and m.user_id = auth.uid()) or is_public);
drop policy if exists "Owners can manage scrapbooks" on public.scrapbooks;
create policy "Owners can manage scrapbooks" on public.scrapbooks for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Members can read memberships" on public.scrapbook_members;
create policy "Members can read memberships" on public.scrapbook_members for select using (auth.uid() = user_id or exists (select 1 from public.scrapbooks s where s.id = scrapbook_id and s.owner_id = auth.uid()));
drop policy if exists "Owners can manage memberships" on public.scrapbook_members;
create policy "Owners can manage memberships" on public.scrapbook_members for all using (exists (select 1 from public.scrapbooks s where s.id = scrapbook_id and s.owner_id = auth.uid())) with check (exists (select 1 from public.scrapbooks s where s.id = scrapbook_id and s.owner_id = auth.uid()));

drop policy if exists "Scrapbook members can manage photos" on public.scrapbook_photos;
create policy "Scrapbook members can manage photos" on public.scrapbook_photos for all using (exists (select 1 from public.scrapbooks s where s.id = scrapbook_id and (s.owner_id = auth.uid() or exists (select 1 from public.scrapbook_members m where m.scrapbook_id = s.id and m.user_id = auth.uid() and m.role = 'editor')))) with check (uploaded_by = auth.uid());
drop policy if exists "Scrapbook members can manage elements" on public.scrapbook_elements;
create policy "Scrapbook members can manage elements" on public.scrapbook_elements for all using (exists (select 1 from public.scrapbooks s where s.id = scrapbook_id and (s.owner_id = auth.uid() or exists (select 1 from public.scrapbook_members m where m.scrapbook_id = s.id and m.user_id = auth.uid() and m.role = 'editor')))) with check (created_by = auth.uid());
drop policy if exists "Products are public when active" on public.products;
create policy "Products are public when active" on public.products for select using (is_active = true);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
