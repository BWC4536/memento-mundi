# Red social de Explorar — plan y beta

`/explore` tiene dos partes:

1. **El mapa.** Cada chincheta es un **lugar** (ciudad, país o región) con su propia foto de portada.
   Al tocarla se abre la ficha del lugar y, deslizando hacia abajo, salen **todas las fotos y vídeos de toda la gente** que ha publicado allí.
2. **La comunidad.** Justo debajo del mapa: un feed estilo Instagram con lo último que publica la gente.

## Qué incluye la beta

| Área | Qué hay |
| --- | --- |
| Feed | Pestañas *Para ti* (todo, lo más reciente), *Siguiendo* (personas y lugares que sigues + lo tuyo) y *Guardados*. Scroll infinito con cursor por fecha, esqueletos de carga, "Estás al día". |
| Publicación | Carrusel de hasta 10 fotos/vídeos (deslizar, puntos, flechas en escritorio, contador 1/3). Proporción limitada de 4:5 a 1,91:1 como Instagram. Vídeos con reproducción automática al entrar en pantalla, en bucle, con un único botón de sonido para todo el feed. |
| Interacciones | Me gusta (botón y **doble toque** con corazón animado), comentarios (hoja con reacciones rápidas, borrar los tuyos o los de tus posts), compartir (hoja nativa del móvil o copiar enlace), guardar, seguir a personas, seguir lugares. Todo es optimista: se pinta al instante y se deshace si el servidor falla. |
| Lugares | Fila tipo "historias" con los lugares (aro de color si hay algo de las últimas 24 h), ficha con portada, contadores, seguir, publicar aquí, compartir, "Tus scrapbooks aquí" y la cuadrícula de todo lo publicado. |
| Perfiles | Avatar, publicaciones/seguidores/seguidos, bio, web, "Te sigue", seguir, cuadrícula de posts, editar perfil (si eres tú). |
| Publicar | Elegir fotos y vídeos, se comprimen las fotos en el navegador (HEIC incluido), vídeos hasta 90 s y 50 MB, pie de foto con #etiquetas y @menciones resaltadas, elegir lugar, progreso de subida. |
| Enlaces | Cada ficha tiene URL propia y compartible: `/explore/lugar/panama`, `/explore/u/<id>`, `/explore/p/<id>`. "Atrás" cierra la ficha. |
| Muestras | 12 lugares, 6 cuentas de ejemplo (incluida la oficial `@memento.mundi`), 17 publicaciones con carruseles y 2 vídeos, likes, comentarios y seguimientos. |

**Vídeos:** solo se pueden subir a la comunidad y al mapa. Los scrapbooks siguen aceptando solo fotos (el editor solo admite imágenes).

## Cómo activarla

En el editor SQL de Supabase, en este orden:

1. `docs/supabase/006_social.sql` — tablas, seguridad (RLS), funciones del feed y bucket `social-media`.
2. `docs/supabase/007_social_seed.sql` — lugares, cuentas y publicaciones de muestra, y enlaza tu scrapbook "Panamá" con el lugar Panamá.

Hasta que se aplique la 006, Explorar muestra el mapa y un aviso de "La comunidad está casi lista"; nada más se rompe.

**Portadas de los lugares.** Ahora usan tus fotos de `/public/paisajes` como provisionales. Para poner las definitivas:

```sql
update public.social_places set cover_url = 'https://…/panama.jpg' where slug = 'panama';
-- o sube el archivo a client/public/lugares/panama.jpg y usa '/lugares/panama.jpg'
```

**Borrar las muestras** (se van en cascada sus posts, likes y comentarios):

```sql
delete from auth.users where raw_app_meta_data->>'sample' = 'true';
```

## Modelo de datos

```
social_places        lugar (slug, nombre, país, tipo, lat/lng, cover_url)
  └─ scrapbooks.place_id   un scrapbook pertenece a un lugar
social_posts         publicación (autor, lugar opcional, pie de foto)
  └─ social_post_media     fotos/vídeos ordenados (url, tamaño, duración)
social_likes         (post, usuario)
social_saves         (post, usuario) — solo los ve su dueño
social_comments      (post, autor, texto)
social_follows       (seguidor, seguido)
social_place_follows (usuario, lugar)
```

Lecturas por funciones SQL que devuelven JSON listo para pintar (un viaje de red por pantalla):
`social_feed`, `social_places_overview`, `social_profile`, `social_suggestions`. Son *security invoker*: respetan la RLS de quien llama.

**Seguridad.** Cada uno solo puede publicar, comentar, dar like, guardar o seguir **como sí mismo**, y borrar lo suyo. Los archivos van a `social-media/<user_id>/<post_id>/…` y solo puedes escribir en tu carpeta. Las cuentas con perfil privado no aparecen en la comunidad (se apoya en la RLS de `profiles`).

## Decisiones tomadas

- **Bucket público** para la comunidad: lo publicado es público por definición y así las URLs no caducan ni hay que firmarlas (los scrapbooks siguen en un bucket privado con URLs firmadas).
- **Contadores calculados al leer** (count). Con miles de posts por lugar conviene pasar a contadores guardados con triggers (fase 3).
- **"Para ti" = cronológico** en la beta. El ranking llega en la fase 3.
- Las tablas antiguas `cities`, `places`, `posts` y `trip_participants` (vacías, de un andamiaje anterior) no se usan; se pueden borrar cuando quieras.

## Hoja de ruta

### Fase 2 — QR → foto → chincheta (lo siguiente)
1. Tabla `qr_codes (code, place_id, scrapbook_id, created_by)`: cada pegatina/QR físico apunta a un lugar y, opcionalmente, a un scrapbook.
2. Escanear abre `/q/<code>` → si no hay sesión, entrar; después, **cámara o subir foto** directamente.
3. La foto se publica en la chincheta del lugar (`social_posts.place_id`) y se añade sola a una **librería del scrapbook** asociado (`scrapbook_library_items (scrapbook_id, post_id | asset_id, added_by)`), desde donde se arrastra al lienzo.
4. Recompensa UGC: sumar `ugc_points` al publicar desde un QR (ya existe `ugc_claims`).

### Fase 3 — Crecer
- **Notificaciones** (likes, comentarios, seguidores, menciones) con tabla `notifications` + triggers, y campana en el dock.
- **Búsqueda**: personas, lugares y #etiquetas (tabla `hashtags` + `post_hashtags`).
- **Ranking de "Para ti"**: afinidad (a quién sigues/con quién interactúas), lugares seguidos, frescura y popularidad.
- **Contadores guardados** con triggers e índices para que el feed siga rápido.
- **Vídeo serio**: transcodificación y miniaturas (Cloudflare Stream o Mux), HLS, límite de duración por plan.
- **Lugares nuevos** creados por la gente con geocodificación (Nominatim/Mapbox) y moderación.

### Fase 4 — Confianza y seguridad
- Denunciar publicaciones/comentarios y bloquear cuentas; cola de moderación.
- Cuentas privadas con **solicitudes de seguimiento**.
- Límite de publicaciones/comentarios por minuto (contra spam) y filtro de contenido sensible en las subidas.
- Exportar/borrar mis datos de la comunidad (RGPD), enlazado con la página de privacidad.

### Más adelante
Mensajes directos, historias de 24 h por lugar, colecciones de guardados, colaboraciones (post con varios autores), estadísticas para creadores.
