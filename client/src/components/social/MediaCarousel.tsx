import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Heart, Volume2, VolumeX } from "lucide-react";
import { useVideoMuted } from "@/hooks/useSocial";
import { mediaAspect } from "@/lib/social/format";
import type { SocialMedia } from "@/lib/social/types";

/** Vídeo que se reproduce solo cuando está a la vista (y se pausa al salir), en bucle y sin sonido por defecto. */
function AutoVideo({ media, label }: { media: SocialMedia; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useVideoMuted();

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.6) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative h-full w-full bg-ink">
      <video ref={ref} src={media.url} muted loop playsInline preload="metadata" aria-label={label} className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setMuted(!muted);
        }}
        onPointerUp={(event) => event.stopPropagation()}
        aria-label={muted ? "Activar sonido" : "Silenciar"}
        className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-cream backdrop-blur transition-transform hover:scale-105"
      >
        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>
    </div>
  );
}

type Props = {
  media: SocialMedia[];
  alt: string;
  /** Doble toque: like (como en Instagram). */
  onDoubleTap?: () => void;
};

export default function MediaCarousel({ media, alt, onDoubleTap }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const aspect = mediaAspect(media[0]);
  const many = media.length > 1;

  const goTo = (next: number) => {
    const track = trackRef.current;
    if (!track) return;
    const target = Math.max(0, Math.min(media.length - 1, next));
    track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
  };

  const pressAt = useRef<{ x: number; y: number } | null>(null);

  const handleTap = (event: ReactPointerEvent) => {
    // Si el dedo se ha movido, era un deslizamiento del carrusel, no un toque.
    const start = pressAt.current;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      setBurst((value) => value + 1);
      onDoubleTap?.();
    } else {
      lastTap.current = now;
    }
  };

  if (media.length === 0) return null;

  return (
    <div className="group/carousel relative w-full min-w-0 max-w-full select-none overflow-hidden bg-ink/5" style={{ aspectRatio: String(aspect) }} onPointerDown={(event) => (pressAt.current = { x: event.clientX, y: event.clientY })} onPointerUp={handleTap}>
      <div
        ref={trackRef}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(event) => {
          const track = event.currentTarget;
          setIndex(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
        }}
      >
        {media.map((item, position) => (
          <div key={item.id} className="h-full w-full shrink-0 snap-center snap-always">
            {item.kind === "video" ? (
              <AutoVideo media={item} label={`${alt} · vídeo ${position + 1}`} />
            ) : (
              <img src={item.url} alt={many ? `${alt} · foto ${position + 1} de ${media.length}` : alt} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
            )}
          </div>
        ))}
      </div>

      {many ? (
        <>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-black text-cream backdrop-blur">
            {index + 1}/{media.length}
          </span>
          {index > 0 ? (
            <button type="button" aria-label="Anterior" onPointerUp={(event) => event.stopPropagation()} onClick={() => goTo(index - 1)} className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-cream/90 opacity-0 shadow-hard-sm transition-opacity group-hover/carousel:opacity-100 sm:flex">
              <ChevronLeft size={16} />
            </button>
          ) : null}
          {index < media.length - 1 ? (
            <button type="button" aria-label="Siguiente" onPointerUp={(event) => event.stopPropagation()} onClick={() => goTo(index + 1)} className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-cream/90 opacity-0 shadow-hard-sm transition-opacity group-hover/carousel:opacity-100 sm:flex">
              <ChevronRight size={16} />
            </button>
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {media.map((item, position) => (
              <span key={item.id} className={`h-1.5 rounded-full transition-all duration-200 ${position === index ? "w-4 bg-cream" : "w-1.5 bg-cream/55"}`} />
            ))}
          </div>
        </>
      ) : null}

      <AnimatePresence>
        {burst > 0 ? (
          <motion.span
            key={burst}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.15, 1, 1.1] }}
            transition={{ duration: 0.85, times: [0, 0.25, 0.7, 1] }}
            onAnimationComplete={() => setBurst(0)}
          >
            <Heart size={96} className="fill-[#e0452b] text-ink drop-shadow-[4px_4px_0_#0B2130]" strokeWidth={1.6} />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
