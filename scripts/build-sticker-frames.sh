#!/usr/bin/env bash
# Genera las secuencias de fotogramas de la intro de /store a partir de un vídeo.
#
#   scripts/build-sticker-frames.sh <video> [segundo_final]
#
# - landscape: 1920x1080 (PC, tablets en horizontal), 24 fps.
# - portrait:  720x1440 (móvil en vertical), el vídeo a todo el ancho y centrado, con los bordes
#   del papel prolongados y desenfocados arriba y abajo para que no se note el corte.
# Escribe las imágenes en client/public/sticker-frames/ y los recuentos en
# client/src/lib/sticker-frames.generated.ts.
#
# Requiere ffmpeg y ffprobe (variables FFMPEG / FFPROBE para indicar la ruta si no están en el PATH).
set -euo pipefail

INPUT="${1:?Uso: scripts/build-sticker-frames.sh <video> [segundo_final]}"
END="${2:-}"
FFMPEG="${FFMPEG:-ffmpeg}"
FFPROBE="${FFPROBE:-$(dirname "$(command -v "$FFMPEG")")/ffprobe}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/client/public/sticker-frames"
MODULE="$ROOT/client/src/lib/sticker-frames.generated.ts"

TRIM=""
if [ -n "$END" ]; then TRIM="trim=end=$END,setpts=PTS-STARTPTS,"; fi

# Alto del vídeo al ancho del móvil (redondeado a par) y relleno arriba/abajo hasta 1440.
IFS=x read -r SRC_W SRC_H < <("$FFPROBE" -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$INPUT" | tr -d '\r')
FG_H=$(( (720 * SRC_H / SRC_W + 1) / 2 * 2 ))
# Par: en yuv420 ffmpeg redondea los desplazamientos impares y dejaría una fila negra.
PAD_TOP=$(( (1440 - FG_H) / 4 * 2 ))
PAD_BOTTOM=$(( 1440 - FG_H - PAD_TOP ))

rm -rf "$OUT"
mkdir -p "$OUT/landscape" "$OUT/portrait"

echo "→ landscape 1920x1080"
"$FFMPEG" -v error -y -i "$INPUT" -an \
  -vf "${TRIM}fps=24,scale=1920:1080:flags=lanczos,unsharp=5:5:0.45:5:5:0" \
  -c:v libwebp -quality 86 -compression_level 6 "$OUT/landscape/%03d.webp"
LANDSCAPE=$(find "$OUT/landscape" -name '*.webp' | wc -l | tr -d ' ')

echo "→ portrait 720x1440 (vídeo 720x$FG_H)"
# Fondo fijo: el último fotograma (papel limpio, sin el rollo) con sus bordes prolongados y desenfocados.
# Si se hiciera con cada fotograma, el rollo dejaría una franja al pasar por el borde.
BG_PNG="$(mktemp -d)/portrait-bg.png"
if [ -n "$END" ]; then BG_SEEK=(-ss "$(awk "BEGIN { print $END - 0.1 }")"); else BG_SEEK=(-sseof -0.1); fi
"$FFMPEG" -v error -y "${BG_SEEK[@]}" -i "$INPUT" -frames:v 1 -update 1 \
  -vf "scale=720:$FG_H:flags=lanczos,pad=720:1440:0:$PAD_TOP,fillborders=top=$PAD_TOP:bottom=$PAD_BOTTOM:mode=smear,boxblur=luma_radius=180:luma_power=3:chroma_radius=170:chroma_power=3" \
  "$BG_PNG"

"$FFMPEG" -v error -y -i "$INPUT" -loop 1 -i "$BG_PNG" -an -filter_complex "
  [0:v]${TRIM}fps=24,scale=720:$FG_H:flags=lanczos,unsharp=5:5:0.35:5:5:0,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*min(1,min(Y,H-1-Y)/(H*0.14))'[fg];
  [1:v][fg]overlay=0:$PAD_TOP:shortest=1,format=yuv420p" \
  -frames:v "$LANDSCAPE" -c:v libwebp -quality 84 -compression_level 6 "$OUT/portrait/%03d.webp"
rm -f "$BG_PNG"

PORTRAIT=$(find "$OUT/portrait" -name '*.webp' | wc -l | tr -d ' ')

cat > "$MODULE" <<TS
// Archivo generado por scripts/build-sticker-frames.sh. No editar a mano.
export const STICKER_FRAME_SETS = {
  landscape: { dir: "/sticker-frames/landscape", count: $LANDSCAPE, width: 1920, height: 1080 },
  portrait: { dir: "/sticker-frames/portrait", count: $PORTRAIT, width: 720, height: 1440 },
} as const;
TS

echo "landscape: $LANDSCAPE fotogramas, $(du -sh "$OUT/landscape" | cut -f1)"
echo "portrait:  $PORTRAIT fotogramas, $(du -sh "$OUT/portrait" | cut -f1)"
