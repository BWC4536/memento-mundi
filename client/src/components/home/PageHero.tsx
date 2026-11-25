import type { ReactNode } from "react";
import { motion } from "framer-motion";
import PaisajePhoto, { PhotoTag } from "@/components/home/PaisajePhoto";
import type { Paisaje } from "@/lib/paisajes";

type Props = {
  photo: Paisaje;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  /** compact: banda baja para páginas de lectura (legal). */
  compact?: boolean;
  priority?: boolean;
  className?: string;
};

/**
 * Cabecera con foto de fondo para las páginas interiores: mismo lenguaje que el inicio
 * (borde ink, sombra dura, degradado para que el texto siempre se lea).
 * El tamaño del título se fuerza con `!` porque el CSS global de h1 lo fija con !important.
 */
export default function PageHero({ photo, eyebrow, title, children, compact = false, priority = false, className = "" }: Props) {
  return (
    <section className={`relative isolate overflow-hidden rounded-[2rem] border-2 border-ink bg-ink text-cream shadow-hard ${className}`}>
      <div className="absolute inset-0 -z-10">
        <PaisajePhoto photo={photo} sizes="(min-width: 1280px) 1200px, 100vw" priority={priority} decorative />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/10 sm:bg-gradient-to-r sm:from-ink/90 sm:via-ink/45 sm:to-transparent" />
      </div>
      {compact ? null : (
        <div className="absolute right-4 top-4 hidden sm:block">
          <PhotoTag photo={photo} />
        </div>
      )}
      <div className={`flex flex-col justify-end ${compact ? "min-h-[200px] p-6 sm:min-h-[240px] sm:p-10" : "min-h-[320px] p-6 sm:min-h-[380px] sm:p-10 lg:min-h-[440px] lg:p-14"}`}>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] font-black uppercase tracking-[.2em] text-orange">
          {eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className={`mt-3 max-w-3xl break-words font-display !leading-[.9] tracking-[-.03em] ${compact ? "![font-size:clamp(2.1rem,7vw,3.75rem)]" : "![font-size:clamp(2.75rem,10vw,5.25rem)]"}`}
        >
          {title}
        </motion.h1>
        {children ? <div className="mt-5 max-w-md text-sm font-medium leading-relaxed text-cream/80 sm:text-base">{children}</div> : null}
      </div>
    </section>
  );
}
