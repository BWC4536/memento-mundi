/**
 * Cámara del cuaderno infinito.
 *
 * Un punto del mundo (unidades de la composición) se ve en pantalla en
 * `world * zoom + (x, y)`, donde (x, y) es la posición en px del origen del
 * mundo respecto a la esquina superior izquierda del visor. Todo son funciones
 * puras para poder testearlas sin navegador.
 */
import { clamp, LIMITS, type Rect } from "./composition";

export type Camera = { zoom: number; x: number; y: number };
export type Size = { width: number; height: number };
export type ScreenPoint = { x: number; y: number };

export const DEFAULT_CAMERA: Camera = { zoom: 1, x: 0, y: 0 };

export const clampZoom = (zoom: number) => clamp(zoom, LIMITS.canvasZoom.min, LIMITS.canvasZoom.max);

export function screenToWorld(camera: Camera, point: ScreenPoint) {
  return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom };
}

export function worldToScreen(camera: Camera, point: { x: number; y: number }): ScreenPoint {
  return { x: point.x * camera.zoom + camera.x, y: point.y * camera.zoom + camera.y };
}

/** Zoom manteniendo fijo bajo el cursor/dedos el punto `anchor` (px del visor). */
export function zoomCameraAt(camera: Camera, nextZoom: number, anchor: ScreenPoint): Camera {
  const zoom = clampZoom(nextZoom);
  const world = screenToWorld(camera, anchor);
  return { zoom, x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom };
}

export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

/** Zona del mundo visible en el visor. */
export function visibleWorldRect(camera: Camera, viewport: Size): Rect {
  const topLeft = screenToWorld(camera, { x: 0, y: 0 });
  return { x: topLeft.x, y: topLeft.y, width: viewport.width / camera.zoom, height: viewport.height / camera.zoom };
}

export type FitOptions = {
  /** Margen en px alrededor del contenido. */
  padding?: number;
  /** Zoom máximo al encuadrar (para no ampliar una sola foto a pantalla completa). */
  maxZoom?: number;
  /** Espacio ocupado por la interfaz flotante (p. ej. la barra inferior en móvil). */
  insets?: { top?: number; right?: number; bottom?: number; left?: number };
};

/** Cámara que encuadra `bounds` centrado dentro del visor. */
export function fitCamera(bounds: Rect, viewport: Size, { padding = 32, maxZoom = 1, insets = {} }: FitOptions = {}): Camera {
  const top = insets.top ?? 0;
  const left = insets.left ?? 0;
  const availableWidth = Math.max(1, viewport.width - left - (insets.right ?? 0) - padding * 2);
  const availableHeight = Math.max(1, viewport.height - top - (insets.bottom ?? 0) - padding * 2);
  const zoom = clampZoom(Math.min(maxZoom, availableWidth / Math.max(1, bounds.width), availableHeight / Math.max(1, bounds.height)));
  const centerX = left + padding + availableWidth / 2;
  const centerY = top + padding + availableHeight / 2;
  return { zoom, x: centerX - (bounds.x + bounds.width / 2) * zoom, y: centerY - (bounds.y + bounds.height / 2) * zoom };
}

/** Cámara que centra un punto del mundo en el visor (con un desplazamiento vertical opcional en px). */
export function centerCameraOn(camera: Camera, point: { x: number; y: number }, viewport: Size, verticalBias = 0): Camera {
  return { ...camera, x: viewport.width / 2 - point.x * camera.zoom, y: viewport.height / 2 + verticalBias - point.y * camera.zoom };
}

/**
 * Escala del patrón del papel (puntos, cuadrícula…). Al alejar mucho la
 * cámara el patrón se agrupa en celdas el doble de grandes para no convertirse
 * en ruido; siempre en potencias de 2, así las líneas siguen coincidiendo.
 */
export function patternScale(zoom: number, cell = 36, minCellPx = 14) {
  let scale = zoom;
  while (scale * cell < minCellPx) scale *= 2;
  return scale;
}
