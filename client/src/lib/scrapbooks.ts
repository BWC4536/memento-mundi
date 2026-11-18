import type { ScrapbookComposition } from "./composition";

export type Scrapbook = {
  id: string;
  title: string;
  description?: string;
  location: string;
  country: string;
  /** Miniatura para identificar el viaje en Home. La experiencia principal es `composition`. */
  cover: string;
  photos: number;
  invited: number;
  /** Texto heredado del scaffold; la UI usa `updatedAt`. */
  updated: string;
  palette: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
  /** Composición guardada del lienzo (estado compartido del scrapbook). */
  composition?: ScrapbookComposition;
};

export const demoScrapbooks: Scrapbook[] = [
  {
    id: "algarve-2026",
    title: "Días de río y sal",
    description: "Un álbum improvisado entre puentes, sobremesas y cielos grises.",
    location: "Algarve, Portugal",
    country: "Portugal",
    cover: "/manus-storage/IMG_0037_694d8611.webp",
    photos: 18,
    invited: 4,
    updated: "hace 2 horas",
    palette: "bg-[#d7dfd6]",
    latitude: 37.0194,
    longitude: -7.9304,
    createdAt: "2026-06-14T09:30:00.000Z",
    updatedAt: "2026-11-18T08:00:00.000Z",
  },
  {
    id: "lisboa-postales",
    title: "Postales del Atlántico",
    description: "Calles empinadas, tranvías amarillos y luz sobre el Tajo.",
    location: "Lisboa, Portugal",
    country: "Portugal",
    cover: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1200&q=85",
    photos: 32,
    invited: 7,
    updated: "ayer",
    palette: "bg-[#e7d8c2]",
    latitude: 38.7223,
    longitude: -9.1393,
    createdAt: "2026-04-02T17:10:00.000Z",
    updatedAt: "2026-11-17T19:20:00.000Z",
  },
  {
    id: "kyoto-spring",
    title: "Rituales de primavera",
    description: "Pequeños detalles que solo aparecen cuando bajas el ritmo.",
    location: "Kyoto, Japón",
    country: "Japón",
    cover: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=85",
    photos: 24,
    invited: 2,
    updated: "12 oct",
    palette: "bg-[#d8e2dc]",
    latitude: 35.0116,
    longitude: 135.7681,
    createdAt: "2026-03-28T06:45:00.000Z",
    updatedAt: "2026-10-12T12:00:00.000Z",
  },
];
