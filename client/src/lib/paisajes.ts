/**
 * Fotos reales de viaje para la página de inicio.
 * Los originales están en client/public/paisajes; aquí usamos las versiones WebP
 * de client/public/paisajes/web (<slug>-<ancho>.webp), mucho más ligeras.
 */
export type Paisaje = {
  slug: string;
  city: string;
  place: string;
  alt: string;
  /** Ancho / alto de la imagen exportada. */
  ratio: number;
  widths: readonly number[];
  /** Encuadre al recortar con object-cover. */
  focus?: string;
};

export const PAISAJES = {
  budapest: {
    slug: "budapest-parlamento",
    city: "Budapest",
    place: "Parlamento",
    alt: "Fachada iluminada del Parlamento de Budapest de noche",
    ratio: 16 / 9,
    widths: [800, 1280, 1920],
    focus: "50% 40%",
  },
  viena: {
    slug: "viena-peterskirche",
    city: "Viena",
    place: "Peterskirche",
    alt: "Calle de Viena al atardecer con la cúpula de la Peterskirche al fondo",
    ratio: 9 / 16,
    widths: [640, 1080],
    focus: "50% 55%",
  },
  pragaTyn: {
    slug: "praga-tyn",
    city: "Praga",
    place: "Plaza Vieja",
    alt: "Iglesia de Týn en la Plaza Vieja de Praga bajo un cielo de tormenta",
    ratio: 9 / 16,
    widths: [640, 1080],
    focus: "50% 62%",
  },
  pragaPuente: {
    slug: "praga-puente-carlos",
    city: "Praga",
    place: "Puente de Carlos",
    alt: "Torre del Puente de Carlos en Praga durante la hora azul",
    ratio: 9 / 16,
    widths: [640, 1080],
    focus: "60% 55%",
  },
  collage: {
    slug: "collage-pared",
    city: "Libreta",
    place: "Pared de recortes",
    alt: "Pared llena de recortes, viñetas y carteles pegados",
    ratio: 1080 / 960,
    widths: [640, 1080],
    focus: "50% 30%",
  },
} as const satisfies Record<string, Paisaje>;

/** Orden del carrusel 3D. */
export const CAROUSEL_PAISAJES: readonly Paisaje[] = [PAISAJES.pragaPuente, PAISAJES.viena, PAISAJES.budapest, PAISAJES.pragaTyn, PAISAJES.collage];

export const paisajeSrc = (p: Paisaje, width = p.widths[0]) => `/paisajes/web/${p.slug}-${width}.webp`;
export const paisajeSrcSet = (p: Paisaje) => p.widths.map((w) => `${paisajeSrc(p, w)} ${w}w`).join(", ");
