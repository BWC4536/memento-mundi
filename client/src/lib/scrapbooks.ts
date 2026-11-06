export type Scrapbook = {
  id: string;
  title: string;
  description?: string;
  location: string;
  country: string;
  cover: string;
  photos: number;
  invited: number;
  updated: string;
  palette: string;
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
  },
];
