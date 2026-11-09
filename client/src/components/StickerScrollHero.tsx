import { useEffect, useRef, useState } from "react";

const STICKER_VIDEO = "/manus-storage/memento_sticker_silent_03ef6eac.mp4";
export const resolveStickerProgress = (value: number, reducedMotion: boolean) => reducedMotion ? 0 : Math.max(0, Math.min(1, value));

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
      const next = Math.abs(distance) < 0.0006 ? target : current + distance * 0.12;
      displayProgressRef.current = next;
      setProgress(next);
      if (video.readyState >= 1) video.currentTime = next * durationRef.current;
      if (Math.abs(target - next) >= 0.0006) frameRef.current = requestAnimationFrame(animateToTarget);
    };

    const queueAnimation = () => {
      if (!frameRef.current) frameRef.current = requestAnimationFrame(animateToTarget);
    };

    const syncTarget = () => {
      const rect = section.getBoundingClientRect();
      const scrollRange = Math.max(section.offsetHeight - window.innerHeight, 1);
      targetProgressRef.current = resolveStickerProgress(-rect.top / scrollRange, reduce);
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

  const tilt = reducedMotion ? 0 : (1 - progress) * 3.5;
  const lift = reducedMotion ? 0 : (1 - progress) * 18;
  const scale = reducedMotion ? 1 : 0.92 + progress * 0.08;

  return <section ref={sectionRef} className="relative h-[240vh]" aria-label="Animación de la pegatina Memento Mundi">
    <div className="sticky top-0 flex h-screen items-center overflow-hidden bg-cream px-3 py-5 sm:px-8 sm:py-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(#0B2130 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      <div className="relative mx-auto flex h-full w-full max-w-7xl items-center justify-center overflow-hidden rounded-[2.2rem] border-2 border-ink bg-ink shadow-hard">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_42%,rgba(250,146,35,.32),transparent_30%),linear-gradient(135deg,#0b2130,#173b47)]" />
        <div className="sticker-scroll-layer absolute -inset-8 rounded-[2.5rem] bg-orange/25 blur-2xl" style={{ transform: `translateY(${lift}px) rotate(${tilt}deg) scale(${scale})` }} />
        <div className="sticker-scroll-layer relative z-10 w-[92vw] max-w-[1080px] overflow-hidden rounded-[1.8rem] border-2 border-cream/80 bg-cream p-2 shadow-[14px_18px_0_rgba(234,231,218,.22)] sm:w-[78vw]" style={{ transform: `translate3d(0, ${lift}px, 0) rotateX(${tilt}deg) rotateY(${-tilt * 0.7}deg) scale(${scale})`, transformStyle: "preserve-3d" }}>
          <video ref={videoRef} src={STICKER_VIDEO} muted playsInline preload="auto" aria-label="Pegatina Memento Mundi despegándose" className="block aspect-[1280/618] w-full rounded-[1.35rem] border-2 border-ink object-cover" />
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 h-1 overflow-hidden rounded-full bg-ink/15 sm:bottom-5 sm:left-5 sm:right-5"><div className="h-full rounded-full bg-orange" style={{ width: `${progress * 100}%` }} /></div>
        </div>
      </div>
    </div>
  </section>;
}
