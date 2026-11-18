/**
 * Guardado TEMPORAL de composiciones en localStorage.
 *
 * Mientras Supabase no esté conectado, la composición vive en el estado React
 * de Home (fuente de verdad en memoria) y se copia aquí para sobrevivir a un
 * refresh. Las fotos subidas en el prototipo se guardan como data URLs
 * comprimidas (ver image-upload.ts); en producción `src` será una URL de
 * Supabase Storage y aquí solo viajarán URLs y metadatos.
 */
import { sanitizeComposition, type ScrapbookComposition } from "./composition";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const compositionStorageKey = (scrapbookId: string) => `memento-mundi:scrapbook:${scrapbookId}:composition`;

export type LocalSaveResult = { ok: true; bytes: number } | { ok: false; reason: "unavailable" | "quota" | "error"; message: string };

export function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isQuotaError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || /quota/i.test(error.message))
  );
}

export function saveCompositionLocally(
  scrapbookId: string,
  composition: ScrapbookComposition,
  storage: StorageLike | null = getBrowserStorage(),
): LocalSaveResult {
  if (!storage) return { ok: false, reason: "unavailable", message: "Este navegador no permite guardar datos locales." };
  try {
    const payload = JSON.stringify(composition);
    storage.setItem(compositionStorageKey(scrapbookId), payload);
    return { ok: true, bytes: payload.length };
  } catch (error) {
    if (isQuotaError(error)) {
      return {
        ok: false,
        reason: "quota",
        message: "No queda espacio en este navegador para tantas fotos. Los cambios siguen en esta sesión.",
      };
    }
    return { ok: false, reason: "error", message: "No se pudo guardar una copia local." };
  }
}

export function loadCompositionLocally(scrapbookId: string, storage: StorageLike | null = getBrowserStorage()): ScrapbookComposition | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(compositionStorageKey(scrapbookId));
    if (!raw) return null;
    return sanitizeComposition(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function removeCompositionLocally(scrapbookId: string, storage: StorageLike | null = getBrowserStorage()) {
  try {
    storage?.removeItem(compositionStorageKey(scrapbookId));
  } catch {
    /* sin almacenamiento: nada que borrar */
  }
}

/** Almacenamiento en memoria para tests. */
export function createMemoryStorage(initial: Record<string, string> = {}, quotaBytes = Infinity): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      const used = Array.from(data.entries()).reduce((total, [k, v]) => (k === key ? total : total + v.length), 0);
      if (used + value.length > quotaBytes) {
        const error = new Error("Quota exceeded");
        error.name = "QuotaExceededError";
        throw error;
      }
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}
