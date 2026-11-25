# Editor visual de scrapbooks: cuaderno infinito

## Flujo

```
Home (tarjetas con la portada como miniatura)
  → seleccionar scrapbook            /?scrapbook=<id> · vista previa con Editar / Ver
  → Editar                           /scrapbooks/<id> → ScrapbookEditorPage → InfiniteCanvasEditor
  → Guardar                          onSave(composition) → Supabase (o localStorage en modo local)
  → X                                vuelve a /?scrapbook=<id> (si hay cambios sin guardar pide confirmación)
```

Editor, vista previa y pantalla completa pintan cada elemento con el mismo componente (`ElementNode`), así que muestran exactamente lo mismo.

## Cuaderno infinito

- **Sin bordes.** Los elementos pueden estar en cualquier coordenada, también negativa. `canvas.width × canvas.height` (1200 × 900) ya no es un borde: es la zona donde arranca un cuaderno vacío y la escala de los tamaños por defecto. Las columnas `width`/`height` de `scrapbook_pages` se siguen rellenando con ese valor.
- **Cámara** (`client/src/lib/camera.ts`): `pantalla = mundo × zoom + (x, y)`. Zoom de 10 % a 400 %. Al abrir se encuadra todo el contenido; la cámara no se guarda.
- **Vistas previas:** `getContentBounds` encuadra todos los elementos visibles con margen y limita la proporción a 2,4:1 para que una fila muy larga no quede como una tira.
- **Papel:** color + patrón (puntos, cuadrícula, rayas, papel, kraft), anclado al origen del cuaderno para que se vea igual al moverse. Al alejar mucho, el patrón agrupa celdas para no convertirse en ruido. Ya no hay formatos de página ni "marco general"; el valor `frame` antiguo se conserva en los datos pero no se pinta.
- **Notas breves:** texto con `textStyle.variant = "note"` (papel de color, letra manuscrita, ligeramente torcido). Se guarda en `style_json`, sin migración.

### Gestos

| Acción | Táctil | Escritorio |
| --- | --- | --- |
| Moverse | arrastrar el papel, o dos dedos | arrastrar el papel, rueda/trackpad, Espacio + arrastrar, botón central |
| Zoom | pellizcar | Ctrl/⌘ + rueda, pinch del trackpad, `+` / `−` |
| Ver todo | botón ⤢ | botón ⤢ o `0` |
| Nota nueva | doble toque en el papel, botón Nota | doble clic en el papel, botón Nota o `N` |
| Mover / girar / escalar | arrastrar, asas, pellizcar sobre el elemento | arrastrar, asas, flechas |

### NFC / QR

El hardware NFC/QR es del viaje, no de una foto: la pegatina física abre el scrapbook (escáner de Home y tienda). El editor no tiene ningún elemento NFC.

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| `client/src/lib/composition.ts` | Modelo (`ScrapbookComposition`, `CanvasElement`, `PhotoFilter`), límites, encuadre del contenido y operaciones puras (texto, notas, fotos, marcos, filtros, capas, validación). |
| `client/src/lib/camera.ts` | Cámara del cuaderno infinito: pantalla ↔ mundo, zoom anclado, encuadre. |
| `client/src/lib/composition-presets.ts` | Colores y patrones del papel, presets y marcos de foto. |
| `client/src/lib/editor-history.ts` | Reducer del editor con deshacer/rehacer. |
| `client/src/lib/editor-snap.ts` | Guías de alineación e imán de rotación. |
| `client/src/lib/composition-storage.ts` | Guardado temporal en localStorage. |
| `client/src/lib/scrapbook-library.ts` | Estado compartido de scrapbooks: hidratar, aplicar y persistir composiciones. |
| `client/src/lib/image-upload.ts` | Validación de formatos, conversión HEIC/HEIF y compresión en cliente. |
| `client/src/lib/supabase-composition.ts` | Mapeo composición ↔ filas de Supabase (preparado, no conectado). |
| `client/src/components/scrapbook/CompositionCanvas.tsx` | Renderizador único (`ElementNode`, `PaperTexture`) y vista estática encuadrada. |
| `client/src/components/scrapbook/CompositionViewer.tsx` | Vista "Ver" a pantalla completa con arrastre y zoom. |
| `client/src/components/scrapbook/decorations.tsx` | Catálogo SVG del panel Elementos. |
| `client/src/components/editor/EditorStage.tsx` | Cuaderno interactivo: cámara, selección, mover, escalar, rotar, pinch, guías, doble toque = nota. |
| `client/src/components/editor/EditorPanels.tsx` | Paneles Fotos, Texto (notas y títulos), Decorar, Capas, Papel, Filtros y Ajustes. |
| `client/src/pages/ScrapbookEditorPage.tsx` | Ruta `/scrapbooks/:id`: carga el scrapbook y abre el editor. |
| `docs/supabase/002_scrapbook_editor.sql` | Migración aditiva con tablas, columnas, RLS y Storage. |

## Fotos HEIC/HEIF

- Safari las lee de forma nativa. En Chrome, Firefox y Android se convierten a JPEG en el navegador con `heic-to` (libheif en WebAssembly).
- La librería pesa unos 3 MB y se descarga solo la primera vez que alguien sube una foto HEIC, en un chunk aparte.
- También se detectan HEIC con extensión equivocada mirando los bytes del archivo.
- Si la conversión falla, el editor muestra un mensaje en español con la alternativa de exportar a JPG.
- `heic-to` usa licencia LGPL-3.0 (la de libheif). Se carga como módulo separado y sin modificar.

## Almacenamiento temporal (prototipo)

**Mientras Supabase no esté conectado, el guardado es temporal y local a cada navegador.**

- Clave por scrapbook: `memento-mundi:scrapbook:{id}:composition`.
- Los scrapbooks creados por el usuario se guardan en `memento-mundi:scrapbooks:custom` (solo metadatos).
- Las fotos subidas se redimensionan a 1600 px como máximo y se comprimen a WebP (o JPEG) antes de guardarse como data URL. Esto es solo para el prototipo.
- localStorage suele tener unos 5 MB por dominio. Si se llena, la composición sigue en memoria durante la sesión y el editor avisa de que no se pudo guardar la copia local.
- Borrar los datos del navegador borra estas composiciones.

## Supabase

Proyecto `MementoMundi` (`https://iurldpjhpjkfpnabllxa.supabase.co`). La app lo usa cuando existen `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (`.env.local` en local, Environment Variables en Vercel; ver `.env.example`). Sin esas variables funciona en modo local con los scrapbooks de demo.

Migraciones aplicadas el 18 nov 2026: `002_scrapbook_editor.sql` y `003_harden_functions.sql`.

### Cómo funciona

- **Login:** Supabase Auth por email, sin contraseña. Se envía un código de 6 dígitos o un enlace mágico (`client/src/lib/supabase/auth.ts`, `LoginDialog.tsx`). La sesión se guarda en el navegador y se renueva sola.
- **Datos:** `client/src/lib/supabase/scrapbook-repository.ts` lista, crea y borra scrapbooks y guarda la composición en `scrapbook_pages` + `scrapbook_elements`.
- **Fotos:** al guardar, cada foto nueva se sube al bucket privado `scrapbook-media` (`<scrapbook_id>/<user_id>/<asset_id>.<ext>`) y se registra en `scrapbook_assets`. La base de datos solo guarda la referencia `storage://scrapbook-media/<ruta>`; al cargar se convierte en URL firmada (7 días).
- **Portada:** la primera foto de la composición pasa a ser la portada del scrapbook.
- **Sin conexión:** si falla el guardado, la composición se conserva en este dispositivo (localStorage) y el editor avisa; al volver a guardar con conexión se sincroniza.
- **Cliente propio:** se usa `fetch` contra la API REST de Supabase en lugar de `@supabase/supabase-js` para no añadir dependencias (el disco del proyecto es exFAT y pnpm no puede enlazarlas).

### Configuración pendiente en el panel de Supabase

1. **Authentication › URL Configuration:** Site URL `https://memento-mundi-nine.vercel.app` y en Redirect URLs `https://memento-mundi-nine.vercel.app/**`, los dominios de preview de Vercel y `http://localhost:*/**`. Sin esto el enlace mágico no vuelve a la app.
2. **Authentication › Email Templates › Magic Link:** añadir `{{ .Token }}` al texto para que el email incluya el código de 6 dígitos (por defecto solo trae el enlace).
3. **Authentication › SMTP Settings:** el servicio de email incluido en Supabase tiene un límite muy bajo y solo envía a miembros del equipo del proyecto. Para usuarios reales hace falta un SMTP propio (Resend, Postmark, SES...).

### Limitaciones conocidas

- Un cuaderno por scrapbook (la tabla de páginas admite varias; la interfaz edita la primera).
- En modo local (sin Supabase), si localStorage está lleno al guardar, los cambios solo viven en memoria y se pierden al salir del editor.
- Edición simultánea: gana el último en guardar; no hay tiempo real.
- Al guardar, `created_by` de cada elemento pasa a ser quien guarda.
- Los scrapbooks creados antes en modo local (navegador) no se migran solos a la nube.
