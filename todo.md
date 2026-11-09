
# Plan: Hero de vídeo puro y recorrido bloqueado hasta el despegado
- [x] Eliminar fondo decorativo, glow, barra y cualquier overlay del hero.
- [x] Mantener únicamente el vídeo centrado como protagonista.
- [x] Aumentar el tramo sticky para que los packs no aparezcan antes del final.
- [x] Ajustar la interpolación para que el seguimiento sea más fluido y reversible.
- [x] Verificar desktop/móvil, scroll completo, tests y build; guardar checkpoint.

Prueba manual: al 72% del recorrido el vídeo estaba en 7.02s; al 86% llegó a 8s y la sección no liberó los packs antes de completar el despegado; al volver arriba regresó a 0s.
