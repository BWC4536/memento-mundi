import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const STICKER_VIDEO = "/memento_sticker.mp4";
// El despegado termina al 82% del scroll de la sección, antes de que el bloque sticky se suelte.
const VIDEO_FINISH_SCROLL = 0.82;
// Margen al final para no caer en un frame negro tras el último fotograma.
const END_GUARD_SECONDS = 0.05;
// Cuánto se acerca el progreso visible al objetivo en cada frame (0-1). Más alto = más directo.
const SMOOTHING = 0.35;

export const resolveStickerProgress = (value: number, reducedMotion: boolean) =>
  reducedMotion ? 0 : Math.max(0, Math.min(1, value));

export const mapScrollToStickerProgress = (rawProgress: number, reducedMotion: boolean) =>
  resolveStickerProgress(rawProgress / VIDEO_FINISH_SCROLL, reducedMotion);

export default function StickerScrollHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hintOpacity, setHintOpacity] = useState(1);

  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let duration = 0;
    let target = 0;
    let shown = 0;
    let frame: number | null = null;
    let pendingTime: number | null = null;
    let cancelled = false;
    let objectUrl: string | null = null;

    const timeFor = (progress: number) => {
      if (duration <= 0) return 0;
      const maxTime = Math.max(0, duration - END_GUARD_SECONDS);
      return Math.min(maxTime, Math.max(0.001, progress * duration));
    };

    // Seek en cadena: solo se lanza un salto cuando el anterior ha terminado.
    // Si no, el navegador descarta saltos y el vídeo se queda a medias.
    const flushSeek = () => {
      if (pendingTime === null || video.readyState < 1 || video.seeking) return;
      const time = pendingTime;
      pendingTime = null;
      if (Math.abs(video.currentTime - time) > 0.001) video.currentTime = time;
    };

    const seekTo = (time: number) => {
      pendingTime = time;
      flushSeek();
    };

    const tick = () => {
      frame = null;
      const distance = target - shown;
      shown = Math.abs(distance) < 0.0015 ? target : shown + distance * SMOOTHING;
      seekTo(timeFor(shown));
      setHintOpacity(Math.max(0, 1 - shown * 5));
      if (shown !== target) frame = requestAnimationFrame(tick);
    };

    const queueTick = () => {
      if (frame === null) frame = requestAnimationFrame(tick);
    };

    const syncTarget = () => {
      const rect = section.getBoundingClientRect();
      const scrollRange = Math.max(section.offsetHeight - window.innerHeight, 1);
      const rawProgress = Math.max(0, Math.min(1, -rect.top / scrollRange));
      target = mapScrollToStickerProgress(rawProgress, reduce);
      queueTick();
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
      .catch(() => {
        if (!cancelled) video.src = STICKER_VIDEO;
      });

    window.addEventListener("scroll", syncTarget, { passive: true });
    window.addEventListener("resize", syncTarget);
    syncTarget();

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", syncTarget);
      window.removeEventListener("resize", syncTarget);
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("seeked", flushSeek);
      if (frame !== null) cancelAnimationFrame(frame);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return (
    // 200vh: recorrido corto (el doble de rápido) y el vídeo termina antes de soltar el sticky.
    <section
      ref={sectionRef}
      className="relative h-[200vh] w-full bg-[#EAE7DA]"
      aria-label="Animación a pantalla completa de la pegatina Memento Mundi"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-[#EAE7DA] supports-[height:100dvh]:h-[100dvh]">
        <video
          ref={videoRef}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-label="Pegatina Memento Mundi despegándose con el scroll"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />

        {/* Indicador de scroll: solo al inicio, desaparece en cuanto empiezas a bajar */}
        <div
          style={{ opacity: hintOpacity }}
          className="pointer-events-none absolute bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5.5rem))] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 sm:bottom-28"
        >
          <span className="whitespace-nowrap rounded-full border border-ink/20 bg-cream/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-ink/60 shadow-sm backdrop-blur-sm">
            Scroll para despegar
          </span>
          <ChevronDown size={15} className="animate-bounce text-orange" />
        </div>
      </div>
    </section>
  );
}
