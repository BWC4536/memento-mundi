import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { animate, motion, useAnimationFrame, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PaisajePhoto from "@/components/home/PaisajePhoto";
import { useElementSize } from "@/hooks/useElementSize";
import type { Paisaje } from "@/lib/paisajes";

type Props = {
  photos: readonly Paisaje[];
  className?: string;
  /** Carga la primera foto con prioridad (carrusel above the fold). */
  priority?: boolean;
};

/** Grados por milisegundo del giro automático (una vuelta cada ~36 s). */
const AUTO_SPEED = 0.01;
/** Grados por píxel al arrastrar. */
const DRAG_SPEED = 0.35;
const RESUME_AFTER_MS = 3500;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mod = (value: number, n: number) => ((value % n) + n) % n;

/**
 * Carrusel 3D de fotos tipo polaroid en anillo. Gira solo, se arrastra con el dedo o el ratón,
 * se maneja con flechas del teclado y se detiene con "reducir movimiento".
 * Cada tarjeta se proyecta por separado (sin preserve-3d) para que el orden de capas sea estable en Safari.
 */
export default function PhotoCarousel3D({ photos, className = "", priority = false }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(wrapperRef);
  const reduceMotion = useReducedMotion();
  const rotation = useMotionValue(0);
  const resumeAt = useRef(0);
  const drag = useRef<{ x: number; start: number; moved: boolean; id: number } | null>(null);
  /** El click que cierra un arrastre no debe saltar a otra foto. */
  const justDragged = useRef(false);
  const [active, setActive] = useState(0);

  const count = photos.length;
  const step = 360 / count;
  // Radio justo para que las tarjetas vecinas se rocen sin solaparse, sea cual sea el número de fotos.
  const spread = 0.6 / Math.sin(Math.PI / count);
  const available = width || 320;
  // Móvil: tarjeta grande y las laterales asoman por los bordes; resto: el anillo cabe en el contenedor.
  const cardWidth = Math.round(clamp(available < 480 ? available * 0.5 : available / (1 + 1.5 * spread), 140, 340));
  const cardHeight = Math.round(cardWidth * 1.36);
  const ringRadius = Math.round(cardWidth * spread);
  const radius = useMotionValue(ringRadius);

  useEffect(() => radius.set(ringRadius), [radius, ringRadius]);

  useAnimationFrame((_, delta) => {
    if (reduceMotion || drag.current || performance.now() < resumeAt.current) return;
    rotation.set(rotation.get() - Math.min(delta, 50) * AUTO_SPEED);
  });

  useMotionValueEvent(rotation, "change", (value) => {
    const front = mod(Math.round(-value / step), count);
    setActive((current) => (current === front ? current : front));
  });

  const pauseForAWhile = () => {
    resumeAt.current = performance.now() + RESUME_AFTER_MS;
  };

  /** Gira por el camino corto hasta dejar la foto `index` de frente. */
  const goTo = (index: number) => {
    const current = rotation.get();
    const offset = current + index * step;
    const target = current - (offset - 360 * Math.round(offset / 360));
    pauseForAWhile();
    animate(rotation, target, reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 });
  };
  const next = () => goTo(mod(active + 1, count));
  const prev = () => goTo(mod(active - 1, count));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    rotation.stop();
    justDragged.current = false;
    drag.current = { x: event.clientX, start: rotation.get(), moved: false, id: event.pointerId };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    if (!current.moved && Math.abs(dx) > 6) {
      current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (current.moved) rotation.set(current.start + dx * DRAG_SPEED);
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    justDragged.current = current.moved;
    if (current.moved) goTo(mod(Math.round(-rotation.get() / step), count));
  };
  const onCardClick = (index: number) => {
    // Un arrastre termina con click: solo cuenta si no se movió.
    if (justDragged.current) return;
    goTo(index);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") { event.preventDefault(); next(); }
    if (event.key === "ArrowLeft") { event.preventDefault(); prev(); }
  };

  const current = photos[active];

  return (
    <div
      ref={wrapperRef}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Fotos de viaje"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`relative isolate w-full select-none rounded-[2rem] outline-none focus-visible:ring-4 focus-visible:ring-orange/50 ${className}`}
    >
      <div
        className="relative mx-auto cursor-grab touch-pan-y active:cursor-grabbing"
        style={{ height: cardHeight + 36, perspective: Math.max(cardWidth * 4.2, ringRadius * 2.6) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Sombra en el suelo */}
        <div aria-hidden className="absolute bottom-0 left-1/2 h-7 -translate-x-1/2 rounded-[50%] bg-ink/20 blur-md" style={{ width: Math.min(ringRadius * 2 + cardWidth, available) }} />
        {photos.map((photo, index) => (
          <CarouselCard
            key={photo.slug}
            photo={photo}
            index={index}
            step={step}
            rotation={rotation}
            radius={radius}
            width={cardWidth}
            height={cardHeight}
            isActive={index === active}
            priority={priority && index === 0}
            onSelect={() => onCardClick(index)}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button type="button" onClick={prev} aria-label="Foto anterior" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white/70 shadow-hard-sm transition-transform hover:-translate-y-0.5 active:scale-95">
          <ChevronLeft size={18} />
        </button>
        <p className="min-w-0 rounded-full border-2 border-ink bg-cream px-4 py-2 text-center text-[11px] font-black uppercase tracking-[.14em]">
          <span className="text-orange">{current.city}</span> · {current.place}
        </p>
        <button type="button" onClick={next} aria-label="Foto siguiente" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white/70 shadow-hard-sm transition-transform hover:-translate-y-0.5 active:scale-95">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

type CardProps = {
  photo: Paisaje;
  index: number;
  step: number;
  rotation: MotionValue<number>;
  radius: MotionValue<number>;
  width: number;
  height: number;
  isActive: boolean;
  priority: boolean;
  onSelect: () => void;
};

function CarouselCard({ photo, index, step, rotation, radius, width, height, isActive, priority, onSelect }: CardProps) {
  const angle = useTransform(rotation, (value) => ((value + index * step) * Math.PI) / 180);
  const transform = useTransform([angle, radius], ([a, r]: number[]) => {
    const x = Math.sin(a) * r;
    const z = (Math.cos(a) - 1) * r;
    // Giro suavizado: las de atrás siguen viéndose de cara, no espejadas.
    return `translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px) rotateY(${(Math.sin(a) * 42).toFixed(1)}deg)`;
  });
  const depth = useTransform(angle, (a) => (Math.cos(a) + 1) / 2);
  const zIndex = useTransform(depth, (d) => Math.round(d * 100));
  const opacity = useTransform(depth, (d) => 0.35 + 0.65 * d ** 1.4);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      tabIndex={-1}
      aria-label={`${photo.city}, ${photo.place}`}
      aria-current={isActive || undefined}
      className="absolute left-1/2 top-0 flex flex-col rounded-[1.1rem] border-2 border-ink bg-white p-2 text-left shadow-hard will-change-transform"
      style={{ width, height, marginLeft: -width / 2, transform, zIndex, opacity }}
    >
      <span className="relative block min-h-0 flex-1 overflow-hidden rounded-[.7rem] border-2 border-ink bg-ink">
        <PaisajePhoto photo={photo} sizes={`${width}px`} priority={priority} decorative />
      </span>
      <span className="flex items-end justify-between gap-2 px-1 pb-0.5 pt-2">
        <span className="min-w-0">
          <span className="block truncate font-brand text-lg leading-none">{photo.city}</span>
          <span className="mt-1 block truncate text-[9px] font-black uppercase tracking-[.14em] text-ink/55">{photo.place}</span>
        </span>
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-full border-2 border-ink bg-orange" />
      </span>
    </motion.button>
  );
}
