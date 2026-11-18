import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { clamp } from "@/lib/composition";

/** Vista: zoom y desplazamiento (px) del centro del contenido respecto al centro del contenedor. */
export type PanZoomView = { zoom: number; x: number; y: number };

export const DEFAULT_VIEW: PanZoomView = { zoom: 1, x: 0, y: 0 };

/** Zoom manteniendo fijo el punto `point` (px relativos al centro del contenedor). */
export function zoomAround(view: PanZoomView, nextZoom: number, point: { x: number; y: number }, limits: { min: number; max: number }): PanZoomView {
  const zoom = clamp(nextZoom, limits.min, limits.max);
  const ratio = zoom / view.zoom;
  return { zoom, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio };
}

/** Evita perder el contenido: siempre queda al menos una parte visible. */
export function clampPan(view: PanZoomView, content: { width: number; height: number }, container: { width: number; height: number }): PanZoomView {
  if (!container.width || !content.width) return view;
  const maxX = Math.max(0, (content.width * view.zoom - container.width) / 2) + container.width * 0.35;
  const maxY = Math.max(0, (content.height * view.zoom - container.height) / 2) + container.height * 0.35;
  return { zoom: view.zoom, x: clamp(view.x, -maxX, maxX), y: clamp(view.y, -maxY, maxY) };
}

type Options = {
  limits: { min: number; max: number };
  /** Tamaño del contenido a zoom 1 y del contenedor, para limitar el desplazamiento. */
  content: { width: number; height: number };
  container: { width: number; height: number };
};

/**
 * Pan con un dedo/ratón, pinch con dos dedos y rueda (zoom) en desktop.
 * Usa Pointer Events, así funciona igual con touch, ratón y lápiz.
 */
export function usePanZoom(targetRef: RefObject<HTMLElement | null>, { limits, content, container }: Options) {
  const [view, setViewState] = useState<PanZoomView>(DEFAULT_VIEW);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: "pan"; startX: number; startY: number; view: PanZoomView }
    | { kind: "pinch"; distance: number; mid: { x: number; y: number }; view: PanZoomView }
    | null
  >(null);
  const sizes = useRef({ content, container });
  sizes.current = { content, container };

  const setView = useCallback((updater: PanZoomView | ((view: PanZoomView) => PanZoomView)) => {
    setViewState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return clampPan(next, sizes.current.content, sizes.current.container);
    });
  }, []);

  const relativePoint = useCallback((clientX: number, clientY: number) => {
    const rect = targetRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }, [targetRef]);

  const startGesture = useCallback((current: PanZoomView) => {
    const points = Array.from(pointers.current.values());
    if (points.length >= 2) {
      const [a, b] = points;
      gesture.current = { kind: "pinch", distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: relativePoint((a.x + b.x) / 2, (a.y + b.y) / 2), view: current };
    } else if (points.length === 1) {
      gesture.current = { kind: "pan", startX: points[0].x, startY: points[0].y, view: current };
    } else {
      gesture.current = null;
    }
  }, [relativePoint]);

  const viewRef = useRef(view);
  viewRef.current = view;

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if ((event.target as HTMLElement).closest("button, a, input")) return;
    if (event.isPrimary) pointers.current.clear();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    startGesture(viewRef.current);
    setDragging(true);
  }, [startGesture]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = gesture.current;
    if (!current) return;
    if (current.kind === "pan") {
      setView({ ...current.view, x: current.view.x + event.clientX - current.startX, y: current.view.y + event.clientY - current.startY });
    } else {
      const [a, b] = Array.from(pointers.current.values());
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = relativePoint((a.x + b.x) / 2, (a.y + b.y) / 2);
      const zoomed = zoomAround(current.view, current.view.zoom * (distance / current.distance), current.mid, limits);
      setView({ ...zoomed, x: zoomed.x + mid.x - current.mid.x, y: zoomed.y + mid.y - current.mid.y });
    }
  }, [limits, relativePoint, setView]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    pointers.current.delete(event.pointerId);
    startGesture(viewRef.current);
    if (pointers.current.size === 0) setDragging(false);
  }, [startGesture]);

  useEffect(() => {
    const node = targetRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0012));
      const point = relativePoint(event.clientX, event.clientY);
      setView((current) => zoomAround(current, current.zoom * factor, point, limits));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [limits, relativePoint, setView, targetRef]);

  const zoomBy = useCallback((factor: number) => setView((current) => zoomAround(current, current.zoom * factor, { x: 0, y: 0 }, limits)), [limits, setView]);
  const reset = useCallback(() => setView(DEFAULT_VIEW), [setView]);

  return {
    view,
    setView,
    dragging,
    zoomBy,
    reset,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
