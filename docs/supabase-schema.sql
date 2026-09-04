-- Memento Mundi / Supabase
-- Perfiles, viajes y pegatinas físicas que desbloquean recuerdos digitales.

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

create index if not exists trips_owner_id_idx on public.trips(owner_id);
create index if not exists stickers_trip_id_idx on public.stickers(trip_id);
create index if not exists stickers_owner_id_idx on public.stickers(owner_id);

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.stickers enable row level security;

drop policy if exists "Profiles are private" on public.profiles;
create policy "Profiles are private" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can manage their trips" on public.trips;
create policy "Users can manage their trips" on public.trips for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Users can manage their stickers" on public.stickers;
create policy "Users can manage their stickers" on public.stickers for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
