import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const STICKER_VIDEO = "/memento_sticker.mp4";
// Finaliza el recorrido del vídeo al 85% de la sección para dar paso fluido a los packs
const VIDEO_FINISH_SCROLL = 0.85;

export const resolveStickerProgress = (value: number, reducedMotion: boolean) =>
  reducedMotion ? 0 : Math.max(0, Math.min(1, value));

export const mapScrollToStickerProgress = (rawProgress: number, reducedMotion: boolean) =>
  resolveStickerProgress(rawProgress / VIDEO_FINISH_SCROLL, reducedMotion);

export default function StickerScrollHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number | null>(null);
  const durationRef = useRef(8);
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

    // Renderiza el primer frame de inmediato
    const initVideo = () => {
      durationRef.current = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 8;
      video.currentTime = 0.001;
    };

    if (video.readyState >= 1) {
      initVideo();
    } else {
      video.addEventListener("loadedmetadata", initVideo, { once: true });
    }

    // Interpolación suave (Lerp) para 60fps constantes
    const animateToTarget = () => {
      frameRef.current = null;
      const current = displayProgressRef.current;
      const target = targetProgressRef.current;
      const distance = target - current;

      // Factor 0.28: el doble de reactivo y rápido
      const next = Math.abs(distance) < 0.0003 ? target : current + distance * 0.28;
      displayProgressRef.current = next;
      setProgress(next);

      if (video.readyState >= 1) {
        video.currentTime = next * durationRef.current;
      }

      if (Math.abs(target - next) >= 0.0003) {
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
      // Cuando rect.top baja (scroll down), rawProgress sube de 0 a 1
      // Cuando rect.top sube (scroll up), rawProgress baja de 1 a 0 (REVERSE)
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

  // Animación 3D sutil inspirada en organimo
  const tilt = reducedMotion ? 0 : (1 - progress) * 2;
  const lift = reducedMotion ? 0 : (1 - progress) * 6;
  const scale = reducedMotion ? 1 : 0.98 + progress * 0.02;
  const hintOpacity = Math.max(0, 1 - progress * 6);

  return (
    // Altura 160vh: el doble de rápida que 320vh
    <section
      ref={sectionRef}
      className="relative h-[160vh] bg-cream"
      aria-label="Animación interactiva de la pegatina Memento Mundi"
    >
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden bg-cream px-4 py-8">
        <div
          className="sticker-scroll-layer relative flex items-center justify-center w-full max-w-[1100px]"
          style={{
            transform: `translate3d(0, ${lift}px, 0) rotateX(${tilt}deg) rotateY(${-tilt * 0.4}deg) scale(${scale})`,
            transformStyle: "preserve-3d",
          }}
        >
          <video
            ref={videoRef}
            src={STICKER_VIDEO}
            muted
            playsInline
            preload="auto"
            aria-label="Pegatina Memento Mundi despegándose con scroll"
            className="block max-h-[82vh] w-full object-contain mx-auto select-none pointer-events-none"
          />
        </div>

        {/* Guía sutil que desaparece al hacer scroll y reaparece al volver arriba */}
        <div
          style={{ opacity: hintOpacity }}
          className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 transition-opacity duration-200"
        >
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-ink/50">
            Scroll para despegar
          </span>
          <ChevronDown size={14} className="animate-bounce text-orange" />
        </div>
      </div>
    </section>
  );
}
