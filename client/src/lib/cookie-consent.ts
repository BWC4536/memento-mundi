/**
 * Consentimiento de cookies (RGPD, LSSI-CE art. 22.2 y guía de la AEPD).
 *
 * - Las cookies/almacenamiento técnicos (sesión, borradores, esta misma decisión) no requieren
 *   consentimiento y siempre están activos.
 * - Analítica y marketing empiezan desactivadas; cualquier script de esas categorías debe
 *   comprobar `hasConsent(...)` antes de cargarse.
 * - La decisión se guarda con versión y fecha y se vuelve a pedir pasados 24 meses o si
 *   cambia la versión (p. ej. al añadir un proveedor nuevo).
 */
import type { StorageLike } from "./composition-storage";
import { browserStorage, createFlag, createLocalStore, syncAcrossTabs, useLocalStore } from "./local-store";

export const CONSENT_KEY = "memento-mundi:cookie-consent";
export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365 * 2;

export type OptionalCategory = "analytics" | "marketing";
export type ConsentChoice = Record<OptionalCategory, boolean>;
export type CookieConsent = ConsentChoice & { version: number; decidedAt: string };

export const COOKIE_CATEGORIES: Array<{ id: "necessary" | OptionalCategory; title: string; description: string; required?: boolean }> = [
  { id: "necessary", title: "Necesarias", description: "Mantienen tu sesión, guardan tus borradores en este dispositivo y recuerdan esta elección. Sin ellas la app no funciona.", required: true },
  { id: "analytics", title: "Analítica", description: "Nos dirían qué pantallas se usan para mejorarlas, con datos agregados. Hoy no usamos ninguna: solo se activarían con tu permiso." },
  { id: "marketing", title: "Marketing", description: "Servirían para medir campañas en otras webs. Hoy no usamos ninguna: solo se activarían con tu permiso." },
];

export function parseConsent(raw: string | null, now = Date.now()): CookieConsent | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<CookieConsent>;
    if (data.version !== CONSENT_VERSION || typeof data.decidedAt !== "string") return null;
    const decided = Date.parse(data.decidedAt);
    if (!Number.isFinite(decided) || now - decided > CONSENT_MAX_AGE_MS) return null;
    return { version: CONSENT_VERSION, decidedAt: data.decidedAt, analytics: data.analytics === true, marketing: data.marketing === true };
  } catch {
    return null;
  }
}

export function createConsentStore(storage: StorageLike | null, now = () => Date.now()) {
  const store = createLocalStore<CookieConsent | null>(CONSENT_KEY, (raw) => parseConsent(raw, now()), storage);
  const decide = (choice: ConsentChoice) =>
    store.set({ version: CONSENT_VERSION, decidedAt: new Date(now()).toISOString(), analytics: choice.analytics, marketing: choice.marketing });
  return {
    store,
    get: store.get,
    decide,
    acceptAll: () => decide({ analytics: true, marketing: true }),
    rejectAll: () => decide({ analytics: false, marketing: false }),
    /** Retira la decisión: se vuelve a mostrar el aviso. */
    reset: () => store.set(null),
    has: (category: OptionalCategory) => store.get()?.[category] === true,
  };
}

export const consent = createConsentStore(browserStorage());
syncAcrossTabs([consent.store]);

export const hasConsent = consent.has;
export const useCookieConsent = () => useLocalStore(consent.store);

/** Panel de preferencias de cookies: se abre desde el aviso, el perfil o las páginas legales. */
const preferencesFlag = createFlag(false);
export const openCookiePreferences = () => preferencesFlag.set(true);
export const closeCookiePreferences = () => preferencesFlag.set(false);
export const useCookiePreferencesOpen = preferencesFlag.use;
