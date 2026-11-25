import { paisajeSrc, paisajeSrcSet, type Paisaje } from "@/lib/paisajes";

type Props = {
  photo: Paisaje;
  /** Ancho que ocupará en pantalla, para que el navegador elija la versión justa. */
  sizes: string;
  className?: string;
  priority?: boolean;
  /** Decorativa (alt vacío) cuando el texto de al lado ya la describe. */
  decorative?: boolean;
};

/** Foto de viaje responsive: srcset WebP, recorte con object-cover y encuadre propio. */
export default function PaisajePhoto({ photo, sizes, className = "", priority = false, decorative = false }: Props) {
  return (
    <img
      src={paisajeSrc(photo)}
      srcSet={paisajeSrcSet(photo)}
      sizes={sizes}
      alt={decorative ? "" : photo.alt}
      aria-hidden={decorative || undefined}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      draggable={false}
      className={`h-full w-full select-none object-cover ${className}`}
      style={{ objectPosition: photo.focus }}
    />
  );
}

/** Caption tipo etiqueta para las fotos: ciudad en naranja + lugar. */
export function PhotoTag({ photo, className = "" }: { photo: Paisaje; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full border-2 border-ink bg-cream px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-ink ${className}`}>
      <span className="text-orange">{photo.city}</span> · {photo.place}
    </span>
  );
}
