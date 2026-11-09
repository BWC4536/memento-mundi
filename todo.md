
# Plan: Hero de tienda con pegatina 3D controlada por scroll
- [x] Inspeccionar duración, dimensiones y fotogramas del vídeo proporcionado.
- [x] Alojar el vídeo sin ruido como asset web del proyecto.
- [x] Sustituir el hero inicial de tienda por una escena sticky con vídeo y profundidad 3D.
- [x] Vincular el progreso del scroll al tiempo del vídeo, reversible al subir.
- [x] Hacer que al completar el despegado la tienda quede accesible con continuidad natural.
- [x] Ajustar responsive, accesibilidad, prefers-reduced-motion, tests y build.

Validación manual: a 62% de scroll el vídeo estaba en 4.96s de 8s; al volver arriba regresó a 0s. El vídeo publicado no contiene pista de audio.

Modo de movimiento reducido implementado: el vídeo queda congelado al inicio, se eliminan el scrubbing, el rebote y las transformaciones 3D; `StickerScrollHero.test.ts` cubre el clamping y el estado reducido. Validación final: 13 tests, TypeScript y build correctos.
