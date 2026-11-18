-- Memento Mundi / Supabase migration 003 — endurecer funciones (avisos del Security Advisor)
-- Ejecutar después de 002. No cambia tablas, datos ni políticas.
--
-- · Fija search_path en las funciones auxiliares.
-- · Quita el permiso de ejecutar como RPC a quien no lo necesita. Las políticas RLS se
--   evalúan con el rol de quien consulta, así que:
--     - authenticated necesita todas las funciones de permisos;
--     - anon solo necesita can_read_scrapbook (para leer scrapbooks públicos).
-- · handle_new_user es una función de trigger: no debe poder llamarse por RPC.

alter function public.set_updated_at() set search_path = public;
alter function public.safe_uuid(text) set search_path = public;

revoke execute on function public.is_scrapbook_owner(uuid) from anon, public;
revoke execute on function public.can_edit_scrapbook(uuid) from anon, public;
revoke execute on function public.page_scrapbook_id(uuid) from anon, public;
grant execute on function public.is_scrapbook_owner(uuid) to authenticated;
grant execute on function public.can_edit_scrapbook(uuid) to authenticated;
grant execute on function public.page_scrapbook_id(uuid) to authenticated;
grant execute on function public.can_read_scrapbook(uuid) to anon, authenticated;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
