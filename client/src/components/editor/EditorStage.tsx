import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Lock, RotateCw } from "lucide-react";
import {
  clampCanvasZoom,
  clampElementScale,
  findElement,
  getOuterSize,
  LIMITS,
  normalizeCrop,
  normalizeRotation,
  updateElement,
  type CanvasElement,
  type ScrapbookComposition,
} from "@/lib/composition";
import { snapPosition, snapRotation, type SnapGuides } from "@/lib/editor-snap";
import { useElementSize } from "@/hooks/useElementSize";
import { zoomAround, type PanZoomView } from "@/hooks/usePanZoom";
import CompositionCanvas from "@/components/scrapbook/CompositionCanvas";

export type StageApi = {
  /** Centro de la zona visible, en unidades del lienzo. */
  visibleCenter: () => { x: number; y: number };
  /** Desplaza la vista para que el elemento quede visible (p. ej. por encima del teclado). */
  revealElement: (id: string, verticalBias?: number) => void;
};

type Props = {
  composition: ScrapbookComposition;
  selectedId: string | null;
  view: PanZoomView;
  onViewChange: (updater: (view: PanZoomView) => PanZoomView) => void;
  onSelect: (id: string | null) => void;
  onBeginChange: () => void;
  onChange: (update: (composition: ScrapbookComposition) => ScrapbookComposition) => void;
  onEditText: (id: string) => void;
  onFillFrame: (id: string) => void;
  cropMode: boolean;
  snapEnabled: boolean;
  emptyState?: ReactNode;
  apiRef?: React.MutableRefObject<StageApi | null>;
  /** Espacio reservado abajo (toolbar móvil) para calcular el encuadre. */
  bottomInset?: number;
};

type Gesture =
  | { kind: "pan"; startX: number; startY: number; view: PanZoomView; moved: boolean; background: boolean }
  | { kind: "move"; id: string; startX: number; startY: number; origin: { x: number; y: number }; moved: boolean; wasSelected: boolean; locked: boolean }
  | { kind: "crop"; id: string; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean }
  | { kind: "scale"; id: string; center: { x: number; y: number }; startDistance: number; startScale: number; moved: boolean }
  | { kind: "rotate"; id: string; center: { x: number; y: number }; startAngle: number; startRotation: number; moved: boolean }
  | { kind: "pinch-canvas"; distance: number; mid: { x: number; y: number }; view: PanZoomView }
  | { kind: "pinch-element"; id: string; distance: number; angle: number; startScale: number; startRotation: number };

const ZOOM_LIMITS = LIMITS.canvasZoom;
const TAP_SLOP = 4;
const deg = (radians: number) => (radians * 180) / Math.PI;

export default function EditorStage({
  composition,
  selectedId,
  view,
  onViewChange,
  onSelect,
  onBeginChange,
  onChange,
  onEditText,
  onFillFrame,
  cropMode,
  snapEnabled,
  emptyState,
  apiRef,
  bottomInset = 0,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const viewport = useElementSize(viewportRef);
  const { width: W, height: H } = composition.canvas;
  const aspect = W / H;
  const padding = viewport.width < 640 ? 18 : 48;
  const availableHeight = Math.max(0, viewport.height - bottomInset);
  const fitWidth = Math.max(0, Math.min(viewport.width - padding * 2, (availableHeight - padding * 2) * aspect));
  const stageWidth = fitWidth * view.zoom;
  const k = stageWidth > 0 ? stageWidth / W : 1;
  const offsetY = -bottomInset / 2;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const [guides, setGuides] = useState<SnapGuides>({ vertical: [], horizontal: [] });
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  const latest = useRef({ composition, selectedId, view, k, snapEnabled, cropMode, measuredHeight });
  latest.current = { composition, selectedId, view, k, snapEnabled, cropMode, measuredHeight };

  const selected = findElement(composition, selectedId);

  // Alto real del texto seleccionado (su caja es "auto"), para dibujar la selección justa.
  useLayoutEffect(() => {
    if (!selected || selected.type !== "text" || !stageRef.current) {
      setMeasuredHeight(null);
      return;
    }
    const node = stageRef.current.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(selected.id)}"]`);
    if (node && k > 0) setMeasuredHeight(node.offsetHeight / k);
  }, [selected, k]);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      visibleCenter: () => {
        const { view: v, k: scale, composition: c } = latest.current;
        return { x: c.canvas.width / 2 - v.x / scale, y: c.canvas.height / 2 - (v.y - offsetY) / scale };
      },
      revealElement: (id, verticalBias = 0) => {
        const { composition: c, k: scale } = latest.current;
        const element = findElement(c, id);
        if (!element) return;
        const outer = getOuterSize(element);
        const relX = (element.x + outer.width / 2 - c.canvas.width / 2) * scale;
        const relY = (element.y + outer.height / 2 - c.canvas.height / 2) * scale;
        onViewChange((current) => ({ ...current, x: -relX, y: verticalBias - relY }));
      },
    };
  }, [apiRef, offsetY, onViewChange]);

  const pointerToStage = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 - offsetY };
  }, [offsetY]);

  const twoPointerMetrics = () => {
    const [a, b] = Array.from(pointers.current.values());
    return { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, angle: deg(Math.atan2(b.y - a.y, b.x - a.x)), mid: pointerToStage((a.x + b.x) / 2, (a.y + b.y) / 2) };
  };

  const startPinch = () => {
    const { composition: c, view: v } = latest.current;
    const current = gesture.current;
    const metrics = twoPointerMetrics();
    const targetId = current && (current.kind === "move" || current.kind === "scale" || current.kind === "rotate") ? current.id : null;
    const target = findElement(c, targetId);
    if (target && !target.locked) {
      onBeginChange();
      gesture.current = { kind: "pinch-element", id: target.id, distance: metrics.distance, angle: metrics.angle, startScale: target.scale, startRotation: target.rotation };
    } else {
      gesture.current = { kind: "pinch-canvas", distance: metrics.distance, mid: metrics.mid, view: v };
    }
    setGuides({ vertical: [], horizontal: [] });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, select, [data-stage-ui]")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Un primer dedo/clic nuevo empieza una interacción limpia (evita punteros "colgados").
    if (event.isPrimary) {
      pointers.current.clear();
      gesture.current = null;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      startPinch();
      return;
    }
    if (pointers.current.size > 2) return;

    const { composition: c, selectedId: currentSelected, view: v, cropMode: crop } = latest.current;
    const handle = target.closest<HTMLElement>("[data-handle]");
    const handleKind = handle?.dataset.handle;
    const selectionRect = selectionRef.current?.getBoundingClientRect();
    const center = selectionRect ? { x: selectionRect.left + selectionRect.width / 2, y: selectionRect.top + selectionRect.height / 2 } : { x: event.clientX, y: event.clientY };
    const current = findElement(c, currentSelected);

    if (current && handleKind === "scale" && !current.locked) {
      gesture.current = { kind: "scale", id: current.id, center, startDistance: Math.hypot(event.clientX - center.x, event.clientY - center.y) || 1, startScale: current.scale, moved: false };
      return;
    }
    if (current && handleKind === "rotate" && !current.locked) {
      gesture.current = { kind: "rotate", id: current.id, center, startAngle: deg(Math.atan2(event.clientY - center.y, event.clientX - center.x)), startRotation: current.rotation, moved: false };
      return;
    }

    const elementId = handleKind === "move" ? currentSelected : target.closest<HTMLElement>("[data-element-id]")?.dataset.elementId ?? null;
    const element = findElement(c, elementId);
    if (element) {
      if (crop && element.id === currentSelected && element.type === "photo" && !element.locked) {
        const cropState = normalizeCrop(element.crop);
        gesture.current = { kind: "crop", id: element.id, startX: event.clientX, startY: event.clientY, offsetX: cropState.offsetX, offsetY: cropState.offsetY, moved: false };
        return;
      }
      const wasSelected = element.id === currentSelected;
      if (!wasSelected) onSelect(element.id);
      gesture.current = { kind: "move", id: element.id, startX: event.clientX, startY: event.clientY, origin: { x: element.x, y: element.y }, moved: false, wasSelected, locked: !!element.locked };
      return;
    }

    gesture.current = { kind: "pan", startX: event.clientX, startY: event.clientY, view: v, moved: false, background: true };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = gesture.current;
    if (!current) return;
    const { composition: c, k: scale, snapEnabled: snap, measuredHeight: textHeight } = latest.current;

    switch (current.kind) {
      case "pan": {
        const dx = event.clientX - current.startX;
        const dy = event.clientY - current.startY;
        if (!current.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
        current.moved = true;
        onViewChange(() => ({ ...current.view, x: current.view.x + dx, y: current.view.y + dy }));
        return;
      }
      case "move": {
        const dxScreen = event.clientX - current.startX;
        const dyScreen = event.clientY - current.startY;
        if (!current.moved && Math.hypot(dxScreen, dyScreen) < TAP_SLOP) return;
        if (current.locked) return;
        if (!current.moved) onBeginChange();
        current.moved = true;
        const element = findElement(c, current.id);
        if (!element) return;
        let next = { x: current.origin.x + dxScreen / scale, y: current.origin.y + dyScreen / scale };
        if (snap && !event.altKey) {
          const result = snapPosition(c, element, next, 7 / scale, element.type === "text" ? textHeight ?? undefined : undefined);
          next = { x: result.x, y: result.y };
          setGuides(result.guides);
        }
        onChange((composition) => updateElement(composition, current.id, next));
        return;
      }
      case "crop": {
        const element = findElement(c, current.id);
        if (!element) return;
        const dx = event.clientX - current.startX;
        const dy = event.clientY - current.startY;
        if (!current.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
        if (!current.moved) onBeginChange();
        current.moved = true;
        const zoom = normalizeCrop(element.crop).zoom;
        const sensitivityX = 2 / Math.max(1, element.width * element.scale * scale * zoom);
        const sensitivityY = 2 / Math.max(1, element.height * element.scale * scale * zoom);
        onChange((composition) => updateElement(composition, current.id, { crop: { ...normalizeCrop(element.crop), offsetX: current.offsetX - dx * sensitivityX, offsetY: current.offsetY - dy * sensitivityY } }));
        return;
      }
      case "scale": {
        const distance = Math.hypot(event.clientX - current.center.x, event.clientY - current.center.y);
        if (!current.moved) onBeginChange();
        current.moved = true;
        const nextScale = clampElementScale(current.startScale * (distance / current.startDistance));
        onChange((composition) => updateElement(composition, current.id, { scale: nextScale }));
        return;
      }
      case "rotate": {
        const angle = deg(Math.atan2(event.clientY - current.center.y, event.clientX - current.center.x));
        if (!current.moved) onBeginChange();
        current.moved = true;
        let rotation = normalizeRotation(current.startRotation + angle - current.startAngle);
        if (!event.altKey) rotation = snapRotation(rotation);
        onChange((composition) => updateElement(composition, current.id, { rotation }));
        return;
      }
      case "pinch-canvas": {
        if (pointers.current.size < 2) return;
        const metrics = twoPointerMetrics();
        const zoomed = zoomAround(current.view, current.view.zoom * (metrics.distance / current.distance), current.mid, ZOOM_LIMITS);
        onViewChange(() => ({ zoom: clampCanvasZoom(zoomed.zoom), x: zoomed.x + metrics.mid.x - current.mid.x, y: zoomed.y + metrics.mid.y - current.mid.y }));
        return;
      }
      case "pinch-element": {
        if (pointers.current.size < 2) return;
        const metrics = twoPointerMetrics();
        const nextScale = clampElementScale(current.startScale * (metrics.distance / current.distance));
        const rotation = snapRotation(normalizeRotation(current.startRotation + metrics.angle - current.angle), 3);
        onChange((composition) => updateElement(composition, current.id, { scale: nextScale, rotation }));
        return;
      }
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    setGuides({ vertical: [], horizontal: [] });

    if (pointers.current.size > 0) {
      // Queda un dedo: termina el pinch y no interpretamos el resto como tap.
      gesture.current = null;
      return;
    }
    gesture.current = null;
    if (!current || event.type === "pointercancel") return;
    const { composition: c } = latest.current;

    if (current.kind === "pan" && !current.moved && current.background) onSelect(null);
    if (current.kind === "move" && !current.moved) {
      // Tap sobre la selección: si hay otro elemento visible justo debajo del dedo, lo seleccionamos.
      const hit = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((node) => (node as HTMLElement).closest<HTMLElement>("[data-element-id]"))
        .find((node): node is HTMLElement => !!node && !!stageRef.current?.contains(node));
      const hitId = hit?.dataset.elementId;
      if (hitId && hitId !== current.id) {
        onSelect(hitId);
        return;
      }
      const element = findElement(c, current.id);
      if (!element || !current.wasSelected) return;
      if (element.type === "text") onEditText(element.id);
      if (element.type === "frame" && !element.src) onFillFrame(element.id);
    }
  };

  // Rueda: Ctrl/⌘ (o pinch del trackpad) hace zoom; la rueda normal desplaza.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const point = pointerToStage(event.clientX, event.clientY);
        const factor = Math.exp(-event.deltaY * 0.01);
        onViewChange((current) => {
          const zoomed = zoomAround(current, current.zoom * factor, point, ZOOM_LIMITS);
          return { ...zoomed, zoom: clampCanvasZoom(zoomed.zoom) };
        });
      } else {
        onViewChange((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [onViewChange, pointerToStage]);

  const selectionBox = selected ? getSelectionBox(selected, W, H, measuredHeight) : null;

  return (
    <div
      ref={viewportRef}
      data-testid="editor-viewport"
      className="relative h-full w-full touch-none overflow-hidden"
      style={{
        backgroundColor: "#132b36",
        backgroundImage: "radial-gradient(rgba(234,231,218,.14) 1px, transparent 1px)",
        backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={(event) => {
        if (pointers.current.has(event.pointerId) && event.buttons === 0) handlePointerUp(event);
      }}
      onDoubleClick={(event) => {
        const id = (event.target as HTMLElement).closest<HTMLElement>("[data-element-id]")?.dataset.elementId;
        const element = findElement(latest.current.composition, id);
        if (element?.type === "text") onEditText(element.id);
      }}
    >
      <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: stageWidth > 0 ? stageWidth : `min(calc(100vw - 40px), calc((100dvh - 220px) * ${aspect}))`,
            transform: `translate(-50%, -50%) translate3d(${view.x}px, ${view.y + offsetY}px, 0)`,
          }}
        >
          <CompositionCanvas
            ref={stageRef}
            composition={composition}
            mode="edit"
            label="Lienzo del editor"
            className="overflow-visible rounded-[6px] shadow-[0_0_0_2px_#0B2130,10px_10px_0_rgba(0,0,0,.35)]"
            style={{ overflow: "visible" }}
            emptyState={emptyState}
          >
            {/* Recorte visual del lienzo sin cortar las asas de selección */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[9998]" style={{ boxShadow: "0 0 0 100vmax rgba(19,43,54,.72)" }} />
            {guides.vertical.map((line) => (
              <span key={`v${line}`} className="pointer-events-none absolute top-0 z-[9999] h-full w-0 border-l-2 border-dashed border-orange" style={{ left: `${(line / W) * 100}%` }} />
            ))}
            {guides.horizontal.map((line) => (
              <span key={`h${line}`} className="pointer-events-none absolute left-0 z-[9999] h-0 w-full border-t-2 border-dashed border-orange" style={{ top: `${(line / H) * 100}%` }} />
            ))}
            {selected && selectionBox ? (
              <div
                ref={selectionRef}
                data-selection-box
                className="absolute z-[10000]"
                style={{
                  left: `${selectionBox.left}%`,
                  top: `${selectionBox.top}%`,
                  width: `${selectionBox.width}%`,
                  height: `${selectionBox.height}%`,
                  transform: `rotate(${selected.rotation}deg)`,
                  pointerEvents: "none",
                }}
              >
                <div
                  data-handle="move"
                  className={`absolute inset-0 rounded-[3px] ${cropMode && selected.type === "photo" ? "cursor-move outline-dashed" : selected.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
                  style={{ outline: `2px ${cropMode && selected.type === "photo" ? "dashed" : "solid"} #FA9223`, outlineOffset: 3, boxShadow: "0 0 0 5px rgba(11,33,48,.55)", pointerEvents: "auto" }}
                />
                {selected.locked ? (
                  <span className="absolute -top-9 left-1/2 flex h-7 -translate-x-1/2 items-center gap-1 rounded-full border-2 border-ink bg-cream px-2 text-[10px] font-black text-ink">
                    <Lock size={12} /> Bloqueado
                  </span>
                ) : (
                  <>
                    <span className="pointer-events-none absolute left-1/2 top-[-34px] h-[30px] w-0 border-l-2 border-orange" />
                    <span data-handle="rotate" aria-label="Rotar" title="Arrastra para rotar" className="absolute left-1/2 top-[-56px] flex h-11 w-11 -translate-x-1/2 cursor-grab items-center justify-center" style={{ pointerEvents: "auto" }}>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink bg-orange text-ink shadow-[2px_2px_0_#0B2130]">
                        <RotateCw size={14} strokeWidth={2.8} />
                      </span>
                    </span>
                    {(["-left-[22px] -top-[22px] cursor-nwse-resize", "-right-[22px] -top-[22px] cursor-nesw-resize", "-left-[22px] -bottom-[22px] cursor-nesw-resize", "-right-[22px] -bottom-[22px] cursor-nwse-resize"] as const).map((position) => (
                      <span key={position} data-handle="scale" aria-label="Cambiar tamaño" className={`absolute flex h-11 w-11 items-center justify-center ${position}`} style={{ pointerEvents: "auto" }}>
                        <span className="h-4 w-4 rounded-full border-2 border-ink bg-cream shadow-[2px_2px_0_#0B2130]" />
                      </span>
                    ))}
                  </>
                )}
                <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[10px] font-black tabular-nums text-cream">
                  {Math.round(selected.scale * 100)}% · {Math.round(selected.rotation)}°
                </span>
              </div>
            ) : null}
          </CompositionCanvas>
        </div>
    </div>
  );
}

/** Caja de selección en % del lienzo (con escala aplicada, sin rotación). */
export function getSelectionBox(element: CanvasElement, canvasWidth: number, canvasHeight: number, measuredTextHeight: number | null) {
  const outer = getOuterSize(element);
  const height = element.type === "text" && measuredTextHeight ? measuredTextHeight : outer.height;
  const cx = element.x + outer.width / 2;
  const cy = element.y + height / 2;
  const w = outer.width * element.scale;
  const h = height * element.scale;
  return {
    left: ((cx - w / 2) / canvasWidth) * 100,
    top: ((cy - h / 2) / canvasHeight) * 100,
    width: (w / canvasWidth) * 100,
    height: (h / canvasHeight) * 100,
  };
}
