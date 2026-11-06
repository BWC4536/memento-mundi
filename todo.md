
# Plan: App-first con Scrapbooks

- [x] Revisar la estructura actual de Home, rutas, componentes y esquema Supabase documentado.
- [x] Añadir la foto adjunta como asset de portada de demo sin incluir bytes en la base de datos.
- [x] Convertir Home en la colección principal de scrapbooks con tarjetas y acciones rápidas.
- [x] Implementar la base visual de creación, invitados, compartir, añadir foto y borrar.
- [x] Implementar detalle de scrapbook con modo Ver a pantalla completa y modo Editar.
- [x] Añadir editor visual inicial con marcos, fotos y decoración, preparado para ampliar hacia Canva.
- [x] Ampliar el esquema SQL de Supabase con scrapbooks, miembros, fotos, elementos, productos y RLS.
- [x] Actualizar la navegación para que Casa vuelva siempre a la colección de scrapbooks.
- [x] Verificar responsive, accesibilidad, TypeScript, tests y build; guardar checkpoint.

Siguiente fase: conectar estas entidades a Supabase Auth/Storage y sustituir el estado demo local por consultas persistentes; la UI actual deja los flujos listos, pero aún necesita URL/anon key de Supabase y procedimientos de persistencia.
