import { useEffect, useRef, useState } from "react";

const STICKER_VIDEO = "/manus-storage/memento_sticker_silent_03ef6eac.mp4";
const VIDEO_FINISH_SCROLL = 0.82;

export const resolveStickerProgress = (value: number, reducedMotion: boolean) => reducedMotion ? 0 : Math.max(0, Math.min(1, value));
export const mapScrollToStickerProgress = (rawProgress: number, reducedMotion: boolean) => resolveStickerProgress(rawProgress / VIDEO_FINISH_SCROLL, reducedMotion);

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

    const animateToTarget = () => {
      frameRef.current = null;
      const current = displayProgressRef.current;
      const target = targetProgressRef.current;
      const distance = target - current;
      const next = Math.abs(distance) < 0.0004 ? target : current + distance * 0.18;
      displayProgressRef.current = next;
      setProgress(next);
      if (video.readyState >= 1) video.currentTime = next * durationRef.current;
      if (Math.abs(target - next) >= 0.0004) frameRef.current = requestAnimationFrame(animateToTarget);
    };

    const queueAnimation = () => {
      if (!frameRef.current) frameRef.current = requestAnimationFrame(animateToTarget);
    };

    const syncTarget = () => {
      const rect = section.getBoundingClientRect();
      const scrollRange = Math.max(section.offsetHeight - window.innerHeight, 1);
      const rawProgress = Math.max(0, Math.min(1, -rect.top / scrollRange));
      targetProgressRef.current = mapScrollToStickerProgress(rawProgress, reduce);
      queueAnimation();
    };

    const onLoaded = () => {
      durationRef.current = Number.isFinite(video.duration) ? video.duration : 8;
      if (reduce) {
        targetProgressRef.current = 0;
        displayProgressRef.current = 0;
        video.currentTime = 0;
        setProgress(0);
      } else {
        syncTarget();
      }
    };

    video.addEventListener("loadedmetadata", onLoaded);
    if (!reduce) {
      window.addEventListener("scroll", syncTarget, { passive: true });
      window.addEventListener("resize", syncTarget);
      syncTarget();
    }
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      window.removeEventListener("scroll", syncTarget);
      window.removeEventListener("resize", syncTarget);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const tilt = reducedMotion ? 0 : (1 - progress) * 1.8;
  const lift = reducedMotion ? 0 : (1 - progress) * 7;
  const scale = reducedMotion ? 1 : 0.97 + progress * 0.03;

  return <section ref={sectionRef} className="relative h-[320vh] bg-cream" aria-label="Animación de la pegatina Memento Mundi">
    <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden bg-cream px-3 py-6 sm:px-8 sm:py-10 lg:px-12">
      <div className="sticker-scroll-layer w-full max-w-[1240px]" style={{ transform: `translate3d(0, ${lift}px, 0) rotateX(${tilt}deg) rotateY(${-tilt * 0.5}deg) scale(${scale})`, transformStyle: "preserve-3d" }}>
        <video ref={videoRef} src={STICKER_VIDEO} muted playsInline preload="auto" aria-label="Pegatina Memento Mundi despegándose" className="block max-h-[84vh] w-full object-contain" />
      </div>
    </div>
  </section>;
}
