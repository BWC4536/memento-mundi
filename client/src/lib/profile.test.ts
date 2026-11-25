import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "./composition-storage";
import { CONSENT_MAX_AGE_MS, CONSENT_VERSION, createConsentStore, parseConsent } from "./cookie-consent";
import { buildDataExport, clearLocalUserData } from "./data-export";
import { draftFromProfile, isDraftDirty, normalizeHandle, validateDraft, validateProofUrl, type Profile } from "./profile";

const PROFILE: Profile = {
  id: "u1",
  username: "viajera",
  displayName: "Viajera",
  avatarUrl: null,
  bio: "",
  instagram: null,
  tiktok: null,
  website: null,
  isPrivate: false,
  ugcPoints: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("perfil", () => {
  it("normaliza usuarios de redes pegados como @, usuario o URL", () => {
    expect(normalizeHandle("@memento", "instagram")).toBe("memento");
    expect(normalizeHandle("https://www.instagram.com/memento.mundi/", "instagram")).toBe("memento.mundi");
    expect(normalizeHandle("tiktok.com/@viajera", "tiktok")).toBe("viajera");
  });

  it("valida el borrador y devuelve los cambios normalizados", () => {
    const draft = { ...draftFromProfile(PROFILE), username: "@Nueva.Viajera", instagram: "@insta", website: "mi-web.com", bio: "  Hola  " };
    const result = validateDraft(draft);
    expect(result).toEqual({
      ok: true,
      update: { displayName: "Viajera", username: "nueva.viajera", bio: "Hola", instagram: "insta", tiktok: null, website: "https://mi-web.com" },
    });
  });

  it("marca los campos no válidos", () => {
    const result = validateDraft({ displayName: " ", username: "a!", bio: "x".repeat(281), instagram: "con espacio", tiktok: "", website: "no es web" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["bio", "displayName", "instagram", "username", "website"]);
  });

  it("detecta cambios sin guardar ignorando espacios", () => {
    expect(isDraftDirty({ ...draftFromProfile(PROFILE), displayName: "Viajera " }, PROFILE)).toBe(false);
    expect(isDraftDirty({ ...draftFromProfile(PROFILE), bio: "Nueva" }, PROFILE)).toBe(true);
  });

  it("solo acepta enlaces de la red elegida para las recompensas", () => {
    expect(validateProofUrl("instagram.com/p/abc", "instagram")).toEqual({ ok: true, url: "https://instagram.com/p/abc" });
    expect(validateProofUrl("http://www.tiktok.com/@a/video/1", "tiktok")).toEqual({ ok: true, url: "https://www.tiktok.com/@a/video/1" });
    expect(validateProofUrl("https://tiktok.com/@a/video/1", "instagram").ok).toBe(false);
    expect(validateProofUrl("https://evil-instagram.com/p/1", "instagram").ok).toBe(false);
    expect(validateProofUrl("", "instagram").ok).toBe(false);
  });
});

describe("consentimiento de cookies", () => {
  const now = Date.parse("2026-11-25T10:00:00.000Z");

  it("empieza sin decisión y guarda la elección con versión y fecha", () => {
    const storage = createMemoryStorage();
    const store = createConsentStore(storage, () => now);
    expect(store.get()).toBeNull();
    store.decide({ analytics: true, marketing: false });
    expect(store.get()).toEqual({ version: CONSENT_VERSION, decidedAt: new Date(now).toISOString(), analytics: true, marketing: false });
    expect(store.has("analytics")).toBe(true);
    expect(store.has("marketing")).toBe(false);
    expect(createConsentStore(storage, () => now).get()?.analytics).toBe(true);
  });

  it("vuelve a preguntar si la decisión caduca o cambia la versión", () => {
    const old = JSON.stringify({ version: CONSENT_VERSION, decidedAt: new Date(now - CONSENT_MAX_AGE_MS - 1).toISOString(), analytics: true, marketing: true });
    expect(parseConsent(old, now)).toBeNull();
    expect(parseConsent(JSON.stringify({ version: 0, decidedAt: new Date(now).toISOString() }), now)).toBeNull();
    expect(parseConsent("no-json", now)).toBeNull();
  });

  it("rechazar todo deja las opcionales desactivadas y reset retira la decisión", () => {
    const store = createConsentStore(createMemoryStorage(), () => now);
    store.rejectAll();
    expect(store.get()).toMatchObject({ analytics: false, marketing: false });
    store.reset();
    expect(store.get()).toBeNull();
  });
});

describe("exportación de datos", () => {
  it("incluye perfil, solicitudes y scrapbooks propios sin imágenes inline", () => {
    const data = buildDataExport({
      user: { id: "u1", email: "v@example.com", name: "Viajera" },
      provider: "supabase",
      bundle: { profile: PROFILE, settings: { marketingOptIn: false, marketingOptInAt: null }, stickers: [], claims: [], features: { privacy: true, settings: true } },
      scrapbooks: [
        { id: "a", title: "Mío", location: "Lisboa", country: "Portugal", cover: "", photos: 0, invited: 0, updated: "", palette: "", createdAt: "x", updatedAt: "y", source: "cloud", ownerId: "u1", composition: { elements: [{ id: "e", type: "photo", src: "data:image/png;base64,AAA" }] } as never },
        { id: "b", title: "Ajeno", location: "", country: "", cover: "", photos: 0, invited: 0, updated: "", palette: "", createdAt: "x", updatedAt: "y", source: "cloud", ownerId: "otro" },
      ],
      cookieConsent: null,
      preferences: { reduceMotion: true },
      now: new Date("2026-11-25T00:00:00.000Z"),
    });
    expect(data.account).toEqual({ id: "u1", email: "v@example.com" });
    expect(data.scrapbooks.map((book) => book.id)).toEqual(["a"]);
    expect(data.scrapbooks[0].elements?.[0].src).toBe("[imagen guardada en este dispositivo]");
  });

  it("al borrar la cuenta limpia solo las copias locales del usuario", () => {
    const data = new Map([
      ["memento-mundi:scrapbook:a:composition", "{}"],
      ["memento-mundi:scrapbooks:custom", "[]"],
      ["memento-mundi:profile", "{}"],
      ["memento-mundi:cookie-consent", "{}"],
    ]);
    const storage = {
      get length() {
        return data.size;
      },
      key: (index: number) => Array.from(data.keys())[index] ?? null,
      removeItem: (key: string) => void data.delete(key),
    };
    clearLocalUserData(storage);
    expect(Array.from(data.keys())).toEqual(["memento-mundi:cookie-consent"]);
  });
});
