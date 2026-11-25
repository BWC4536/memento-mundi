import type { SocialAuthor, SocialMedia } from "./types";

/** Nombre corto para mostrar: @usuario si lo tiene; si no, su nombre. */
export function authorName(author: Pick<SocialAuthor, "username" | "display_name"> | null | undefined) {
  return author?.username || author?.display_name || "viajero";
}

export function authorInitials(author: Pick<SocialAuthor, "username" | "display_name"> | null | undefined) {
  const source = author?.display_name || author?.username || "?";
  return source
    .replace(/[._]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const AVATAR_TINTS = ["#FA9223", "#F2C5A0", "#CBD8D2", "#E7D8C2", "#D8E2DC", "#F6D27A"];

/** Color estable por usuario para los avatares sin foto. */
export function avatarTint(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** "ahora", "5 min", "3 h", "2 d", "4 sem" o la fecha si es de hace más de un año. */
export function timeAgoShort(iso: string, now = new Date()) {
  const date = new Date(iso);
  const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return "";
  if (seconds < 60) return "ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks} sem`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** 999 → "999", 1234 → "1,2 mil", 15000 → "15 mil", 2300000 → "2,3 M". */
export function compactCount(value: number) {
  const format = (n: number) => (n >= 10 ? String(Math.floor(n)) : String(Math.floor(n * 10) / 10).replace(".", ","));
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${format(value / 1000)} mil`;
  return `${format(value / 1_000_000)} M`;
}

export const plural = (count: number, one: string, many: string) => `${compactCount(count)} ${count === 1 ? one : many}`;

/** Proporción ancho/alto del carrusel, limitada como en Instagram: de 4:5 (vertical) a 1,91:1 (horizontal). */
export function mediaAspect(media: Pick<SocialMedia, "width" | "height"> | undefined) {
  if (!media?.width || !media.height) return 4 / 5;
  return Math.min(1.91, Math.max(4 / 5, media.width / media.height));
}

/** Separa el texto en trozos normales y #hashtags / @menciones para resaltarlos. */
export function tokenizeCaption(text: string): Array<{ text: string; tag?: boolean }> {
  // Con grupo de captura, split deja los #tags/@menciones en las posiciones impares.
  return text
    .split(/([#@][\wÀ-ÿ.]*[\wÀ-ÿ])/)
    .map((part, index) => (index % 2 === 1 ? { text: part, tag: true } : { text: part }))
    .filter((part) => part.text.length > 0);
}
