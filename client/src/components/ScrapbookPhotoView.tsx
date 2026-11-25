import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Camera, Clock3, Edit3, Layers3, Maximize2, MapPin, Users } from "lucide-react";
import { getContentBounds, type ScrapbookComposition } from "@/lib/composition";
import { formatDate, relativeDate } from "@/lib/scrapbook-library";
import type { Scrapbook } from "@/lib/scrapbooks";
import CompositionCanvas from "@/components/scrapbook/CompositionCanvas";
import CompositionViewer from "@/components/scrapbook/CompositionViewer";
import DownloadImageButton from "@/components/scrapbook/DownloadImageButton";
import Mascot from "@/components/ui/Mascot";

type Props = {
  scrapbook: Scrapbook;
  composition: ScrapbookComposition;
  onBack: () => void;
  onEdit: () => void;
  onScan?: () => void;
  /** Abre directamente la pantalla completa (deep link ?fullscreen). */
  initialFullscreen?: boolean;
};

function Chip({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return <span className={`flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1.5 text-xs font-black ${accent ? "bg-orange" : "bg-white/60"}`}>{children}</span>;
}

/**
 * Vista previa del scrapbook: muestra la composición completa guardada (no
 * solo la portada) con las acciones Editar y Ver arriba.
 */
export default function ScrapbookPhotoView({ scrapbook, composition, onBack, onEdit, initialFullscreen = false }: Props) {
  const [fullscreen, setFullscreen] = useState(initialFullscreen);
  const elementCount = composition.elements.length;
  const bounds = useMemo(() => getContentBounds(composition), [composition]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-cream pb-36">
      <div className="mx-auto flex max-w-6xl flex-col px-4 pt-20 sm:px-8 sm:pt-24 lg:px-12">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 text-xs font-black uppercase tracking-[.14em]">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-white/60">
              <ArrowLeft size={17} />
            </span>
            <span>Scrapbooks</span>
          </button>
          <div className="flex items-center gap-2" role="toolbar" aria-label="Acciones del scrapbook">
            <button
              type="button"
              onClick={onEdit}
              className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-4 text-sm font-black shadow-hard-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              <Edit3 size={17} /> Editar
            </button>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-ink px-4 text-sm font-black text-cream shadow-hard-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              <Maximize2 size={17} /> Ver
            </button>
            <DownloadImageButton
              composition={composition}
              title={scrapbook.title}
              className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-white/70 px-3 text-sm font-black shadow-hard-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-60 sm:px-4"
            />
          </div>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative mx-auto mt-5 w-full rounded-[1.75rem] border-2 border-ink bg-[#D8E2DC] p-2.5 shadow-hard sm:p-3"
          // La composición entera cabe en pantalla (también en formatos verticales).
          style={{ maxWidth: `max(18rem, calc((100dvh - 15rem) * ${bounds.width / bounds.height}))` }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => setFullscreen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setFullscreen(true);
              }
            }}
            aria-label="Ver la composición a pantalla completa"
            className="block w-full cursor-zoom-in rounded-[1.2rem] text-left focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-orange"
          >
            <CompositionCanvas
              composition={composition}
              bounds={bounds}
              label={`Previsualización de ${scrapbook.title}`}
              className="rounded-[1.2rem] border-2 border-ink"
              emptyState={
                <div className="max-w-xs rounded-2xl border-2 border-ink bg-cream p-4 text-center shadow-hard-sm"><div className="hidden sm:block"><Mascot name="12-scrapbook-album" size="sm" className="mx-auto" /></div>
                  <p className="font-display text-2xl">Página en blanco</p>
                  <p className="mt-1 text-sm font-semibold text-ink/65">Pulsa Editar para añadir fotos, notas y decoración.</p>
                </div>
              }
            />
          </div>
          <span className="pointer-events-none absolute bottom-5 left-5 rounded-full border-2 border-ink bg-cream px-3 py-1 text-[9px] font-black uppercase tracking-[.15em] sm:bottom-6 sm:left-6">
            Previsualización
          </span>
        </motion.section>

        <section className="mt-7 grid gap-5 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange">Scrapbook · {scrapbook.country}</p>
            <h1 className="mt-2 font-display">{scrapbook.title}</h1>
            {scrapbook.description ? <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-ink/65">{scrapbook.description}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Chip accent>
              <MapPin size={14} /> {scrapbook.location}
            </Chip>
            <Chip>
              <Camera size={14} /> {scrapbook.photos} fotos
            </Chip>
            <Chip>
              <Users size={14} /> {scrapbook.invited + 1} personas
            </Chip>
            <Chip>
              <Layers3 size={14} /> {elementCount} elementos
            </Chip>
            <Chip>
              <Clock3 size={14} /> Editado {relativeDate(composition.updatedAt ?? scrapbook.updatedAt)}
            </Chip>
            <Chip>
              <CalendarDays size={14} /> Creado {formatDate(scrapbook.createdAt)}
            </Chip>
          </div>
        </section>
      </div>

      <CompositionViewer open={fullscreen} composition={composition} title={scrapbook.title} location={scrapbook.location} onClose={() => setFullscreen(false)} />
    </main>
  );
}
