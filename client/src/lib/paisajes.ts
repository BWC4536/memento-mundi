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
  panama: {
    slug: "panama-playa",
    city: "Panamá",
    place: "Caribe",
    alt: "Playa caribeña de Panamá con una palmera, tumbonas de madera y una lancha roja",
    ratio: 9 / 16,
    widths: [640, 1080],
    focus: "45% 60%",
  },
  alsacia: {
    slug: "alsacia-canal",
    city: "Alsacia",
    place: "Canal en Navidad",
    alt: "Casas con entramado de madera y luces de Navidad reflejadas en un canal al anochecer",
    ratio: 3 / 4,
    widths: [640, 1080, 1600],
    focus: "50% 62%",
  },
  londres: {
    slug: "londres-big-ben",
    city: "Londres",
    place: "Big Ben",
    alt: "Torre del Big Ben iluminada de noche",
    ratio: 9 / 16,
    widths: [576],
    focus: "50% 72%",
  },
  navidad: {
    slug: "mercado-navidad",
    city: "Invierno",
    place: "Mercado navideño",
    alt: "Mercado de Navidad de noche con un árbol de bolas gigantes y una noria iluminada",
    ratio: 3 / 4,
    widths: [640, 1080],
    focus: "55% 55%",
  },
  bratislavaPuerta: {
    slug: "bratislava-puerta",
    city: "Bratislava",
    place: "Puerta de San Miguel",
    alt: "Torre de la Puerta de San Miguel con su cúpula verde en el casco antiguo de Bratislava",
    ratio: 9 / 16,
    widths: [640, 1080],
    focus: "45% 40%",
  },
  bratislavaIglesia: {
    slug: "bratislava-iglesia-azul",
    city: "Bratislava",
    place: "Iglesia Azul",
    alt: "Iglesia Azul de Santa Isabel en Bratislava, toda en tonos celestes",
    ratio: 9 / 16,
    widths: [640, 1080],
    focus: "55% 45%",
  },
  rialto: {
    slug: "venecia-rialto",
    city: "Venecia",
    place: "Puente de Rialto",
    alt: "Puente de Rialto en Venecia visto desde el canal bajo un cielo azul intenso",
    ratio: 9 / 16,
    widths: [640, 1080],
    focus: "50% 55%",
  },
  alpes: {
    slug: "alpes-rio",
    city: "Alpes",
    place: "Río y montañas",
    alt: "Río verde que refleja las nubes con montañas al fondo",
    ratio: 9 / 16,
    widths: [640, 1080],
    focus: "50% 55%",
  },
  paraguas: {
    slug: "calle-paraguas",
    city: "Verano",
    place: "Calle de paraguas",
    alt: "Calle con casas de colores y paraguas suspendidos sobre ella",
    ratio: 9 / 16,
    widths: [640, 1080],
    focus: "50% 50%",
  },
  bled: {
    slug: "bled-lago",
    city: "Bled",
    place: "Lago",
    alt: "Lago de Bled con su isla y las montañas al fondo, entre las ramas de un árbol",
    ratio: 9 / 16,
    widths: [640, 1080],
    focus: "50% 60%",
  },
  postales: {
    slug: "venecia-postales",
    city: "Venecia",
    place: "Puesto de postales",
    alt: "Puesto de postales en un callejón de Venecia",
    ratio: 4 / 3,
    widths: [800, 1280],
    focus: "50% 70%",
  },
} as const satisfies Record<string, Paisaje>;

/** Carrusel del hero de la landing: pocas tarjetas para que el anillo quepa en media columna. */
export const CAROUSEL_PAISAJES: readonly Paisaje[] = [PAISAJES.pragaPuente, PAISAJES.bled, PAISAJES.viena, PAISAJES.rialto, PAISAJES.budapest, PAISAJES.panama];

/** Carrusel a todo el ancho: todas las fotos, alternando cálidas y nocturnas. */
export const ALL_PAISAJES: readonly Paisaje[] = [PAISAJES.panama, PAISAJES.bled, PAISAJES.pragaPuente, PAISAJES.rialto, PAISAJES.alsacia, PAISAJES.bratislavaIglesia, PAISAJES.londres, PAISAJES.viena, PAISAJES.navidad, PAISAJES.paraguas, PAISAJES.pragaTyn, PAISAJES.alpes, PAISAJES.budapest, PAISAJES.bratislavaPuerta, PAISAJES.postales, PAISAJES.collage];

export const paisajeSrc = (p: Paisaje, width = p.widths[0]) => `/paisajes/web/${p.slug}-${width}.webp`;
export const paisajeSrcSet = (p: Paisaje) => p.widths.map((w) => `${paisajeSrc(p, w)} ${w}w`).join(", ");

/** Galería en arco: las fotos más recientes, en bucle. */
export const ARC_PAISAJES: readonly Paisaje[] = [PAISAJES.panama, PAISAJES.bled, PAISAJES.alsacia, PAISAJES.bratislavaIglesia, PAISAJES.londres, PAISAJES.rialto, PAISAJES.navidad, PAISAJES.paraguas, PAISAJES.alpes, PAISAJES.bratislavaPuerta];
