import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { useAnimationFrame, useReducedMotion } from "framer-motion";
import PaisajePhoto from "@/components/home/PaisajePhoto";
import { useElementSize } from "@/hooks/useElementSize";
import type { Paisaje } from "@/lib/paisajes";

type Props = {
  photos: readonly Paisaje[];
  /** Ancho de cada tarjeta en escritorio (px). En pantallas pequeñas se reduce solo. */
  cardSize?: number;
  gap?: number;
  /** Cuánto se curva el arco en los bordes (grados de giro máximo = curve; caída en px = curve). */
  curve?: number;
  perspective?: number;
  /** Velocidad del avance automático (0 = parado). */
  auto?: number;
  /** Multiplicador del arrastre. */
  drag?: number;
  /** Cuánto se desliza tras soltar (0 = nada, 1 = mucho). */
  inertia?: number;
  radius?: number;
  background?: string;
  className?: string;
};

/** Píxeles por milisegundo por cada punto de `auto`. */
const AUTO_PX_PER_MS = 0.06;

/**
 * Galería en arco: tira infinita de tarjetas que avanza sola, se arrastra con inercia y se curva
 * en los bordes (las tarjetas de los extremos bajan y giran siguiendo el arco, con perspectiva).
 * Las tarjetas se mueven por DOM directo en cada frame (sin re-render); solo cambia el estado
 * cuando una tarjeta sale por un lado y entra por el otro con otra foto.
 */
export default function CurvedGalleryArc({ photos, cardSize = 220, gap = 16, curve = 40, perspective = 1200, auto = 0.22, drag = 1, inertia = 1, radius = 16, background = "#0B0B0C", className = "" }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(wrapperRef);
  const reduceMotion = useReducedMotion();
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const offset = useRef(0);
  const velocity = useRef(0);
  const dragState = useRef<{ x: number; last: number; time: number; id: number; moved: boolean } | null>(null);
  const [shift, setShift] = useState(0);

  const available = width || 360;
  const size = Math.round(Math.min(cardSize, Math.max(132, available * 0.46)));
  const height = Math.round(size * 1.3);
  const step = size + gap;
  const slots = Math.ceil(available / step) + 3;
  const count = photos.length;

  const place = useCallback(() => {
    const first = Math.floor(offset.current / step);
    const rest = offset.current - first * step;
    const center = available / 2;
    for (let k = 0; k < slots; k += 1) {
      const node = refs.current[k];
      if (!node) continue;
      const x = k * step - step - rest;
      // t: -1 en el borde izquierdo, 0 en el centro, 1 en el derecho
      const t = Math.max(-1.4, Math.min(1.4, (x + size / 2 - center) / center));
      const lift = (1 - t * t) * curve; // el centro sube, los bordes bajan: arco
      node.style.transform = `translate3d(${x.toFixed(1)}px, ${(-lift).toFixed(1)}px, ${(-Math.abs(t) * curve * 2).toFixed(1)}px) rotateZ(${(t * curve * 0.12).toFixed(2)}deg) rotateY(${(-t * curve * 0.35).toFixed(2)}deg)`;
    }
    setShift((current) => (current === first ? current : first));
  }, [available, curve, size, slots, step]);

  useLayoutEffect(() => place(), [place]);

  useAnimationFrame((_, delta) => {
    const dt = Math.min(delta, 50);
    if (dragState.current) return;
    if (Math.abs(velocity.current) > 0.002) {
      offset.current -= velocity.current * dt;
      // Fricción: con inercia 1 se desliza ~1,4 s; con 0 se detiene al soltar.
      velocity.current *= Math.exp(-dt / (40 + 420 * inertia));
    } else {
      velocity.current = 0;
      if (!reduceMotion) offset.current += auto * AUTO_PX_PER_MS * dt;
    }
    place();
  });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    velocity.current = 0;
    dragState.current = { x: event.clientX, last: event.clientX, time: performance.now(), id: event.pointerId, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = event.clientX - state.last;
    const now = performance.now();
    const dt = Math.max(now - state.time, 1);
    state.moved ||= Math.abs(event.clientX - state.x) > 4;
    offset.current -= dx * drag;
    // Velocidad suavizada para que el lanzamiento no dependa del último frame.
    velocity.current = velocity.current * 0.6 + ((dx * drag) / dt) * 0.4;
    state.last = event.clientX;
    state.time = now;
    place();
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state || state.id !== event.pointerId) return;
    dragState.current = null;
    if (performance.now() - state.time > 80) velocity.current = 0;
  };

  return (
    <div
      ref={wrapperRef}
      role="region"
      aria-roledescription="galería"
      aria-label="Galería de fotos de viaje"
      className={`relative w-full select-none overflow-hidden border-y-2 border-ink sm:rounded-[2rem] sm:border-2 ${className}`}
      style={{ background }}
    >
      <div
        className="relative mx-auto cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing"
        style={{ height: height + curve * 2 + 32, perspective }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {Array.from({ length: slots }, (_, k) => {
          const photo = photos[(((k - 1 + shift) % count) + count) % count];
          return (
            <div
              key={k}
              ref={(node) => { refs.current[k] = node; }}
              className="absolute left-0 overflow-hidden border-2 border-cream/10 will-change-transform"
              style={{ top: curve + 16, width: size, height, borderRadius: radius }}
            >
              <PaisajePhoto photo={photo} sizes={`${size}px`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
