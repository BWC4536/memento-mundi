-- Memento Mundi / Supabase migration 002
-- Tabla mínima que consulta el cron /api/keep-alive para que el proyecto
-- (plan gratuito) no se pause por inactividad.

create table if not exists public.keep_alive (
  id int primary key default 1,
  last_ping timestamptz not null default now()
);

insert into public.keep_alive (id) values (1)
on conflict (id) do nothing;

alter table public.keep_alive enable row level security;

drop policy if exists "keep_alive_public_select" on public.keep_alive;
create policy "keep_alive_public_select"
  on public.keep_alive
  for select
  using (true);
