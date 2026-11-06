
# Plan: Flujo de scrapbook y escáner QR

- [x] Revisar el detalle y el editor actuales para separar claramente Ver y Editar.
- [x] Convertir el click del scrapbook en una vista fotográfica limpia con botones Editar/Ver.
- [x] Mejorar el visor fullscreen con X, arrastre y controles móviles.
- [x] Corregir edición de texto y diseño para que funcionen en móvil.
- [x] Crear sección Elementos con marcos que se ajusten a la foto y controles de escala/filtros.
- [x] Recuperar cámara y QR en el botón Escanear con BarcodeDetector y fallback manual.
- [x] Añadir pruebas de los estados del editor y ejecutar check, tests, build y verificación responsive.

Comprobado en navegador: abrir scrapbook muestra únicamente la foto con `Editar` y `Ver`; `Ver` abre fullscreen y `X` lo cierra; el Dock permanece visible; `Escanear` abre cámara/QR con fallback manual; el editor muestra Elementos, marcos y controles móviles.
