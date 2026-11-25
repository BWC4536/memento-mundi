/**
 * Chinchetas del mapa de Explorar a partir de scrapbooks reales.
 *
 * - Los míos (o compartidos conmigo) salen siempre que tengan coordenadas, sean públicos o privados:
 *   un privado solo lo ve quien ya puede leerlo.
 * - Los públicos de otros usuarios llegan aparte y se añaden sin duplicar.
 *
 * Más adelante cada chincheta podrá estar ligada a un QR físico: al escanearlo se subirá una foto
 * que aparecerá en esta chincheta y en la librería del scrapbook asociado.
 */
import type { AtlasPlace } from "@/components/atlas-map-utils";
import type { Scrapbook } from "./scrapbooks";

export type ScrapbookPlace = AtlasPlace & {
  book: Scrapbook;
  /** Está en mi biblioteca (puedo abrirlo). */
  mine: boolean;
  country: string;
};

const FALLBACK_COLOR = "#FA9223";

/** Saca el hex de la paleta de la tarjeta (`bg-[#d7dfd6]`) para pintar la chincheta del mismo color. */
export function paletteColor(palette: string | undefined) {
  return palette?.match(/#[0-9a-f]{3,8}\b/i)?.[0] ?? FALLBACK_COLOR;
}

const hasCoordinates = (book: Scrapbook) => Number.isFinite(book.latitude) && Number.isFinite(book.longitude);

export function scrapbooksToPlaces(mine: Scrapbook[], publicBooks: Scrapbook[] = []): ScrapbookPlace[] {
  const places: ScrapbookPlace[] = [];
  const seen = new Set<string>();
  const add = (book: Scrapbook, isMine: boolean) => {
    if (seen.has(book.id) || !hasCoordinates(book)) return;
    seen.add(book.id);
    places.push({
      id: book.id,
      city: book.title,
      lat: book.latitude!,
      lng: book.longitude!,
      color: paletteColor(book.palette),
      country: book.country || book.location,
      book,
      mine: isMine,
    });
  };
  for (const book of mine) add(book, true);
  for (const book of publicBooks) add(book, false);
  return places;
}
