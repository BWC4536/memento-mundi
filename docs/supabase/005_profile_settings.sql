-- Memento Mundi / Supabase migration 005 — página de Perfil
-- Ejecutar después de 004. Idempotente.
--
-- · profiles: web, perfil privado y validaciones de formato.
-- · user_settings: preferencias privadas (consentimiento de novedades por email).
-- · Permisos por columna: el usuario edita sus datos, pero no `ugc_points` ni `email`,
--   y el email deja de ser legible por otros usuarios.
-- · ugc_claims: el usuario lee sus solicitudes y solo puede crear solicitudes "pending".
-- · Bucket público `avatars` (cada usuario escribe solo en su carpeta <uid>/).
-- · RPC delete_my_account(): borra la cuenta y, en cascada, todos sus datos.

/* ------------------------------------------------------------------ */
/* profiles                                                            */
/* ------------------------------------------------------------------ */

alter table public.profiles add column if not exists website_url text;
alter table public.profiles add column if not exists is_private boolean not null default false;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_.]{3,30}$');
alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles add constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 60);
alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length check (bio is null or char_length(bio) <= 280);
alter table public.profiles drop constraint if exists profiles_handles_format;
alter table public.profiles add constraint profiles_handles_format check (
  (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9_.]{1,30}$')
  and (tiktok_handle is null or tiktok_handle ~ '^[A-Za-z0-9_.]{1,30}$')
);
alter table public.profiles drop constraint if exists profiles_website_format;
alter table public.profiles add constraint profiles_website_format check (website_url is null or (website_url ~ '^https?://' and char_length(website_url) <= 200));

-- Permisos por columna. `email` y `ugc_points` solo los escribe el sistema.
revoke all on public.profiles from anon, authenticated;
grant select (id, username, display_name, avatar_url, bio, instagram_handle, tiktok_handle, website_url, is_private, ugc_points, created_at, updated_at)
  on public.profiles to anon, authenticated;
grant update (username, display_name, avatar_url, bio, instagram_handle, tiktok_handle, website_url, is_private)
  on public.profiles to authenticated;

drop policy if exists "Perfiles visibles públicamente" on public.profiles;
drop policy if exists "Perfiles públicos o propios" on public.profiles;
create policy "Perfiles públicos o propios" on public.profiles for select using (not is_private or auth.uid() = id);

drop policy if exists "Usuarios editan su propio perfil" on public.profiles;
create policy "Usuarios editan su propio perfil" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

/* ------------------------------------------------------------------ */
/* user_settings (privado)                                             */
/* ------------------------------------------------------------------ */

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
revoke all on public.user_settings from anon;
grant select, insert, update on public.user_settings to authenticated;

drop policy if exists "Ajustes propios" on public.user_settings;
create policy "Ajustes propios" on public.user_settings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_updated_at on public.user_settings;
create trigger set_updated_at before update on public.user_settings for each row execute procedure public.set_updated_at();

/* ------------------------------------------------------------------ */
/* ugc_claims                                                          */
/* ------------------------------------------------------------------ */

alter table public.ugc_claims drop constraint if exists ugc_claims_platform_check;
alter table public.ugc_claims add constraint ugc_claims_platform_check check (social_platform in ('instagram', 'tiktok'));
alter table public.ugc_claims drop constraint if exists ugc_claims_status_check;
alter table public.ugc_claims add constraint ugc_claims_status_check check (status in ('pending', 'approved', 'rejected'));
alter table public.ugc_claims drop constraint if exists ugc_claims_proof_url_check;
alter table public.ugc_claims add constraint ugc_claims_proof_url_check check (proof_url ~ '^https://' and char_length(proof_url) <= 300);
create unique index if not exists ugc_claims_user_proof_idx on public.ugc_claims(user_id, proof_url);

-- El usuario solo elige plataforma y enlace; estado y recompensa toman su valor por defecto.
revoke all on public.ugc_claims from anon, authenticated;
grant select on public.ugc_claims to authenticated;
grant insert (user_id, social_platform, proof_url) on public.ugc_claims to authenticated;

drop policy if exists "Ver mis reclamaciones UGC" on public.ugc_claims;
create policy "Ver mis reclamaciones UGC" on public.ugc_claims for select to authenticated using (auth.uid() = user_id);

/* ------------------------------------------------------------------ */
/* Avatares                                                            */
/* ------------------------------------------------------------------ */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar: leer el propio" on storage.objects;
create policy "Avatar: leer el propio" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Avatar: subir el propio" on storage.objects;
create policy "Avatar: subir el propio" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Avatar: reemplazar el propio" on storage.objects;
create policy "Avatar: reemplazar el propio" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Avatar: borrar el propio" on storage.objects;
create policy "Avatar: borrar el propio" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

/* ------------------------------------------------------------------ */
/* Borrar la cuenta                                                    */
/* ------------------------------------------------------------------ */

-- Borra el usuario de auth.users; profiles y todo lo que cuelga de él se borra en cascada.
-- Los archivos de Storage los borra antes el cliente (Storage no permite borrarlos por SQL).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
