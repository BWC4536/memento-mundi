import { motion } from "framer-motion";
import PaisajePhoto, { PhotoTag } from "@/components/home/PaisajePhoto";
import { PAISAJES, type Paisaje } from "@/lib/paisajes";

/**
 * Muro de fotos decorativo (bento). Cada tile tiene su tamaño por breakpoint y el grid
 * se rellena con grid-flow-dense, de modo que en todos los anchos queda un rectángulo sin huecos:
 * - móvil (2 col): verticales de 1 col y bandas de 2 col
 * - tablet (4 col): parejas de 2 col y una banda final a lo ancho
 * - escritorio (6 col × 6 filas): composición asimétrica con dos verticales altas
 */
const TILES: { photo: Paisaje; span: string; sizes: string }[] = [
  { photo: PAISAJES.panama, span: "row-span-2 sm:col-span-2 sm:row-span-4 lg:row-span-4", sizes: "(min-width: 640px) 33vw, 50vw" },
  { photo: PAISAJES.alsacia, span: "row-span-2 sm:col-span-2 sm:row-span-3 lg:row-span-3", sizes: "(min-width: 640px) 33vw, 50vw" },
  { photo: PAISAJES.budapest, span: "col-span-2 row-span-2 sm:col-span-2 sm:row-span-2 lg:row-span-2", sizes: "(min-width: 640px) 33vw, 100vw" },
  { photo: PAISAJES.londres, span: "row-span-2 sm:col-span-2 sm:row-span-4 lg:row-span-4", sizes: "(min-width: 640px) 33vw, 50vw" },
  { photo: PAISAJES.navidad, span: "row-span-2 sm:col-span-2 sm:row-span-3 lg:row-span-3", sizes: "(min-width: 640px) 33vw, 50vw" },
  { photo: PAISAJES.viena, span: "col-span-2 row-span-2 sm:col-span-4 sm:row-span-2 lg:col-span-2 lg:row-span-2", sizes: "(min-width: 1024px) 33vw, 100vw" },
];

export default function PhotoMosaic({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-flow-dense grid-cols-2 auto-rows-[92px] gap-3 min-[420px]:auto-rows-[110px] sm:grid-cols-4 sm:auto-rows-[88px] sm:gap-4 lg:grid-cols-6 lg:auto-rows-[96px] lg:gap-5 xl:auto-rows-[108px] ${className}`}>
      {TILES.map(({ photo, span, sizes }, index) => (
        <motion.figure
          key={photo.slug}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.55, delay: (index % 3) * 0.07 }}
          className={`group relative overflow-hidden rounded-[1.25rem] border-2 border-ink bg-ink shadow-hard-sm sm:rounded-[1.6rem] ${span}`}
        >
          <PaisajePhoto photo={photo} sizes={sizes} className="transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]" />
          {/* Viñeta suave para dar profundidad sin tapar la foto */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_30%,transparent_55%,rgba(11,33,48,.35))]" />
          <figcaption className="pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <PhotoTag photo={photo} />
          </figcaption>
        </motion.figure>
      ))}
    </div>
  );
}
