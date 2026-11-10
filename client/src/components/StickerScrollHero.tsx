import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const STICKER_VIDEO = "/memento_sticker.mp4";
// Píxeles de scroll (rueda, dedo o teclado) necesarios para ver el vídeo entero: ~5 s de gesto continuo.
export const INTRO_SCROLL_PX = 2400;
// Cuánto se acerca el progreso visible al objetivo en cada frame (0-1). Más alto = más directo.
const SMOOTHING = 0.22;
// Duración del fundido a la página una vez termina el vídeo.
const FADE_MS = 900;
// Velocidad de reproducción mientras se extraen los fotogramas (más rápido = lista antes).
const CAPTURE_RATE = 2;
// Fotogramas por segundo de vídeo que se guardan y tamaño máximo de cada uno.
const DESKTOP_PROFILE = { fps: 20, maxSide: 1024, maxFrames: 160 };
const MOBILE_PROFILE = { fps: 12, maxSide: 720, maxFrames: 110 };

export const resolveStickerProgress = (value: number, reducedMotion: boolean) =>
  reducedMotion ? 0 : Math.max(0, Math.min(1, value));

/** Avanza (o rebobina, si delta < 0) el progreso de la intro según los píxeles desplazados. */
export const advanceIntroProgress = (current: number, deltaPx: number, totalPx = INTRO_SCROLL_PX) =>
  Math.max(0, Math.min(1, current + deltaPx / totalPx));

type Phase = "intro" | "leaving" | "done";
type Frame = { time: number; image: HTMLCanvasElement };
type Profile = typeof DESKTOP_PROFILE;

const pickProfile = (): Profile =>
  window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768 ? MOBILE_PROFILE : DESKTOP_PROFILE;

/**
 * Extrae fotogramas del vídeo a canvases pequeños. Buscar en un vídeo con `currentTime` es lento
 * (hay que decodificar desde el último keyframe), así que durante el scroll no llegaría a pintar nada.
 * Con los fotogramas ya extraídos, cada frame se dibuja al instante.
 */
async function captureFrames(
  src: string,
  profile: Profile,
  onFrame: (frame: Frame, duration: number) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;

  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("No se pudo cargar el vídeo")), { once: true });
  });
  if (isCancelled()) return;

  const duration = video.duration;
  const scale = Math.min(1, profile.maxSide / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const step = Math.max(1 / profile.fps, duration / profile.maxFrames);

  const grab = (time: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
    onFrame({ time, image: canvas }, duration);
  };

  const played = await video.play().then(() => true).catch(() => false);
  if (isCancelled()) { video.pause(); return; }

  if (played) {
    // Reproducción acelerada: se guarda un fotograma cada `step` segundos de vídeo.
    video.playbackRate = CAPTURE_RATE;
    await new Promise<void>((resolve) => {
      let nextTime = 0;
      const hasFrameCallback = "requestVideoFrameCallback" in video;
      const onPresented = (_now: number, meta?: { mediaTime: number }) => {
        if (isCancelled()) { video.pause(); resolve(); return; }
        const time = meta?.mediaTime ?? video.currentTime;
        if (time >= nextTime - 0.001) {
          nextTime = time + step;
          grab(time);
        }
        if (video.ended) { resolve(); return; }
        schedule();
      };
      const schedule = () => {
        if (hasFrameCallback) {
          (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: typeof onPresented) => void }).requestVideoFrameCallback(onPresented);
        } else {
          requestAnimationFrame((now) => onPresented(now));
        }
      };
      video.addEventListener("ended", () => resolve(), { once: true });
      schedule();
    });
    return;
  }

  // Si el navegador no deja reproducir (p. ej. ahorro de batería), se buscan los fotogramas uno a uno.
  for (let time = 0; time < duration; time += step) {
    if (isCancelled()) return;
    video.currentTime = Math.min(time, Math.max(0, duration - 0.05));
    await new Promise<void>((resolve) => video.addEventListener("seeked", () => resolve(), { once: true }));
    grab(time);
  }
}

/**
 * Intro a pantalla completa de la tienda.
 * Bloquea el scroll de la página; la rueda, el dedo o el teclado mueven el vídeo hacia delante
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

  // Extracción de fotogramas, scrub con el gesto y pintado en canvas.
  useEffect(() => {
    if (phase !== "intro") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const frames: Frame[] = [];
    let duration = 0;
    let captureDone = false;
    let target = 0;
    let shown = 0;
    let drawnIndex = -1;
    let frame: number | null = null;
    let finished = false;
    let cancelled = false;
    let objectUrl: string | null = null;
    let lastTouchY: number | null = null;

    // Hasta dónde se puede avanzar: solo lo que ya está extraído.
    const readyProgress = () => {
      if (captureDone) return 1;
      if (!duration || frames.length === 0) return 0;
      return frames[frames.length - 1].time / duration;
    };

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      drawnIndex = -1;
      queueTick();
    };

    const draw = (index: number) => {
      const image = frames[index]?.image;
      if (!image) return;
      // Equivalente a object-fit: cover.
      const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      drawnIndex = index;
    };

    const indexFor = (progress: number) => {
      if (frames.length === 0) return -1;
      const time = progress * duration;
      // Los fotogramas están ordenados por tiempo: se busca el más cercano.
      let lo = 0;
      let hi = frames.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (frames[mid].time < time) lo = mid + 1; else hi = mid;
      }
      if (lo > 0 && Math.abs(frames[lo - 1].time - time) < Math.abs(frames[lo].time - time)) lo -= 1;
      return lo;
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
      shown = Math.abs(distance) < 0.0015 ? clampedTarget : shown + distance * SMOOTHING;
      const index = indexFor(shown);
      if (index !== drawnIndex) draw(index);
      if (shown >= 1 && target >= 1 && captureDone) { finish(); return; }
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

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKey);

    // El vídeo pesa poco: se descarga entero y de ahí se extraen los fotogramas.
    const profile = pickProfile();
    fetch(STICKER_VIDEO)
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        return captureFrames(objectUrl, profile, (captured, videoDuration) => {
          duration = videoDuration;
          frames.push(captured);
          queueTick();
        }, () => cancelled);
      })
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        captureDone = true;
        // Sin fotogramas (vídeo roto) no hay intro que mostrar.
        if (frames.length === 0) finish();
        else queueTick();
      });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      if (frame !== null) cancelAnimationFrame(frame);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      frames.length = 0;
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
