# Editor visual de scrapbooks

## Flujo

```
Home (tarjetas con la portada como miniatura)
  → seleccionar scrapbook            (Home guarda el id, no una copia)
  → vista previa                     ScrapbookPhotoView: composición completa + Editar / Ver
  → Editar                           InfiniteCanvasEditor({ scrapbook, initialComposition, onSave, onClose })
  → Guardar cambios                  onSave(composition) → Home actualiza el scrapbook + localStorage
  → X                                cerrar (si hay cambios sin guardar pide confirmación)
  → vista previa y Ver               leen la misma composición del estado de Home
```

La composición vive en el estado compartido de Home (`Scrapbook.composition`), nunca solo dentro del editor.
Editor, vista previa y pantalla completa usan el mismo renderizador (`CompositionCanvas`), así que muestran exactamente lo mismo.

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| `client/src/lib/composition.ts` | Modelo (`ScrapbookComposition`, `CanvasElement`, `PhotoFilter`), límites y operaciones puras (texto, fotos, marcos, filtros, capas, validación). |
| `client/src/lib/composition-presets.ts` | Formatos de lienzo, fondos, texturas, marcos generales y presets visuales. |
| `client/src/lib/editor-history.ts` | Reducer del editor con deshacer/rehacer. |
| `client/src/lib/editor-snap.ts` | Guías de alineación e imán de rotación. |
| `client/src/lib/composition-storage.ts` | Guardado temporal en localStorage. |
| `client/src/lib/scrapbook-library.ts` | Estado compartido de scrapbooks: hidratar, aplicar y persistir composiciones. |
| `client/src/lib/image-upload.ts` | Validación de formatos, conversión HEIC/HEIF y compresión en cliente. |
| `client/src/lib/supabase-composition.ts` | Mapeo composición ↔ filas de Supabase (preparado, no conectado). |
| `client/src/components/scrapbook/CompositionCanvas.tsx` | Renderizador único. |
| `client/src/components/scrapbook/CompositionViewer.tsx` | Vista "Ver" a pantalla completa con arrastre y zoom. |
| `client/src/components/scrapbook/decorations.tsx` | Catálogo SVG del panel Elementos. |
| `client/src/components/editor/EditorStage.tsx` | Lienzo interactivo: selección, mover, escalar, rotar, pinch, pan, guías. |
| `client/src/components/editor/EditorPanels.tsx` | Paneles Diseño, Elementos, Fotos, Texto, Filtros, Capas y Ajustes. |
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

## Supabase (preparado, no conectado)

1. Ejecutar `docs/supabase-schema.sql`, `001_scrapbook_canvas.sql` y `002_scrapbook_editor.sql`, en ese orden.
2. Subir cada foto al bucket privado `scrapbook-media` con la ruta `<scrapbook_id>/<user_id>/<asset_id>.<ext>` (`buildAssetStoragePath`) y registrar una fila en `scrapbook_assets`.
3. Sustituir el `src` de cada data URL por la URL firmada o pública. `compositionToRows` se niega a guardar data URLs, para que nunca lleguen bytes a la base de datos.
4. Guardar la página con `compositionToRows` y leerla con `rowsToComposition`.
5. Sustituir `persistComposition` / `hydrateScrapbooks` (`scrapbook-library.ts`) por llamadas a Supabase, manteniendo localStorage como caché offline si se desea.
