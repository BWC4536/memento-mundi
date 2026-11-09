import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Play, Sparkles } from "lucide-react";

const STICKER_VIDEO = "/manus-storage/memento_sticker_silent_03ef6eac.mp4";
export const resolveStickerProgress = (value: number, reducedMotion: boolean) => reducedMotion ? 0 : Math.max(0, Math.min(1, value));

export default function StickerScrollHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number | null>(null);
  const durationRef = useRef(8);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(reduce);

    const sync = () => {
      const rect = section.getBoundingClientRect();
      const scrollRange = Math.max(section.offsetHeight - window.innerHeight, 1);
      const nextProgress = resolveStickerProgress(-rect.top / scrollRange, reduce);
      setProgress(nextProgress);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        if (video.readyState >= 1) video.currentTime = nextProgress * durationRef.current;
      });
    };

    const onLoaded = () => {
      durationRef.current = Number.isFinite(video.duration) ? video.duration : 8;
      setReady(true);
      sync();
    };

    video.addEventListener("loadedmetadata", onLoaded);
    if (!reduce) window.addEventListener("scroll", sync, { passive: true });
    if (!reduce) window.addEventListener("resize", sync);
    sync();
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const tilt = reducedMotion ? 0 : (1 - progress) * 3.5;
  const lift = reducedMotion ? 0 : (1 - progress) * 18;
  const scale = reducedMotion ? 1 : 0.92 + progress * 0.08;

  return <section ref={sectionRef} className="relative h-[220vh]" aria-label="Animación de la pegatina Memento Mundi">
    <div className="sticky top-0 flex h-screen items-center overflow-hidden bg-cream px-5 py-8 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(#0B2130 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      <div className="relative mx-auto flex h-full w-full max-w-7xl items-center justify-center overflow-hidden rounded-[2.2rem] border-2 border-ink bg-ink shadow-hard">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(250,146,35,.32),transparent_32%),linear-gradient(135deg,#0b2130,#173b47)]" />
        <div className="absolute left-6 top-6 z-10 max-w-xs text-cream sm:left-10 sm:top-10 sm:max-w-sm">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-orange"><Sparkles size={14} fill="currentColor" /> Un recuerdo que se despega</p>
          <h1 className="mt-4 max-w-[10ch] font-display text-5xl font-black leading-[.88] tracking-[-.07em] sm:text-7xl lg:text-8xl">Lleva tu viaje.<br /><span className="text-orange">Déjalo volver.</span></h1>
          <p className="mt-5 max-w-sm text-sm font-medium leading-relaxed text-cream/70 sm:text-base">Desliza para despegar la pegatina y descubre los objetos que hacen que una historia vuelva contigo.</p>
        </div>
        <div className="absolute bottom-7 left-6 z-10 flex items-center gap-3 text-[10px] font-black uppercase tracking-[.16em] text-cream/60 sm:bottom-10 sm:left-10"><ArrowDown size={16} className={reducedMotion ? "text-orange" : "animate-bounce text-orange"} /> {reducedMotion ? "Animación pausada" : "Sigue bajando"}</div>
        <div className="absolute bottom-7 right-6 z-10 hidden items-center gap-2 rounded-full border-2 border-cream/30 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-cream/70 sm:flex"><span className="h-2 w-2 rounded-full bg-orange" /> {Math.round(progress * 100)}% despegado</div>
        <div className="relative z-10 mt-32 w-[min(78vw,720px)] sm:ml-[28%] sm:mt-8 sm:w-[min(56vw,720px)]" style={{ perspective: 1400 }}>
          <div className="sticker-scroll-layer absolute -inset-8 rounded-[2.5rem] bg-orange/25 blur-2xl" style={{ transform: `translateY(${lift}px) rotate(${tilt}deg) scale(${scale})`, transition: "transform 90ms linear" }} />
          <div className="sticker-scroll-layer relative overflow-hidden rounded-[1.8rem] border-2 border-cream/80 bg-cream p-2 shadow-[14px_18px_0_rgba(234,231,218,.22)]" style={{ transform: `translate3d(0, ${lift}px, 0) rotateX(${tilt}deg) rotateY(${-tilt * 0.7}deg) scale(${scale})`, transformStyle: "preserve-3d", transition: "transform 90ms linear" }}>
            <video ref={videoRef} src={STICKER_VIDEO} muted playsInline preload="auto" aria-label="Pegatina Memento Mundi despegándose" className="block aspect-[1280/618] w-full rounded-[1.35rem] border-2 border-ink object-cover" />
            <div className="pointer-events-none absolute inset-x-6 bottom-5 flex items-end justify-between sm:inset-x-10 sm:bottom-8"><span className="rounded-full border-2 border-ink bg-cream px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-ink">Memento Mundi · edición física</span><span className="hidden rounded-full border-2 border-ink bg-orange px-4 py-2 text-xs font-black text-ink sm:block"><Play size={13} className="mr-1 inline" /> Scroll story</span></div>
          </div>
        </div>
        <div className={`absolute bottom-24 left-1/2 z-10 -translate-x-1/2 transition-all duration-500 sm:bottom-10 ${progress > .86 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}><a href="#packs" className="flex items-center gap-2 rounded-xl border-2 border-ink bg-orange px-5 py-3 text-sm font-black text-ink shadow-[4px_4px_0_#EAE7DA]"><span>Entrar a los packs</span><ArrowRight size={17} /></a></div>
        {!ready && <div className="absolute bottom-7 right-6 rounded-full border border-cream/20 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-cream/50 sm:hidden">Cargando gesto…</div>}
      </div>
    </div>
  </section>;
}
