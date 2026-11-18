import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Mascota de Memento Mundi (pegatina con la esquina despegada).
 * Los archivos viven en client/public/mascota/<nombre>.png (1024 px, fondo transparente).
 * No es decoración: úsala solo para explicar un estado, guiar o dar personalidad.
 */
export const MASCOT_NAMES = [
  "00-base",
  "01-hola-bienvenida",
  "02-adios-logout",
  "03-avatar-carnet",
  "03b-perfil-usuario",
  "04-editar-perfil",
  "05-ajustes",
  "06-ayuda",
  "07-camara",
  "08-globo-terraqueo",
  "09-carrito",
  "10-mapa-explorar",
  "11-ubicacion-pin",
  "12-scrapbook-album",
  "13-escanear-qr",
  "14-compartir",
  "15-notificaciones",
  "16-favoritos-corazon",
  "17-buscar",
  "18-candado-privacidad",
  "19-email",
  "20-exito-celebracion",
  "21-error-404-perdido",
  "22-cargando-reloj",
  "23-vacio-sin-nada",
  "24-offline-sin-wifi",
  "25-maleta-viaje",
  "26-brujula",
  "27-calendario-fechas",
  "28-pegatina-despegar",
  "29-regalo",
  "30-pago-tarjeta",
  "31-pedido-envio",
  "32-subir-foto-nube",
  "33-invitar-amigos",
  "34-idioma",
  "35-borrar-papelera",
  "36-inicio-casa",
  "37-pegatina-avion",
] as const;

export type MascotName = (typeof MASCOT_NAMES)[number];

export const MASCOT_SIZES = { sm: 96, md: 160, lg: 240, xl: 320 } as const;
export type MascotSize = keyof typeof MASCOT_SIZES;

export const mascotSrc = (name: MascotName) => `/mascota/${name}.png`;

type BaseProps = {
  name: MascotName;
  /** Tamaño en escritorio. En móvil se puede reducir con `mobileSize`. */
  size?: MascotSize;
  /** Tamaño por debajo de 640 px (opcional). */
  mobileSize?: MascotSize;
  className?: string;
  /** Solo para la mascota visible al cargar la página (above the fold). */
  priority?: boolean;
  /** Inclinación final en grados (efecto pegatina). */
  tilt?: number;
};

/** Decorativa: alt vacío + aria-hidden. Si comunica un estado, `decorative={false}` y un `alt` descriptivo. */
type AccessibilityProps = { decorative?: true; alt?: never } | { decorative: false; alt: string };

export type MascotProps = BaseProps & AccessibilityProps;

export default function Mascot({ name, size = "md", mobileSize, className = "", priority = false, tilt = 0, decorative, alt }: MascotProps) {
  const reduceMotion = useReducedMotion();
  const px = MASCOT_SIZES[size];
  const mobilePx = mobileSize ? MASCOT_SIZES[mobileSize] : px;
  const isDecorative = decorative !== false;

  return (
    <motion.img
      src={mascotSrc(name)}
      width={px}
      height={px}
      alt={isDecorative ? "" : alt}
      aria-hidden={isDecorative ? true : undefined}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
      data-mascot={name}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.92, rotate: tilt - 3 }}
      animate={{ opacity: 1, scale: 1, rotate: tilt }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 20, mass: 0.8 }}
      className={`mascot-img pointer-events-none block h-auto max-w-full select-none ${className}`}
      style={{ "--mascot-size": `${px}px`, "--mascot-size-mobile": `${mobilePx}px`, aspectRatio: "1 / 1" } as CSSProperties}
    />
  );
}
