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
  /** Cuánto se curva el arco en los bordes (px de caída y base del giro). */
  curve?: number;
  perspective?: number;
  /** Velocidad del avance automático (0 = parado). */
  auto?: number;
  /** Multiplicador del arrastre. */
  drag?: number;
  /** Cuánto se desliza tras soltar (0 = nada, 1 = mucho). */
  inertia?: number;
  radius?: number;
  /** Fondo de cada tarjeta (se ve mientras carga la foto). */
  cardBackground?: string;
  className?: string;
};

/** Píxeles por milisegundo por cada punto de `auto`. */
const AUTO_PX_PER_MS = 0.06;

/**
 * Galería en arco: tira infinita de tarjetas que avanza sola, se arrastra con inercia y se curva
 * en los bordes (las de los extremos bajan y giran siguiendo el arco, con perspectiva).
 *
 * Cada tarjeta tiene un índice lógico estable (su `key`): al avanzar, solo se crea la que entra
 * por un borde y se borra la que sale por el otro. Las demás conservan su <img>, así no parpadean.
 * Las posiciones se escriben en el DOM en cada frame, sin re-render.
 */
export default function CurvedGalleryArc({ photos, cardSize = 220, gap = 16, curve = 40, perspective = 1200, auto = 0.22, drag = 1, inertia = 1, radius = 16, cardBackground = "#0B0B0C", className = "" }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(wrapperRef);
  const reduceMotion = useReducedMotion();
  const nodes = useRef(new Map<number, HTMLDivElement>());
  const offset = useRef(0);
  const velocity = useRef(0);
  const dragState = useRef<{ last: number; time: number; id: number } | null>(null);
  const [first, setFirst] = useState(0);

  const available = width || 360;
  const size = Math.round(Math.min(cardSize, Math.max(132, available * 0.42)));
  const height = Math.round(size * 1.3);
  const step = size + gap;
  const visible = Math.ceil(available / step) + 2;
  const count = photos.length;

  const transformFor = useCallback(
    (index: number) => {
      const x = index * step - offset.current;
      const center = available / 2;
      // t: -1 en el borde izquierdo, 0 en el centro, 1 en el derecho
      const t = Math.max(-1.5, Math.min(1.5, (x + size / 2 - center) / center));
      const lift = (1 - t * t) * curve; // el centro sube y los bordes bajan: arco
      return `translate3d(${x.toFixed(1)}px, ${(-lift).toFixed(1)}px, ${(-Math.abs(t) * curve * 2).toFixed(1)}px) rotateZ(${(t * curve * 0.12).toFixed(2)}deg) rotateY(${(-t * curve * 0.35).toFixed(2)}deg)`;
    },
    [available, curve, size, step],
  );

  const place = useCallback(() => {
    nodes.current.forEach((node, index) => {
      node.style.transform = transformFor(index);
    });
    const next = Math.floor(offset.current / step) - 1;
    setFirst((current) => (current === next ? current : next));
  }, [step, transformFor]);

  // Tras cada render (tarjetas nuevas o cambio de tamaño) se recolocan antes de pintar.
  useLayoutEffect(() => place());

  useAnimationFrame((_, delta) => {
    if (dragState.current) return;
    const dt = Math.min(delta, 50);
    if (Math.abs(velocity.current) > 0.002) {
      offset.current += velocity.current * dt;
      // Fricción: con inercia 1 se desliza ~1,5 s; con 0 se detiene al soltar.
      velocity.current *= Math.exp(-dt / (40 + 420 * inertia));
    } else {
      velocity.current = 0;
      if (reduceMotion) return;
      offset.current += auto * AUTO_PX_PER_MS * dt;
    }
    place();
  });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    velocity.current = 0;
    dragState.current = { last: event.clientX, time: performance.now(), id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = (event.clientX - state.last) * drag;
    const now = performance.now();
    offset.current -= dx;
    // Velocidad suavizada (px/ms) para que el lanzamiento no dependa de un solo evento.
    velocity.current = velocity.current * 0.6 + (-dx / Math.max(now - state.time, 1)) * 0.4;
    state.last = event.clientX;
    state.time = now;
    place();
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state || state.id !== event.pointerId) return;
    dragState.current = null;
    // Si el dedo se quedó quieto antes de soltar, no hay lanzamiento.
    if (performance.now() - state.time > 80) velocity.current = 0;
  };

  const indexes = Array.from({ length: visible }, (_, k) => first + k);

  return (
    <div ref={wrapperRef} role="region" aria-roledescription="galería" aria-label="Galería de fotos de viaje" className={`relative w-full select-none ${className}`}>
      <div
        className="relative cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing"
        style={{
          height: height + curve * 2 + 40,
          perspective,
          // Los bordes se desvanecen en vez de cortar la tarjeta en seco.
          maskImage: "linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {indexes.map((index) => (
          <div
            key={index}
            ref={(node) => {
              if (node) nodes.current.set(index, node);
              else nodes.current.delete(index);
            }}
            className="absolute left-0 overflow-hidden border-2 border-ink shadow-hard-sm will-change-transform [backface-visibility:hidden]"
            style={{ top: curve + 20, width: size, height, borderRadius: radius, background: cardBackground, transform: transformFor(index) }}
          >
            <PaisajePhoto photo={photos[((index % count) + count) % count]} sizes={`${size}px`} />
          </div>
        ))}
      </div>
    </div>
  );
}
