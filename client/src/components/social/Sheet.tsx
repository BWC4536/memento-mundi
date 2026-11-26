import { useEffect, type ReactNode, type RefObject } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useImmersiveMode } from "@/lib/immersive";

type Props = {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Ancho máximo en escritorio. */
  width?: "md" | "lg" | "xl";
  /** Capa: las hojas encima de otras (comentarios, publicar) usan "top". */
  layer?: "base" | "top";
  /** Contenedor con scroll (para el scroll infinito de dentro). */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** Sin padding: la cabecera de un lugar ocupa todo el ancho. */
  bleed?: boolean;
  hideClose?: boolean;
};

const WIDTHS = { md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-3xl" };

/** Hoja inferior en móvil y ventana centrada en escritorio. Oculta el dock y bloquea el scroll de la página. */
export default function Sheet({ label, onClose, children, width = "lg", layer = "base", scrollRef, bleed = false, hideClose = false }: Props) {
  useImmersiveMode(true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className={`fixed inset-0 flex items-end justify-center bg-ink/45 backdrop-blur-[3px] sm:items-center sm:p-6 ${layer === "top" ? "z-[60]" : "z-50"}`}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        initial={{ y: "18%", opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "14%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onClick={(event) => event.stopPropagation()}
        className={`relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border-2 border-b-0 border-ink bg-cream shadow-hard sm:max-h-[90dvh] sm:rounded-[2rem] sm:border-b-2 ${WIDTHS[width]}`}
      >
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-1.5 w-12 -translate-x-1/2 rounded-full bg-ink/25 sm:hidden" aria-hidden />
        {hideClose ? null : (
          <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-cream/90 shadow-hard-sm transition-transform hover:rotate-90">
            <X size={17} />
          </button>
        )}
        <div ref={scrollRef} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${bleed ? "" : "p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 sm:p-6"}`}>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
