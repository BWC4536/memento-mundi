import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IntroVideoHeroProps {
  src?: string;
  isFinished: boolean;
  onFinished: () => void;
}

export default function IntroVideoHero({
  src = "/memento_sticker.mp4",
  isFinished,
  onFinished,
}: IntroVideoHeroProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 1. Bloqueo estricto del scroll del body mientras el vídeo se reproduce
  useEffect(() => {
    if (!isFinished) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isFinished]);

  // 2. Respaldo para autoplay en navegadores móviles (iOS / Safari)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.warn("[IntroVideoHero] Autoplay detenido por navegador:", err);
      });
    }
  }, []);

  return (
    <AnimatePresence mode="wait">
      {!isFinished && (
        <motion.div
          key="memento-intro-hero"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#EAE7DA] overflow-hidden"
        >
          <video
            ref={videoRef}
            src={src}
            autoPlay
            muted
            playsInline
            onEnded={onFinished}
            className="w-full h-full object-cover select-none pointer-events-none"
          />

          {/* Botón discreto para saltar intro (UX estándar tipo organimo.com) */}
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.4 }}
            onClick={onFinished}
            className="absolute bottom-8 right-8 z-[110] rounded-full border-2 border-ink/20 bg-[#EAE7DA]/85 px-4 py-2 text-xs font-black uppercase tracking-wider text-ink backdrop-blur-md transition-all hover:bg-ink hover:text-cream active:scale-95 shadow-hard-sm"
          >
            Saltar intro ✕
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
