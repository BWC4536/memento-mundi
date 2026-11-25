/**
 * Perfil de usuario: tipos, normalización y validación (sin dependencias de red).
 * Las reglas coinciden con los CHECK de la migración 005.
 */

export type Profile = {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  instagram: string | null;
  tiktok: string | null;
  website: string | null;
  isPrivate: boolean;
  ugcPoints: number;
  createdAt: string | null;
};

export type ProfileDraft = {
  displayName: string;
  username: string;
  bio: string;
  instagram: string;
  tiktok: string;
  website: string;
};

export type ProfileUpdate = Partial<Pick<Profile, "username" | "displayName" | "avatarUrl" | "bio" | "instagram" | "tiktok" | "website" | "isPrivate">>;

export const LIMITS = { displayName: 60, username: 30, bio: 280, handle: 30, website: 200 } as const;

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;
const HANDLE_PATTERN = /^[A-Za-z0-9_.]{1,30}$/;

export const draftFromProfile = (profile: Profile): ProfileDraft => ({
  displayName: profile.displayName,
  username: profile.username ?? "",
  bio: profile.bio,
  instagram: profile.instagram ?? "",
  tiktok: profile.tiktok ?? "",
  website: profile.website ?? "",
});

/** Acepta "@usuario", "usuario" o la URL del perfil y devuelve solo el usuario. */
export function normalizeHandle(value: string, platform: "instagram" | "tiktok"): string {
  let handle = value.trim();
  const host = platform === "instagram" ? /instagram\.com/i : /tiktok\.com/i;
  if (host.test(handle)) {
    try {
      const url = new URL(/^https?:\/\//i.test(handle) ? handle : `https://${handle}`);
      handle = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } catch {
      /* lo validamos abajo */
    }
  }
  return handle.replace(/^@+/, "").trim();
}

export const normalizeUsername = (value: string) => value.trim().replace(/^@+/, "").toLowerCase();

/** Añade https:// si falta. */
export function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export type DraftErrors = Partial<Record<keyof ProfileDraft, string>>;

/** Valida el borrador y devuelve los cambios listos para guardar, o los errores por campo. */
export function validateDraft(draft: ProfileDraft): { ok: true; update: ProfileUpdate } | { ok: false; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const displayName = draft.displayName.trim();
  const username = normalizeUsername(draft.username);
  const bio = draft.bio.trim();
  const instagram = normalizeHandle(draft.instagram, "instagram");
  const tiktok = normalizeHandle(draft.tiktok, "tiktok");
  const website = normalizeWebsite(draft.website);

  if (!displayName) errors.displayName = "Escribe tu nombre.";
  else if (displayName.length > LIMITS.displayName) errors.displayName = `Máximo ${LIMITS.displayName} caracteres.`;

  if (username && !USERNAME_PATTERN.test(username)) errors.username = "De 3 a 30 caracteres: minúsculas, números, punto o guion bajo.";
  if (bio.length > LIMITS.bio) errors.bio = `Máximo ${LIMITS.bio} caracteres.`;
  if (instagram && !HANDLE_PATTERN.test(instagram)) errors.instagram = "Usuario de Instagram no válido.";
  if (tiktok && !HANDLE_PATTERN.test(tiktok)) errors.tiktok = "Usuario de TikTok no válido.";
  if (website) {
    let valid = website.length <= LIMITS.website;
    try {
      const url = new URL(website);
      valid = valid && url.hostname.includes(".");
    } catch {
      valid = false;
    }
    if (!valid) errors.website = "Escribe una web válida, por ejemplo tudominio.com.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    update: { displayName, username: username || null, bio, instagram: instagram || null, tiktok: tiktok || null, website: website || null },
  };
}

export const isDraftDirty = (draft: ProfileDraft, profile: Profile) => {
  const base = draftFromProfile(profile);
  return (Object.keys(base) as Array<keyof ProfileDraft>).some((key) => draft[key].trim() !== base[key].trim());
};

export const instagramUrl = (handle: string) => `https://instagram.com/${encodeURIComponent(handle)}`;
export const tiktokUrl = (handle: string) => `https://www.tiktok.com/@${encodeURIComponent(handle)}`;

export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "M";

/* ------------------------------------------------------------------ */
/* Recompensas UGC y pegatinas                                         */
/* ------------------------------------------------------------------ */

export type UgcPlatform = "instagram" | "tiktok";
export type UgcStatus = "pending" | "approved" | "rejected";

export type UgcClaim = {
  id: string;
  platform: UgcPlatform;
  proofUrl: string;
  reward: string;
  status: UgcStatus;
  createdAt: string;
};

export const REWARD_LABELS: Record<string, string> = {
  free_magnet: "Imán gratis",
};
export const rewardLabel = (reward: string) => REWARD_LABELS[reward] ?? reward.replace(/_/g, " ");

export const STATUS_LABELS: Record<UgcStatus, string> = {
  pending: "En revisión",
  approved: "Aprobada",
  rejected: "No aprobada",
};

/** El enlace de la publicación debe ser https y de la red elegida. */
export function validateProofUrl(value: string, platform: UgcPlatform): { ok: true; url: string } | { ok: false; message: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, message: "Pega el enlace de tu publicación." };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, message: "Ese enlace no es válido." };
  }
  url.protocol = "https:";
  const host = url.hostname.replace(/^www\./, "");
  const expected = platform === "instagram" ? ["instagram.com"] : ["tiktok.com", "vm.tiktok.com"];
  if (!expected.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    return { ok: false, message: platform === "instagram" ? "El enlace debe ser de instagram.com." : "El enlace debe ser de tiktok.com." };
  }
  const result = url.toString();
  if (result.length > 300) return { ok: false, message: "El enlace es demasiado largo." };
  return { ok: true, url: result };
}

export type LinkedSticker = {
  id: string;
  title: string;
  imageUrl: string | null;
  scrapbookId: string | null;
  scrapbookTitle: string | null;
  unlockedAt: string | null;
  createdAt: string;
};

export type UserSettings = { marketingOptIn: boolean; marketingOptInAt: string | null };
export const DEFAULT_SETTINGS: UserSettings = { marketingOptIn: false, marketingOptInAt: null };
