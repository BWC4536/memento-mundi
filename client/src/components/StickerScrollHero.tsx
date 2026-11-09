import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const STICKER_VIDEO = "/memento_sticker.mp4";
// Al alcanzar el 60% del scroll de la sección, el vídeo ya ha completado el 100% del despegado
const VIDEO_FINISH_SCROLL = 0.60;

export const resolveStickerProgress = (value: number, reducedMotion: boolean) =>
  reducedMotion ? 0 : Math.max(0, Math.min(1, value));

export const mapScrollToStickerProgress = (rawProgress: number, reducedMotion: boolean) =>
  resolveStickerProgress(rawProgress / VIDEO_FINISH_SCROLL, reducedMotion);

export default function StickerScrollHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number | null>(null);
  const durationRef = useRef(8.0);
  const targetProgressRef = useRef(0);
  const displayProgressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(reduce);

    const initDuration = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        durationRef.current = video.duration;
      }
      // Forzar carga del primer frame
      video.currentTime = 0.001;
    };

    if (video.readyState >= 1) {
      initDuration();
    } else {
      video.addEventListener("loadedmetadata", initDuration, { once: true });
    }

    // Interpolación suave y rápida (Lerp) para fluidez a 60 FPS
    const animateToTarget = () => {
      frameRef.current = null;
      const current = displayProgressRef.current;
      const target = targetProgressRef.current;
      const distance = target - current;

      let next: number;
      if (Math.abs(distance) < 0.002) {
        next = target;
      } else {
        next = current + distance * 0.32;
      }

      displayProgressRef.current = next;
      setProgress(next);

      if (video.readyState >= 1) {
        // Capping a duration - 0.04s asegura que el último frame se muestre completo sin pantalla en blanco
        const maxTime = Math.max(0, durationRef.current - 0.04);
        video.currentTime = Math.min(maxTime, Math.max(0.001, next * durationRef.current));
      }

      if (Math.abs(target - next) >= 0.001) {
        frameRef.current = requestAnimationFrame(animateToTarget);
      }
    };

    const queueAnimation = () => {
      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(animateToTarget);
      }
    };

    const syncTarget = () => {
      const rect = section.getBoundingClientRect();
      const scrollRange = Math.max(section.offsetHeight - window.innerHeight, 1);
      // Al bajar, avanza de 0 a 1. Al subir, retrocede de 1 a 0 (REVERSE exacto)
      const rawProgress = Math.max(0, Math.min(1, -rect.top / scrollRange));
      targetProgressRef.current = mapScrollToStickerProgress(rawProgress, reduce);
      queueAnimation();
    };

    if (!reduce) {
      window.addEventListener("scroll", syncTarget, { passive: true });
      window.addEventListener("resize", syncTarget);
      syncTarget();
    }

    return () => {
      window.removeEventListener("scroll", syncTarget);
      window.removeEventListener("resize", syncTarget);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const hintOpacity = Math.max(0, 1 - progress * 5);

  return (
    // Altura 200vh optimizada: el scroll es el doble de rápido y el vídeo termina garantizado
    <section
      ref={sectionRef}
      className="relative h-[200vh] w-full bg-[#EAE7DA]"
      aria-label="Animación interactiva a pantalla completa de la pegatina Memento Mundi"
    >
      <div className="sticky top-0 flex h-screen h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#EAE7DA]">
        {/* Contenedor del vídeo en pantalla completa 100% responsive */}
        <div className="relative h-full w-full flex items-center justify-center">
          <video
            ref={videoRef}
            src={STICKER_VIDEO}
            muted
            playsInline
            preload="auto"
            aria-label="Pegatina Memento Mundi despegándose con scroll"
            className="h-full w-full object-cover select-none pointer-events-none"
          />
        </div>

        {/* Indicador sutil de scroll: solo visible al inicio, desaparece de inmediato al scrollear */}
        <div
          style={{ opacity: hintOpacity }}
          className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 transition-opacity duration-200"
        >
          <span className="rounded-full border border-ink/20 bg-cream/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-ink/60 backdrop-blur-sm shadow-sm">
            Scroll para despegar
          </span>
          <ChevronDown size={15} className="animate-bounce text-orange" />
        </div>
      </div>
    </section>
  );
}
