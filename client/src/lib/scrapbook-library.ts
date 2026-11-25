/**
 * Estado compartido de los scrapbooks (fuente de verdad en Home).
 *
 * La composición vive dentro de cada Scrapbook, no dentro del editor: el editor
 * recibe una copia inicial y devuelve la composición con `onSave`. Aquí se
 * aplica al scrapbook seleccionado y se respalda en localStorage.
 */
import { formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";
import {
  countPhotos,
  createEmptyComposition,
  createStarterComposition,
  type ScrapbookComposition,
} from "./composition";
import { getBrowserStorage, loadCompositionLocally, removeCompositionLocally, saveCompositionLocally, type LocalSaveResult, type StorageLike } from "./composition-storage";
import { demoScrapbooks, type Scrapbook } from "./scrapbooks";

export const CUSTOM_SCRAPBOOKS_KEY = "memento-mundi:scrapbooks:custom";

/** Composición a mostrar: la guardada o, si no existe, la inicial (portada + título + ubicación). */
export function getScrapbookComposition(scrapbook: Scrapbook): ScrapbookComposition {
  if (scrapbook.composition) return scrapbook.composition;
  if (scrapbook.source === "cloud" || scrapbook.id.startsWith("new-")) return createEmptyComposition(new Date(scrapbook.createdAt));
  return createStarterComposition(scrapbook, new Date(scrapbook.updatedAt));
}

function loadCustomScrapbooks(storage: StorageLike | null): Scrapbook[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(CUSTOM_SCRAPBOOKS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Scrapbook => typeof item?.id === "string" && typeof item?.title === "string");
  } catch {
    return [];
  }
}

export function saveCustomScrapbooks(scrapbooks: Scrapbook[], storage: StorageLike | null = getBrowserStorage()) {
  if (!storage) return;
  try {
    const custom = scrapbooks.filter((book) => book.id.startsWith("new-")).map(({ composition: _composition, ...meta }) => meta);
    storage.setItem(CUSTOM_SCRAPBOOKS_KEY, JSON.stringify(custom));
  } catch {
    /* sin espacio: los scrapbooks siguen en memoria */
  }
}

/** Carga los scrapbooks y les adjunta la composición guardada en localStorage. */
export function hydrateScrapbooks(base: Scrapbook[] = demoScrapbooks, storage: StorageLike | null = getBrowserStorage()): Scrapbook[] {
  const all = [...loadCustomScrapbooks(storage), ...base];
  return all.map((book) => {
    const composition = loadCompositionLocally(book.id, storage);
    if (!composition) return book;
    return { ...book, composition, updatedAt: composition.updatedAt, photos: Math.max(book.photos, countPhotos(composition)) };
  });
}

/** Aplica una composición guardada al scrapbook correspondiente (inmutable). */
export function applyCompositionToScrapbooks(scrapbooks: Scrapbook[], scrapbookId: string, composition: ScrapbookComposition): Scrapbook[] {
  return scrapbooks.map((book) =>
    book.id === scrapbookId
      ? { ...book, composition, updatedAt: composition.updatedAt, updated: "ahora", photos: Math.max(book.photos, countPhotos(composition)) }
      : book,
  );
}

export function persistComposition(scrapbookId: string, composition: ScrapbookComposition, storage: StorageLike | null = getBrowserStorage()): LocalSaveResult {
  return saveCompositionLocally(scrapbookId, composition, storage);
}

export function forgetScrapbook(scrapbookId: string, storage: StorageLike | null = getBrowserStorage()) {
  removeCompositionLocally(scrapbookId, storage);
}

export function createScrapbookDraft(title: string, description: string | undefined, template: Scrapbook = demoScrapbooks[0], now = new Date()): Scrapbook {
  const iso = now.toISOString();
  return {
    ...template,
    id: `new-${now.getTime()}`,
    title: title.trim(),
    description: description?.trim() || "Una nueva historia por llenar.",
    photos: 0,
    invited: 0,
    members: undefined,
    updated: "ahora",
    createdAt: iso,
    updatedAt: iso,
    composition: undefined,
  };
}

export function relativeDate(iso: string | undefined, now = new Date()) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (Math.abs(now.getTime() - date.getTime()) < 60_000) return "ahora mismo";
  return `hace ${formatDistanceStrict(date, now, { locale: es })}`;
}

export function formatDate(iso: string | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}
