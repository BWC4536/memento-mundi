import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { RecuerdaMementoTitle, ViveMundiTitle } from "@/components/home/BrandHeadlines";
import CurvedGalleryArc from "@/components/home/CurvedGalleryArc";
import PhotoCarousel3D from "@/components/home/PhotoCarousel3D";
import { ARC_PAISAJES, CAROUSEL_PAISAJES } from "@/lib/paisajes";

/** "VIVE EL Mundi" + carrusel 3D justo debajo. `children` va debajo del carrusel (botones). */
export function ViveMundiBlock({ as = "h1", priority = false, children }: { as?: "h1" | "h2"; priority?: boolean; children?: ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12">
      <ViveMundiTitle as={as} />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.6 }} className="relative mx-auto mt-8 max-w-5xl sm:mt-10">
        <PhotoCarousel3D photos={CAROUSEL_PAISAJES} priority={priority} />
      </motion.div>
      {children}
    </section>
  );
}

/** "RECUERDA EL Memento" + galería en arco con las fotos nuevas, a todo el ancho. */
export function RecuerdaMementoBlock() {
  return (
    <section className="mt-20 sm:mt-28">
      <div className="px-4 sm:px-8"><RecuerdaMementoTitle /></div>
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.6 }} className="mx-auto mt-8 max-w-[1600px] sm:mt-10 sm:px-8 lg:px-12">
        <CurvedGalleryArc photos={ARC_PAISAJES} />
      </motion.div>
    </section>
  );
}
