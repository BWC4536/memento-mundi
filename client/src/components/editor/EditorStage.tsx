import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Lock, RotateCw } from "lucide-react";
import {
  clampElementScale,
  findElement,
  getCenter,
  getContentBounds,
  getOuterSize,
  normalizeCrop,
  normalizeRotation,
  sortByZ,
  updateElement,
  type CanvasElement,
  type Rect,
  type ScrapbookComposition,
} from "@/lib/composition";
import { centerCameraOn, DEFAULT_CAMERA, fitCamera, patternScale, screenToWorld, visibleWorldRect, zoomCameraAt, type Camera } from "@/lib/camera";
import { snapPosition, snapRotation, type SnapGuides } from "@/lib/editor-snap";
import { useElementSize } from "@/hooks/useElementSize";
import { ElementNode, PaperTexture } from "@/components/scrapbook/CompositionCanvas";

export type StageApi = {
  /** Centro de la zona visible, en unidades del cuaderno. */
  visibleCenter: () => { x: number; y: number };
  /** Zona del cuaderno visible ahora mismo. */
  visibleRect: () => Rect;
  /** Desplaza la vista para que el elemento quede centrado (p. ej. por encima del teclado). */
  revealElement: (id: string, verticalBias?: number) => void;
  /** Encuadra todo el contenido del cuaderno. */
  fitToContent: () => void;
  /** Acerca o aleja manteniendo fijo el centro del visor. */
  zoomBy: (factor: number) => void;
  /** Vuelve al 100% sin moverse del sitio. */
  resetZoom: () => void;
};

type Props = {
  composition: ScrapbookComposition;
  selectedId: string | null;
  /** null hasta que se mide el visor: entonces se encuadra el contenido. */
  camera: Camera | null;
  onCameraChange: (updater: (camera: Camera) => Camera) => void;
  onSelect: (id: string | null) => void;
  onBeginChange: () => void;
  onChange: (update: (composition: ScrapbookComposition) => ScrapbookComposition) => void;
  onEditText: (id: string) => void;
  onFillFrame: (id: string) => void;
  /** Doble toque en el papel: crea una nota en ese punto. */
  onCreateNote?: (point: { x: number; y: number }) => void;
  cropMode: boolean;
  snapEnabled: boolean;
  emptyState?: ReactNode;
  apiRef?: React.MutableRefObject<StageApi | null>;
  /** Espacio ocupado abajo por la interfaz flotante (para encuadrar). */
  bottomInset?: number;
};

type ScreenPoint = { x: number; y: number };

type Gesture =
  | { kind: "pan"; startX: number; startY: number; camera: Camera; moved: boolean; background: boolean }
  | { kind: "move"; id: string; startX: number; startY: number; origin: { x: number; y: number }; moved: boolean; wasSelected: boolean; locked: boolean }
  | { kind: "crop"; id: string; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean }
  | { kind: "scale"; id: string; center: ScreenPoint; startDistance: number; startScale: number; moved: boolean }
  | { kind: "rotate"; id: string; center: ScreenPoint; startAngle: number; startRotation: number; moved: boolean }
  | { kind: "pinch-canvas"; distance: number; anchor: { x: number; y: number }; camera: Camera }
  | { kind: "pinch-element"; id: string; distance: number; angle: number; startScale: number; startRotation: number };

const TAP_SLOP = 4;
const DOUBLE_TAP_MS = 320;
const deg = (radians: number) => (radians * 180) / Math.PI;
const NO_GUIDES: SnapGuides = { vertical: [], horizontal: [] };

export default function EditorStage({
  composition,
  selectedId,
  camera: cameraProp,
  onCameraChange,
  onSelect,
  onBeginChange,
  onChange,
  onEditText,
  onFillFrame,
  onCreateNote,
  cropMode,
  snapEnabled,
  emptyState,
  apiRef,
  bottomInset = 0,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const viewport = useElementSize(viewportRef);
  const camera = cameraProp ?? DEFAULT_CAMERA;

  const pointers = useRef(new Map<number, ScreenPoint>());
  const gesture = useRef<Gesture | null>(null);
  const lastBackgroundTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const spacePressed = useRef(false);
  const [panning, setPanning] = useState(false);
  const [guides, setGuides] = useState<SnapGuides>(NO_GUIDES);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  const latest = useRef({ composition, selectedId, camera, viewport, snapEnabled, cropMode, measuredHeight, bottomInset });
  latest.current = { composition, selectedId, camera, viewport, snapEnabled, cropMode, measuredHeight, bottomInset };

  const selected = findElement(composition, selectedId);

  const fitToContent = useCallback(() => {
    const { composition: c, viewport: size, bottomInset: inset } = latest.current;
    if (!size.width || !size.height) return;
    const bounds = getContentBounds(c, { padding: 0.03, maxAspect: Infinity });
    onCameraChange(() => fitCamera(bounds, size, { padding: size.width < 640 ? 16 : 48, maxZoom: 1, insets: { bottom: inset } }));
  }, [onCameraChange]);

  // Primera medida del visor: encuadramos el contenido.
  useEffect(() => {
    if (cameraProp === null && viewport.width > 0 && viewport.height > 0) fitToContent();
  }, [cameraProp, fitToContent, viewport.height, viewport.width]);

  // Alto real del texto seleccionado (su caja es "auto"), en unidades del cuaderno.
  useLayoutEffect(() => {
    if (!selected || selected.type !== "text" || !worldRef.current) {
      setMeasuredHeight(null);
      return;
    }
    const node = worldRef.current.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(selected.id)}"]`);
    if (node) setMeasuredHeight(node.offsetHeight);
  }, [selected]);

  // Espacio mantenido = arrastrar mueve el cuaderno (convención de escritorio).
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const node = target as HTMLElement | null;
      return !!node && (node.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName));
    };
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTyping(event.target)) return;
      event.preventDefault();
      if (!spacePressed.current) {
        spacePressed.current = true;
        setPanning(true);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spacePressed.current = false;
      setPanning(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const viewportCenter = () => {
    const { viewport: size, bottomInset: inset } = latest.current;
    return { x: size.width / 2, y: (size.height - inset) / 2 };
  };

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      visibleCenter: () => screenToWorld(latest.current.camera, viewportCenter()),
      visibleRect: () => visibleWorldRect(latest.current.camera, latest.current.viewport),
      revealElement: (id, verticalBias = 0) => {
        const { composition: c, viewport: size } = latest.current;
        const element = findElement(c, id);
        if (!element || !size.width) return;
        onCameraChange((current) => centerCameraOn(current, getCenter(element), size, verticalBias));
      },
      fitToContent,
      zoomBy: (factor) => onCameraChange((current) => zoomCameraAt(current, current.zoom * factor, viewportCenter())),
      resetZoom: () => onCameraChange((current) => zoomCameraAt(current, 1, viewportCenter())),
    };
  }, [apiRef, fitToContent, onCameraChange]);

  const toViewport = useCallback((clientX: number, clientY: number): ScreenPoint => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const twoPointerMetrics = () => {
    const [a, b] = Array.from(pointers.current.values());
    return { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, angle: deg(Math.atan2(b.y - a.y, b.x - a.x)), mid: toViewport((a.x + b.x) / 2, (a.y + b.y) / 2) };
  };

  const startPinch = () => {
    const { composition: c, camera: cam } = latest.current;
    const current = gesture.current;
    const metrics = twoPointerMetrics();
    const targetId = current && (current.kind === "move" || current.kind === "scale" || current.kind === "rotate") ? current.id : null;
    const target = findElement(c, targetId);
    if (target && !target.locked) {
      onBeginChange();
      gesture.current = { kind: "pinch-element", id: target.id, distance: metrics.distance, angle: metrics.angle, startScale: target.scale, startRotation: target.rotation };
    } else {
      // El punto del cuaderno bajo los dedos se queda bajo los dedos: zoom y pan a la vez.
      gesture.current = { kind: "pinch-canvas", distance: metrics.distance, anchor: screenToWorld(cam, metrics.mid), camera: cam };
    }
    setGuides(NO_GUIDES);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, select, [data-stage-ui]")) return;
    const middleButton = event.pointerType === "mouse" && event.button === 1;
    if (event.pointerType === "mouse" && event.button !== 0 && !middleButton) return;
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

    const { composition: c, selectedId: currentSelected, camera: cam, cropMode: crop } = latest.current;
    if (middleButton || spacePressed.current) {
      event.preventDefault();
      gesture.current = { kind: "pan", startX: event.clientX, startY: event.clientY, camera: cam, moved: false, background: false };
      setPanning(true);
      return;
    }

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

    gesture.current = { kind: "pan", startX: event.clientX, startY: event.clientY, camera: cam, moved: false, background: true };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = gesture.current;
    if (!current) return;
    const { composition: c, camera: cam, snapEnabled: snap, measuredHeight: textHeight } = latest.current;

    switch (current.kind) {
      case "pan": {
        const dx = event.clientX - current.startX;
        const dy = event.clientY - current.startY;
        if (!current.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
        if (!current.moved) setPanning(true);
        current.moved = true;
        onCameraChange(() => ({ ...current.camera, x: current.camera.x + dx, y: current.camera.y + dy }));
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
        let next = { x: current.origin.x + dxScreen / cam.zoom, y: current.origin.y + dyScreen / cam.zoom };
        if (snap && !event.altKey) {
          const result = snapPosition(c, element, next, 7 / cam.zoom, element.type === "text" ? textHeight ?? undefined : undefined);
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
        const sensitivityX = 2 / Math.max(1, element.width * element.scale * cam.zoom * zoom);
        const sensitivityY = 2 / Math.max(1, element.height * element.scale * cam.zoom * zoom);
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
        const zoomed = zoomCameraAt(current.camera, current.camera.zoom * (metrics.distance / current.distance), metrics.mid);
        // Recolocamos para que el punto de anclaje siga bajo los dedos aunque se desplacen.
        onCameraChange(() => ({ zoom: zoomed.zoom, x: metrics.mid.x - current.anchor.x * zoomed.zoom, y: metrics.mid.y - current.anchor.y * zoomed.zoom }));
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
    setGuides(NO_GUIDES);
    if (!spacePressed.current) setPanning(false);

    if (pointers.current.size > 0) {
      // Queda un dedo: termina el pinch y no interpretamos el resto como tap.
      gesture.current = null;
      return;
    }
    gesture.current = null;
    if (!current || event.type === "pointercancel") return;
    const { composition: c, camera: cam } = latest.current;

    if (current.kind === "pan" && !current.moved && current.background) {
      onSelect(null);
      // Doble toque en el papel vacío: nota nueva justo ahí.
      const now = Date.now();
      const last = lastBackgroundTap.current;
      if (onCreateNote && last && now - last.time < DOUBLE_TAP_MS && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 24) {
        lastBackgroundTap.current = null;
        onCreateNote(screenToWorld(cam, toViewport(event.clientX, event.clientY)));
      } else {
        lastBackgroundTap.current = { time: now, x: event.clientX, y: event.clientY };
      }
      return;
    }
    lastBackgroundTap.current = null;
    if (current.kind === "move" && !current.moved) {
      // Tap sobre la selección: si hay otro elemento visible justo debajo del dedo, lo seleccionamos.
      const hit = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((node) => (node as HTMLElement).closest<HTMLElement>("[data-element-id]"))
        .find((node): node is HTMLElement => !!node && !!worldRef.current?.contains(node));
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

  // Rueda: Ctrl/⌘ (o pinch del trackpad) hace zoom bajo el cursor; la rueda normal desplaza.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1;
      if (event.ctrlKey || event.metaKey) {
        const anchor = toViewport(event.clientX, event.clientY);
        const factor = Math.exp(-event.deltaY * unit * 0.01);
        onCameraChange((current) => zoomCameraAt(current, current.zoom * factor, anchor));
        return;
      }
      const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
      const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY;
      onCameraChange((current) => ({ ...current, x: current.x - dx * unit, y: current.y - dy * unit }));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [onCameraChange, toViewport]);

  const ordered = sortByZ(composition.elements).filter((element) => element.visible !== false);
  const selectionBox = selected ? getSelectionBox(selected, measuredHeight) : null;
  const toScreenX = (value: number) => value * camera.zoom + camera.x;
  const toScreenY = (value: number) => value * camera.zoom + camera.y;

  return (
    <div
      ref={viewportRef}
      data-testid="editor-viewport"
      aria-label="Cuaderno infinito"
      role="application"
      className={`relative h-full w-full touch-none select-none overflow-hidden ${panning ? "cursor-grabbing" : ""}`}
      style={{ background: composition.canvas.background, "--mm-u": `${patternScale(camera.zoom)}px` } as CSSProperties}
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
      {composition.canvas.backgroundImage ? <img src={composition.canvas.backgroundImage} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" /> : null}
      <PaperTexture composition={composition} offset={{ x: `${camera.x}px`, y: `${camera.y}px` }} />

      {/* Capa del mundo: 1 unidad del cuaderno = 1px, escalada por la cámara. */}
      <div
        ref={worldRef}
        data-world
        className="absolute left-0 top-0 h-0 w-0"
        style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`, transformOrigin: "0 0", "--mm-u": "1px" } as CSSProperties}
      >
        {ordered.map((element, index) => (
          <ElementNode key={element.id} element={element} zIndex={index + 1} editing frame={null} />
        ))}
      </div>

      {guides.vertical.map((line) => (
        <span key={`v${line}`} className="pointer-events-none absolute inset-y-0 z-[20] w-0 border-l-2 border-dashed border-orange" style={{ left: toScreenX(line) }} />
      ))}
      {guides.horizontal.map((line) => (
        <span key={`h${line}`} className="pointer-events-none absolute inset-x-0 z-[20] h-0 border-t-2 border-dashed border-orange" style={{ top: toScreenY(line) }} />
      ))}

      {selected && selectionBox ? (
        <div
          ref={selectionRef}
          data-selection-box
          className="absolute z-[21]"
          style={{
            left: toScreenX(selectionBox.x),
            top: toScreenY(selectionBox.y),
            width: selectionBox.width * camera.zoom,
            height: selectionBox.height * camera.zoom,
            transform: `rotate(${selected.rotation}deg)`,
            pointerEvents: "none",
          }}
        >
          <div
            data-handle="move"
            className={`absolute inset-0 rounded-[3px] ${cropMode && selected.type === "photo" ? "cursor-move" : selected.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
            style={{ outline: `2px ${cropMode && selected.type === "photo" ? "dashed" : "solid"} #FA9223`, outlineOffset: 3, boxShadow: "0 0 0 5px rgba(11,33,48,.35)", pointerEvents: "auto" }}
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
        </div>
      ) : null}

      {ordered.length === 0 && emptyState ? (
        <div className="pointer-events-none absolute inset-0 z-[22] flex items-center justify-center p-4" style={{ paddingBottom: bottomInset + 16 }}>
          {emptyState}
        </div>
      ) : null}
    </div>
  );
}

/** Caja de selección en unidades del cuaderno (con escala aplicada, sin rotación). */
export function getSelectionBox(element: CanvasElement, measuredTextHeight: number | null): Rect {
  const outer = getOuterSize(element);
  const height = element.type === "text" && measuredTextHeight ? measuredTextHeight : outer.height;
  const cx = element.x + outer.width / 2;
  const cy = element.y + height / 2;
  const w = outer.width * element.scale;
  const h = height * element.scale;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}
