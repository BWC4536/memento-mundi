import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// Píxeles de scroll (rueda, dedo o teclado) necesarios para ver la animación entera: ~5 s de gesto continuo.
export const INTRO_SCROLL_PX = 2400;
// Cuánto se acerca el progreso visible al objetivo en cada frame (0-1). Más alto = más directo.
const SMOOTHING = 0.2;
// Duración del fundido a la página una vez termina la animación.
const FADE_MS = 900;
// Descargas simultáneas al precargar la secuencia.
const PRELOAD_CONCURRENCY = 6;

/**
 * La animación se sirve como secuencia de imágenes (generada con ffmpeg a partir de memento_sticker.mp4):
 * buscar dentro de un vídeo con `currentTime` es lento y no sigue al scroll, pero pintar una imagen ya
 * decodificada en un canvas es inmediato. Es el mismo sistema que usan las webs con animaciones 3D.
 */
const FRAME_SETS = {
  // Resolución nativa del vídeo, 24 fps.
  lg: { dir: "/sticker-frames/lg", count: 192 },
  // Versión ligera para móvil, 12 fps.
  sm: { dir: "/sticker-frames/sm", count: 96 },
} as const;

export const resolveStickerProgress = (value: number, reducedMotion: boolean) =>
  reducedMotion ? 0 : Math.max(0, Math.min(1, value));

/** Avanza (o rebobina, si delta < 0) el progreso de la intro según los píxeles desplazados. */
export const advanceIntroProgress = (current: number, deltaPx: number, totalPx = INTRO_SCROLL_PX) =>
  Math.max(0, Math.min(1, current + deltaPx / totalPx));

/** Índice del fotograma que corresponde a un progreso 0-1. */
export const frameIndexFor = (progress: number, count: number) =>
  Math.max(0, Math.min(count - 1, Math.round(progress * (count - 1))));

type Phase = "intro" | "leaving" | "done";

const frameUrl = (set: keyof typeof FRAME_SETS, index: number) =>
  `${FRAME_SETS[set].dir}/${String(index + 1).padStart(3, "0")}.webp`;

const pickSet = (): keyof typeof FRAME_SETS =>
  window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768 ? "sm" : "lg";

/**
 * Intro a pantalla completa de la tienda.
 * Bloquea el scroll de la página; la rueda, el dedo o el teclado mueven la animación hacia delante
 * y hacia atrás. Al llegar al final, se funde y deja la tienda arriba del todo.
 */
export default function StickerScrollHero({ onFinished }: { onFinished?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "done" : "intro",
  );
  const [started, setStarted] = useState(false);

  // Bloqueo del scroll de la página mientras dura la intro.
  useEffect(() => {
    if (phase === "done") return;
    const html = document.documentElement;
    const body = document.body;
    const previous = { html: html.style.overflow, body: body.style.overflow, overscroll: html.style.overscrollBehavior };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = previous.html;
      body.style.overflow = previous.body;
      html.style.overscrollBehavior = previous.overscroll;
    };
  }, [phase]);

  // Precarga de la secuencia, scrub con el gesto y pintado en canvas.
  useEffect(() => {
    if (phase !== "intro") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const set = pickSet();
    const count = FRAME_SETS[set].count;
    const frames: (HTMLImageElement | null)[] = new Array(count).fill(null);
    let readyUpTo = -1; // último índice cargado sin huecos por delante
    let loadingDone = false;
    let target = 0;
    let shown = 0;
    let drawnIndex = -1;
    let frame: number | null = null;
    let finished = false;
    let cancelled = false;
    let lastTouchY: number | null = null;

    // Hasta dónde se puede avanzar: solo lo que ya está cargado.
    const readyProgress = () => (loadingDone ? 1 : Math.max(0, readyUpTo) / (count - 1));

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      drawnIndex = -1;
      queueTick();
    };

    const draw = (index: number) => {
      const image = frames[index];
      if (!image) return;
      // Equivalente a object-fit: cover.
      const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      drawnIndex = index;
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      setPhase("leaving");
    };

    const tick = () => {
      frame = null;
      const clampedTarget = Math.min(target, readyProgress());
      const distance = clampedTarget - shown;
      shown = Math.abs(distance) < 0.001 ? clampedTarget : shown + distance * SMOOTHING;
      const index = frameIndexFor(shown, count);
      if (index !== drawnIndex && frames[index]) draw(index);
      if (shown >= 1 && target >= 1 && loadingDone) { finish(); return; }
      if (shown !== clampedTarget || clampedTarget !== target) frame = requestAnimationFrame(tick);
    };
    const queueTick = () => { if (frame === null) frame = requestAnimationFrame(tick); };

    const move = (deltaPx: number) => {
      if (finished) return;
      target = advanceIntroProgress(target, deltaPx);
      if (deltaPx > 0) setStarted(true);
      queueTick();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      move(event.deltaY * factor);
    };
    const onTouchStart = (event: TouchEvent) => { lastTouchY = event.touches[0]?.clientY ?? null; };
    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      const y = event.touches[0]?.clientY;
      if (y === undefined || lastTouchY === null) return;
      // El dedo recorre menos píxeles que la rueda: se amplifica para que la animación dure lo mismo.
      move((lastTouchY - y) * 2.2);
      lastTouchY = y;
    };
    const onTouchEnd = () => { lastTouchY = null; };
    const onKey = (event: KeyboardEvent) => {
      const steps: Record<string, number> = { ArrowDown: 120, ArrowUp: -120, PageDown: 600, PageUp: -600, " ": 600, End: INTRO_SCROLL_PX, Home: -INTRO_SCROLL_PX };
      const delta = steps[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      move(delta);
    };

    // Precarga en orden, con varias descargas a la vez: el principio está listo enseguida.
    let nextToLoad = 0;
    let failures = 0;
    const loadOne = (index: number) =>
      new Promise<void>((resolve) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          image.decode().catch(() => undefined).finally(() => {
            if (cancelled) { resolve(); return; }
            frames[index] = image;
            while (readyUpTo + 1 < count && frames[readyUpTo + 1]) readyUpTo += 1;
            queueTick();
            resolve();
          });
        };
        image.onerror = () => { failures += 1; resolve(); };
        image.src = frameUrl(set, index);
      });
    const worker = async () => {
      while (!cancelled && nextToLoad < count) {
        const index = nextToLoad;
        nextToLoad += 1;
        await loadOne(index);
      }
    };
    Promise.all(Array.from({ length: PRELOAD_CONCURRENCY }, worker)).then(() => {
      if (cancelled) return;
      loadingDone = true;
      // Si faltan fotogramas, se rellenan con el anterior para no dejar huecos.
      for (let i = 1; i < count; i += 1) if (!frames[i]) frames[i] = frames[i - 1];
      // Sin ningún fotograma no hay intro que mostrar.
      if (failures === count || !frames[0]) finish();
      else queueTick();
    });

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [phase]);

  // Fundido: cuando termina, se desmonta la capa y la tienda queda arriba del todo.
  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = window.setTimeout(() => {
      setPhase("done");
      window.scrollTo(0, 0);
      onFinished?.();
    }, FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, onFinished]);

  if (phase === "done") return null;

  return (
    <div
      role="presentation"
      aria-label="Intro: pegatina Memento Mundi despegándose con el scroll"
      style={{ transition: `opacity ${FADE_MS}ms ease` }}
      className={`fixed inset-0 z-[90] overflow-hidden bg-[#EAE7DA] ${phase === "leaving" ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full select-none" />

      {/* Indicador: solo al inicio, desaparece en cuanto empiezas a deslizar */}
      <div
        className={`pointer-events-none absolute bottom-[max(2.5rem,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 transition-opacity duration-300 ${started ? "opacity-0" : "opacity-100"}`}
      >
        <span className="whitespace-nowrap rounded-full border border-ink/20 bg-cream/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-ink/60 shadow-sm backdrop-blur-sm">
          Desliza para despegar
        </span>
        <ChevronDown size={15} className="animate-bounce text-orange" />
      </div>
    </div>
  );
}
