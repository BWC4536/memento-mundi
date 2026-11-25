import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

type BrandDialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Ancho máximo del panel. */
  size?: "md" | "lg";
  /** Elemento visual sobre el título (p. ej. la mascota). */
  media?: ReactNode;
  /** Por encima de otros diálogos (p. ej. el de login usa z-100). */
  zIndex?: number;
};

/**
 * Diálogo con el estilo de la marca: hoja inferior en móvil, tarjeta centrada en escritorio.
 * Cierra con Escape o tocando fuera, enfoca el panel al abrir y devuelve el foco al cerrar.
 */
export default function BrandDialog({ open, onClose, title, description, children, size = "md", media, zIndex = 90 }: BrandDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !panelRef.current) return;
      // Mantiene el foco dentro del diálogo.
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ zIndex }}
          className="fixed inset-0 flex items-end justify-center bg-ink/45 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={{ y: 24, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className={`relative max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto overscroll-contain rounded-[1.75rem] border-2 border-ink bg-cream p-5 text-ink shadow-hard outline-none sm:max-h-[90vh] sm:rounded-[2rem] sm:p-7 ${size === "lg" ? "max-w-2xl" : "max-w-md"}`}
          >
            <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-white/70 transition-transform hover:rotate-90 sm:right-4 sm:top-4">
              <X size={18} />
            </button>
            {media ? <div className="mb-3">{media}</div> : null}
            <h2 id={titleId} className="pr-12 !text-3xl sm:!text-4xl">
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="mt-2 text-sm font-semibold leading-relaxed text-ink/65">
                {description}
              </div>
            ) : null}
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
