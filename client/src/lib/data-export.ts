/**
 * "Descargar mis datos" (derecho de acceso y portabilidad, arts. 15 y 20 RGPD).
 * Genera un JSON legible con lo que la app guarda del usuario.
 */
import type { AppPreferences } from "./app-preferences";
import type { CookieConsent } from "./cookie-consent";
import type { Scrapbook } from "./scrapbooks";
import type { ProfileBundle } from "./supabase/profile-repository";

export type DataExportInput = {
  user: { id: string; email: string | null; name: string };
  provider: "supabase" | "manus";
  bundle: ProfileBundle;
  scrapbooks: Scrapbook[];
  cookieConsent: CookieConsent | null;
  preferences: AppPreferences;
  now?: Date;
};

/** Las imágenes guardadas solo en el navegador (data URL) se omiten: pesan mucho y ya están en tu dispositivo. */
const stripInline = (src: string | undefined) => (src && /^(data|blob):/i.test(src) ? "[imagen guardada en este dispositivo]" : src);

export function buildDataExport({ user, provider, bundle, scrapbooks, cookieConsent, preferences, now = new Date() }: DataExportInput) {
  const ownScrapbooks = provider === "supabase" ? scrapbooks.filter((book) => book.source === "cloud" && (!book.ownerId || book.ownerId === user.id)) : scrapbooks.filter((book) => book.id.startsWith("new-"));
  return {
    exportedAt: now.toISOString(),
    format: "memento-mundi-export@1",
    account: { id: user.id, email: user.email },
    profile: bundle.profile,
    settings: bundle.settings,
    stickers: bundle.stickers,
    ugcClaims: bundle.claims,
    scrapbooks: ownScrapbooks.map((book) => ({
      id: book.id,
      title: book.title,
      description: book.description ?? null,
      location: book.location,
      country: book.country,
      latitude: book.latitude ?? null,
      longitude: book.longitude ?? null,
      isPublic: book.isPublic ?? false,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      elements: book.composition?.elements.map((element) => ({ ...element, src: stripInline(element.src) })) ?? null,
    })),
    device: { cookieConsent, preferences },
  };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Tras eliminar la cuenta, borra las copias locales de scrapbooks y perfil de este dispositivo. */
export function clearLocalUserData(storage: Pick<Storage, "length" | "key" | "removeItem"> | null = typeof window !== "undefined" ? window.localStorage : null) {
  if (!storage) return;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && (key.startsWith("memento-mundi:scrapbook") || key === "memento-mundi:profile")) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}
