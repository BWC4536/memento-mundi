import { motion } from "framer-motion";

/**
 * Titulares grandes de la marca. Todo se mide en em de la propia Brasika, así el globo y la cámara
 * escalan con el texto. El tamaño se fuerza con `!` porque el CSS global de h1/h2 lo fija con !important.
 * Dependen de la "ı" (U+0131) que añade public/fonts/brasika-display-es-v2.otf (el nombre lleva versión para que el navegador no use una copia vieja en caché).
 */
const TEAL = "text-[#0A7186]";
const SIZE = "![font-size:clamp(2.6rem,12.5vw,8.25rem)]";

/** Globo terráqueo que hace de punto de la "ı". Centro a .165em del inicio de la letra y .80em sobre la línea base. */
function Globe() {
  return (
    <span aria-hidden className="relative bottom-[.65em] ml-[-.284em] inline-block h-[.3em] w-[.3em] align-baseline">
      <svg viewBox="0 0 24 24" className="block h-full w-full">
        <circle cx="12" cy="12" r="11" fill="#FA9223" />
        <path d="M5 8.5c1.6-1.5 3.6-2 5-1.4 1 .5.7 1.6-.3 2.2-.9.6-.6 1.5.2 2 1 .6.5 2-1 2.5-1.3.4-2 1.6-2.3 3C5.5 15.6 4.2 12 5 8.5Z" fill="#EAE7DA" />
        <path d="M14 4.8c1.7-.2 3.5.6 4.7 1.9-.3.9-1.4 1-2.2 1.5-.9.5-1 1.5-.2 2.2.9.8 2.2 1 3.1 1.9.1 1.5-.4 2.9-1.3 4.1-.5-1.2-1.6-1.8-2.8-1.7-1.3.1-1.8-1.1-1.1-2 .8-1 .4-2-.5-2.4-1.2-.5-1.3-1.9-.3-2.8.5-.4.9-.9 1.1-1.5-.2-.5-.4-.9-.5-1.2Z" fill="#EAE7DA" />
        <circle cx="12" cy="12" r="11" fill="none" stroke="#0B2130" strokeWidth="1.4" />
      </svg>
    </span>
  );
}

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
      <span aria-hidden className="ml-[1.05em] block whitespace-nowrap text-orange">
        Mund&#x131;<Globe />
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
