import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const STICKER_VIDEO = "/memento_sticker.mp4";
// Píxeles de scroll (rueda, dedo o teclado) necesarios para ver el vídeo entero: ~5 s de gesto continuo.
export const INTRO_SCROLL_PX = 2400;
// Margen al final para no caer en un frame negro tras el último fotograma.
const END_GUARD_SECONDS = 0.05;
// Cuánto se acerca el progreso visible al objetivo en cada frame (0-1). Más alto = más directo.
const SMOOTHING = 0.3;
// Duración del fundido a la página una vez termina el vídeo.
const FADE_MS = 900;

export const resolveStickerProgress = (value: number, reducedMotion: boolean) =>
  reducedMotion ? 0 : Math.max(0, Math.min(1, value));

/** Avanza (o rebobina, si delta < 0) el progreso de la intro según los píxeles desplazados. */
export const advanceIntroProgress = (current: number, deltaPx: number, totalPx = INTRO_SCROLL_PX) =>
  Math.max(0, Math.min(1, current + deltaPx / totalPx));

type Phase = "intro" | "leaving" | "done";

/**
 * Intro a pantalla completa de la tienda.
 * Bloquea el scroll de la página; la rueda, el dedo o el teclado mueven el vídeo hacia delante
 * y hacia atrás. Al llegar al final, se funde y deja la tienda arriba del todo.
 */
export default function StickerScrollHero({ onFinished }: { onFinished?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "done" : "intro",
  );
  const [progress, setProgress] = useState(0);

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

  // Carga del vídeo, scrub con el gesto y fundido final.
  useEffect(() => {
    if (phase !== "intro") return;
    const video = videoRef.current;
    if (!video) return;

    let duration = 0;
    let target = 0;
    let shown = 0;
    let frame: number | null = null;
    let pendingTime: number | null = null;
    let finished = false;
    let cancelled = false;
    let objectUrl: string | null = null;
    let lastTouchY: number | null = null;

    const timeFor = (value: number) => {
      if (duration <= 0) return 0;
      const maxTime = Math.max(0, duration - END_GUARD_SECONDS);
      return Math.min(maxTime, Math.max(0.001, value * duration));
    };

    // Seek en cadena: solo se lanza un salto cuando el anterior ha terminado,
    // si no el navegador descarta saltos y el vídeo se queda a medias.
    const flushSeek = () => {
      if (pendingTime === null || video.readyState < 1 || video.seeking) return;
      const time = pendingTime;
      pendingTime = null;
      if (Math.abs(video.currentTime - time) > 0.001) video.currentTime = time;
    };
    const seekTo = (time: number) => { pendingTime = time; flushSeek(); };

    const finish = () => {
      if (finished) return;
      finished = true;
      setPhase("leaving");
    };

    const tick = () => {
      frame = null;
      const distance = target - shown;
      shown = Math.abs(distance) < 0.0015 ? target : shown + distance * SMOOTHING;
      seekTo(timeFor(shown));
      setProgress(shown);
      if (shown >= 1 && target >= 1) { finish(); return; }
      if (shown !== target) frame = requestAnimationFrame(tick);
    };
    const queueTick = () => { if (frame === null) frame = requestAnimationFrame(tick); };

    const move = (deltaPx: number) => {
      if (finished) return;
      target = advanceIntroProgress(target, deltaPx);
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
      // El dedo recorre menos píxeles que la rueda: se amplifica para que el vídeo dure lo mismo.
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

    const onMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) duration = video.duration;
      pendingTime = null;
      seekTo(timeFor(shown));
    };
    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("seeked", flushSeek);

    // El vídeo pesa poco: se carga entero en memoria para que cada salto sea instantáneo.
    fetch(STICKER_VIDEO)
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        video.src = objectUrl;
      })
      .catch(() => { if (!cancelled) video.src = STICKER_VIDEO; });

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("seeked", flushSeek);
      if (frame !== null) cancelAnimationFrame(frame);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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

  const hintOpacity = Math.max(0, 1 - progress * 6);

  return (
    <div
      ref={overlayRef}
      role="presentation"
      aria-label="Intro: pegatina Memento Mundi despegándose con el scroll"
      style={{ transition: `opacity ${FADE_MS}ms ease` }}
      className={`fixed inset-0 z-[90] overflow-hidden bg-[#EAE7DA] ${phase === "leaving" ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      />

      {/* Indicador: solo al inicio, desaparece en cuanto empiezas a deslizar */}
      <div
        style={{ opacity: hintOpacity }}
        className="pointer-events-none absolute bottom-[max(2.5rem,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 transition-opacity duration-200"
      >
        <span className="whitespace-nowrap rounded-full border border-ink/20 bg-cream/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-ink/60 shadow-sm backdrop-blur-sm">
          Desliza para despegar
        </span>
        <ChevronDown size={15} className="animate-bounce text-orange" />
      </div>

      {/* Línea de progreso del despegado */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-ink/10">
        <div className="h-full bg-orange" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
