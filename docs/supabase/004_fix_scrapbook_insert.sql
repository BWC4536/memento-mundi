-- Memento Mundi / Supabase migration 004 — permitir crear scrapbooks
-- Ejecutar después de 003. No cambia tablas ni datos.
--
-- Problema: al crear un scrapbook la app pide que se devuelva la fila creada
-- (INSERT ... RETURNING). La política de lectura usaba solo una función que consulta
-- la tabla scrapbooks, y esa función no ve la fila que se está insertando en la misma
-- operación, así que PostgreSQL rechazaba el INSERT (403 / violates row-level security).
-- Solución: comprobar el propietario directamente sobre la fila, y dejar la función
-- para miembros y scrapbooks públicos.

drop policy if exists "Read own, shared or public scrapbooks" on public.scrapbooks;
create policy "Read own, shared or public scrapbooks" on public.scrapbooks
  for select using (owner_id = auth.uid() or is_public or public.can_read_scrapbook(id));
