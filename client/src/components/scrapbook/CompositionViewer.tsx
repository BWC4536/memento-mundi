import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Minus, Plus, RotateCcw, X } from "lucide-react";
import type { ScrapbookComposition } from "@/lib/composition";
import { useImmersiveMode } from "@/lib/immersive";
import { useElementSize } from "@/hooks/useElementSize";
import { usePanZoom } from "@/hooks/usePanZoom";
import CompositionCanvas from "./CompositionCanvas";

export const VIEWER_ZOOM_LIMITS = { min: 0.5, max: 3 } as const;

type Props = {
  open: boolean;
  composition: ScrapbookComposition;
  title: string;
  location?: string;
  onClose: () => void;
};

function ViewerStage({ composition, title }: { composition: ScrapbookComposition; title: string }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const area = useElementSize(areaRef);
  const aspect = composition.canvas.width / composition.canvas.height;
  const padding = area.width < 640 ? 20 : 56;
  const fitWidth = Math.max(0, Math.min(area.width - padding, (area.height - padding) * aspect));
  const content = { width: fitWidth, height: fitWidth / aspect };
  const { view, dragging, zoomBy, reset, setView, handlers } = usePanZoom(areaRef, { limits: VIEWER_ZOOM_LIMITS, content, container: area });

  return (
    <>
      <div
        ref={areaRef}
        data-testid="viewer-area"
        className={`relative min-h-0 flex-1 touch-none overflow-hidden ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const point = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
          setView((current) => (current.zoom > 1.2 ? { zoom: 1, x: 0, y: 0 } : { zoom: 2, x: point.x - (point.x - current.x) * (2 / current.zoom), y: point.y - (point.y - current.y) * (2 / current.zoom) }));
        }}
        {...handlers}
      >
        {/* Antes de medir el contenedor usamos un ancho CSS equivalente para no parpadear. */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: fitWidth > 0 ? fitWidth * view.zoom : `min(calc(100vw - 40px), calc((100dvh - 200px) * ${aspect}))`,
            transform: `translate(-50%, -50%) translate3d(${view.x}px, ${view.y}px, 0)`,
          }}
        >
            <CompositionCanvas
              composition={composition}
              label={`Composición completa de ${title}`}
              className="rounded-[1.1rem] border-2 border-cream/40 shadow-[10px_10px_0_rgba(250,146,35,.35)]"
              emptyState={<p className="rounded-full border-2 border-ink bg-cream px-4 py-2 text-sm font-black text-ink">Este scrapbook aún está en blanco.</p>}
            />
        </div>
      </div>

      <div className="pointer-events-none flex shrink-0 flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border-2 border-cream/30 bg-ink/90 p-1.5 shadow-[4px_4px_0_rgba(250,146,35,.6)]">
          <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Alejar" className="flex h-11 w-11 items-center justify-center rounded-xl text-cream transition-colors hover:bg-orange hover:text-ink">
            <Minus size={18} />
          </button>
          <span className="min-w-14 text-center text-xs font-black tabular-nums text-cream" aria-live="polite">{Math.round(view.zoom * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1.25)} aria-label="Acercar" className="flex h-11 w-11 items-center justify-center rounded-xl text-cream transition-colors hover:bg-orange hover:text-ink">
            <Plus size={18} />
          </button>
          <button type="button" onClick={reset} className="flex h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-black text-cream transition-colors hover:bg-orange hover:text-ink">
            <RotateCcw size={15} /> Restablecer
          </button>
        </div>
        <p className="text-center text-[11px] font-bold text-cream/55">Arrastra para explorar · pellizca o usa la rueda para hacer zoom</p>
      </div>
    </>
  );
}

/** Vista "Ver": la misma composición que la previsualización, a pantalla completa. */
export default function CompositionViewer({ open, composition, title, location, onClose }: Props) {
  useImmersiveMode(open);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} a pantalla completa`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[95] flex flex-col bg-[#06141d] text-cream"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
            <div className="min-w-0">
              <p className="truncate font-display text-xl text-cream sm:text-2xl">{title}</p>
              {location ? (
                <p className="mt-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[.16em] text-orange">
                  <MapPin size={12} /> {location}
                </p>
              ) : null}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-cream text-ink shadow-[3px_3px_0_#FA9223] transition-transform hover:rotate-90 active:scale-95"
            >
              <X size={22} strokeWidth={2.6} />
            </button>
          </header>
          <ViewerStage composition={composition} title={title} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
