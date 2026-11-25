import { motion } from "framer-motion";

/**
 * Titulares grandes de la marca. "Mundi" (Mundi_bola.svg, con el globo como punto de la i) y "Memento"
 * (MEMENTO_FRASE_NARANJA.svg, con la cámara como n) son vectores medidos en em, así escalan con el texto.
 * El tamaño se fuerza con `!` porque el CSS global de h1/h2 lo fija con !important.
 */
const TEAL = "text-[#0A7186]";
const SIZE = "![font-size:clamp(2.6rem,12.5vw,8.25rem)]";

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.6, delay },
});

/** "VIVE EL Mundi" (h1 en la landing; h2 si la página ya tiene su h1). */
export function ViveMundiTitle({ as: Tag = "h1", className = "" }: { as?: "h1" | "h2"; className?: string }) {
  const MotionTag = motion[Tag];
  return (
    <MotionTag {...rise()} aria-label="Vive el Mundi" className={`mx-auto w-fit font-display !leading-[.82] tracking-[-.03em] ${SIZE} ${className}`}>
      <span aria-hidden className="block">
        <span className={`${TEAL} uppercase`}>Vive el</span>
      </span>
      {/* "Mundi" es el SVG vectorial (el punto de la i es el globo): Mundi_bola.svg */}
      <span aria-hidden className="ml-[1.05em] mt-[.04em] block">
        <img src="/Mundi_bola.svg" alt="" draggable={false} className="block h-[.98em] w-auto max-w-none select-none" />
      </span>
    </MotionTag>
  );
}

/** "RECUERDA EL Memento". */
export function RecuerdaMementoTitle({ as: Tag = "h2", className = "" }: { as?: "h1" | "h2"; className?: string }) {
  const MotionTag = motion[Tag];
  return (
    <MotionTag {...rise()} aria-label="Recuerda el Memento" className={`mx-auto w-fit font-display !leading-[.82] tracking-[-.03em] ${SIZE} ${className}`}>
      <span aria-hidden className={`block ${TEAL} uppercase`}>Recuerda</span>
      <span aria-hidden className={`ml-[2.1em] block ${TEAL} uppercase`}>el</span>
      {/* "Memento" es el logotipo (la n es una cámara), en naranja: MEMENTO_FRASE_NARANJA.svg */}
      <span aria-hidden className="mt-[.06em] block">
        <img src="/MEMENTO_FRASE_NARANJA.svg" alt="" draggable={false} className="block h-[.95em] w-auto max-w-none select-none" />
      </span>
    </MotionTag>
  );
}
