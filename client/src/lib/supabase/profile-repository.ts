/**
 * Perfil, ajustes, recompensas UGC y pegatinas del usuario.
 *
 * - "cloud": Supabase (tablas profiles, user_settings, ugc_claims, stickers y bucket `avatars`).
 *   Los permisos los imponen RLS y los permisos por columna de la migración 005.
 * - "local": sin Supabase, se guarda en este navegador (útil en desarrollo).
 */
import {
  DEFAULT_SETTINGS,
  type LinkedSticker,
  type Profile,
  type ProfileUpdate,
  type UgcClaim,
  type UgcPlatform,
  type UgcStatus,
  type UserSettings,
} from "../profile";
import type { StorageLike } from "../composition-storage";
import { SCRAPBOOK_MEDIA_BUCKET } from "../supabase-composition";
import { SupabaseError, type SupabaseClient } from "./client";

export const AVATAR_BUCKET = "avatars";

export type ProfileBundle = {
  profile: Profile;
  settings: UserSettings;
  stickers: LinkedSticker[];
  claims: UgcClaim[];
  /** false si la migración 005 aún no está aplicada: se ocultan los ajustes que dependen de ella. */
  features: { privacy: boolean; settings: boolean };
};

export type SessionUser = { id: string; email: string | null; name: string };

export interface ProfileRepository {
  load(): Promise<ProfileBundle>;
  /** Solo la fila del perfil (para la cabecera): sin ajustes, pegatinas ni recompensas. */
  loadProfile(): Promise<Profile>;
  updateProfile(update: ProfileUpdate): Promise<Profile>;
  uploadAvatar(blob: Blob, previousUrl: string | null): Promise<Profile>;
  removeAvatar(previousUrl: string | null): Promise<Profile>;
  updateSettings(settings: UserSettings): Promise<UserSettings>;
  submitClaim(platform: UgcPlatform, proofUrl: string): Promise<UgcClaim>;
  deleteAccount(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Filas de Supabase                                                   */
/* ------------------------------------------------------------------ */

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  website_url?: string | null;
  is_private?: boolean | null;
  ugc_points: number | null;
  created_at: string | null;
};

const BASE_PROFILE_COLUMNS = "id,username,display_name,avatar_url,bio,instagram_handle,tiktok_handle,ugc_points,created_at";
const PROFILE_COLUMNS = `${BASE_PROFILE_COLUMNS},website_url,is_private`;

export function rowToProfile(row: ProfileRow, fallbackName: string): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name?.trim() || fallbackName,
    avatarUrl: row.avatar_url,
    bio: row.bio ?? "",
    instagram: row.instagram_handle,
    tiktok: row.tiktok_handle,
    website: row.website_url ?? null,
    isPrivate: !!row.is_private,
    ugcPoints: row.ugc_points ?? 0,
    createdAt: row.created_at,
  };
}

export function profileUpdateToRow(update: ProfileUpdate): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (update.displayName !== undefined) row.display_name = update.displayName;
  if (update.username !== undefined) row.username = update.username;
  if (update.avatarUrl !== undefined) row.avatar_url = update.avatarUrl;
  if (update.bio !== undefined) row.bio = update.bio;
  if (update.instagram !== undefined) row.instagram_handle = update.instagram;
  if (update.tiktok !== undefined) row.tiktok_handle = update.tiktok;
  if (update.website !== undefined) row.website_url = update.website;
  if (update.isPrivate !== undefined) row.is_private = update.isPrivate;
  return row;
}

type ClaimRow = { id: string; social_platform: string; proof_url: string; reward_claimed: string | null; status: string | null; created_at: string };
const CLAIM_COLUMNS = "id,social_platform,proof_url,reward_claimed,status,created_at";

const rowToClaim = (row: ClaimRow): UgcClaim => ({
  id: row.id,
  platform: row.social_platform === "tiktok" ? "tiktok" : "instagram",
  proofUrl: row.proof_url,
  reward: row.reward_claimed ?? "free_magnet",
  status: (["pending", "approved", "rejected"].includes(row.status ?? "") ? row.status : "pending") as UgcStatus,
  createdAt: row.created_at,
});

type StickerRow = { id: string; title: string; image_url: string | null; scrapbook_id: string | null; unlocked_at: string | null; created_at: string; scrapbooks: { title: string } | null };

const rowToSticker = (row: StickerRow): LinkedSticker => ({
  id: row.id,
  title: row.title,
  imageUrl: row.image_url,
  scrapbookId: row.scrapbook_id,
  scrapbookTitle: row.scrapbooks?.title ?? null,
  unlockedAt: row.unlocked_at,
  createdAt: row.created_at,
});

/** Mensaje claro para los errores más habituales al guardar. */
export function describeProfileError(error: unknown): string {
  if (!(error instanceof SupabaseError)) return error instanceof Error ? error.message : "No se pudo guardar. Inténtalo de nuevo.";
  if (error.status === 0) return error.message;
  if (error.code === "23505") return /username/i.test(error.message) ? "Ese nombre de usuario ya está cogido." : "Ya enviaste este enlace.";
  if (error.code === "23514") return "Algún dato no tiene el formato correcto.";
  if (error.status === 401) return "Tu sesión ha caducado. Vuelve a entrar.";
  if (error.status === 413 || /size/i.test(error.message)) return "La imagen pesa demasiado.";
  return error.message;
}

const isMissingSchema = (error: unknown) =>
  error instanceof SupabaseError && ["42703", "42P01", "PGRST204", "PGRST205", "PGRST200"].includes(error.code ?? "");

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

export type CloudDeps = {
  client: SupabaseClient;
  getAccessToken: () => Promise<string | null>;
  user: SessionUser;
  now?: () => number;
};

export function createCloudProfileRepository({ client, getAccessToken, user, now = Date.now }: CloudDeps): ProfileRepository {
  const uid = encodeURIComponent(user.id);
  let privacyAvailable = true;

  async function token() {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new SupabaseError("Inicia sesión para ver tu perfil.", 401, "no_session");
    return accessToken;
  }

  const publicUrl = (path: string) => `${client.config.url}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
  const avatarPathFromUrl = (url: string | null) => {
    const prefix = `${client.config.url}/storage/v1/object/public/${AVATAR_BUCKET}/`;
    return url?.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length).split("?")[0]) : null;
  };

  async function loadProfile(accessToken: string): Promise<Profile> {
    let rows: ProfileRow[];
    try {
      rows = await client.request<ProfileRow[]>(`/rest/v1/profiles?id=eq.${uid}&select=${PROFILE_COLUMNS}`, { accessToken });
    } catch (error) {
      if (!isMissingSchema(error)) throw error;
      privacyAvailable = false;
      rows = await client.request<ProfileRow[]>(`/rest/v1/profiles?id=eq.${uid}&select=${BASE_PROFILE_COLUMNS}`, { accessToken });
    }
    const row = rows?.[0];
    if (!row) {
      return { id: user.id, username: null, displayName: user.name, avatarUrl: null, bio: "", instagram: null, tiktok: null, website: null, isPrivate: false, ugcPoints: 0, createdAt: null };
    }
    return rowToProfile(row, user.name);
  }

  async function updateProfile(update: ProfileUpdate): Promise<Profile> {
    const body = profileUpdateToRow(update);
    if (!privacyAvailable) {
      delete body.website_url;
      delete body.is_private;
    }
    const rows = await client.request<ProfileRow[]>(`/rest/v1/profiles?id=eq.${uid}&select=${privacyAvailable ? PROFILE_COLUMNS : BASE_PROFILE_COLUMNS}`, {
      method: "PATCH",
      accessToken: await token(),
      headers: { Prefer: "return=representation" },
      body,
    });
    if (!rows?.[0]) throw new SupabaseError("No encontramos tu perfil. Cierra sesión y vuelve a entrar.", 404, "no_profile");
    return rowToProfile(rows[0], user.name);
  }

  async function deleteAvatarFile(url: string | null, accessToken: string) {
    const path = avatarPathFromUrl(url);
    if (!path) return;
    await client
      .request(`/storage/v1/object/${AVATAR_BUCKET}`, { method: "DELETE", accessToken, body: { prefixes: [path] } })
      .catch(() => undefined);
  }

  return {
    async load() {
      const accessToken = await token();
      const profile = await loadProfile(accessToken);
      const [settingsResult, stickers, claims] = await Promise.all([
        client
          .request<Array<{ marketing_opt_in: boolean; marketing_opt_in_at: string | null }>>(`/rest/v1/user_settings?user_id=eq.${uid}&select=marketing_opt_in,marketing_opt_in_at`, { accessToken })
          .then((rows) => ({ available: true, settings: rows?.[0] ? { marketingOptIn: rows[0].marketing_opt_in, marketingOptInAt: rows[0].marketing_opt_in_at } : DEFAULT_SETTINGS }))
          .catch((error) => {
            if (isMissingSchema(error)) return { available: false, settings: DEFAULT_SETTINGS };
            throw error;
          }),
        client
          .request<StickerRow[]>(`/rest/v1/stickers?owner_id=eq.${uid}&select=id,title,image_url,scrapbook_id,unlocked_at,created_at,scrapbooks(title)&order=created_at.desc`, { accessToken })
          .then((rows) => (rows ?? []).map(rowToSticker)),
        client
          .request<ClaimRow[]>(`/rest/v1/ugc_claims?user_id=eq.${uid}&select=${CLAIM_COLUMNS}&order=created_at.desc`, { accessToken })
          .then((rows) => (rows ?? []).map(rowToClaim))
          .catch(() => [] as UgcClaim[]),
      ]);
      return { profile, settings: settingsResult.settings, stickers, claims, features: { privacy: privacyAvailable, settings: settingsResult.available } };
    },

    async loadProfile() {
      return loadProfile(await token());
    },

    updateProfile,

    async uploadAvatar(blob, previousUrl) {
      const accessToken = await token();
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
      const path = `${user.id}/avatar-${now()}.${ext}`;
      await client.request(`/storage/v1/object/${AVATAR_BUCKET}/${path}`, {
        method: "POST",
        accessToken,
        rawBody: blob,
        headers: { "Content-Type": blob.type || "image/jpeg", "x-upsert": "true", "cache-control": "31536000" },
      });
      const profile = await updateProfile({ avatarUrl: publicUrl(path) });
      await deleteAvatarFile(previousUrl, accessToken);
      return profile;
    },

    async removeAvatar(previousUrl) {
      const profile = await updateProfile({ avatarUrl: null });
      await deleteAvatarFile(previousUrl, await token());
      return profile;
    },

    async updateSettings(settings) {
      const rows = await client.request<Array<{ marketing_opt_in: boolean; marketing_opt_in_at: string | null }>>("/rest/v1/user_settings?on_conflict=user_id&select=marketing_opt_in,marketing_opt_in_at", {
        method: "POST",
        accessToken: await token(),
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: { user_id: user.id, marketing_opt_in: settings.marketingOptIn, marketing_opt_in_at: settings.marketingOptInAt },
      });
      const row = rows?.[0];
      return row ? { marketingOptIn: row.marketing_opt_in, marketingOptInAt: row.marketing_opt_in_at } : settings;
    },

    async submitClaim(platform, proofUrl) {
      const rows = await client.request<ClaimRow[]>(`/rest/v1/ugc_claims?select=${CLAIM_COLUMNS}`, {
        method: "POST",
        accessToken: await token(),
        headers: { Prefer: "return=representation" },
        body: { user_id: user.id, social_platform: platform, proof_url: proofUrl },
      });
      // Sin política de lectura (migración 005 sin aplicar) el insert funciona pero no devuelve la fila.
      return rows?.[0] ? rowToClaim(rows[0]) : { id: `tmp-${now()}`, platform, proofUrl, reward: "free_magnet", status: "pending", createdAt: new Date(now()).toISOString() };
    },

    async deleteAccount() {
      const accessToken = await token();
      // Storage no permite borrar archivos por SQL: los quitamos antes (mejor esfuerzo).
      const avatars = await client
        .request<Array<{ name: string }>>(`/storage/v1/object/list/${AVATAR_BUCKET}`, { method: "POST", accessToken, body: { prefix: `${user.id}/`, limit: 100 } })
        .catch(() => []);
      if (avatars?.length) {
        await client
          .request(`/storage/v1/object/${AVATAR_BUCKET}`, { method: "DELETE", accessToken, body: { prefixes: avatars.map((file) => `${user.id}/${file.name}`) } })
          .catch(() => undefined);
      }
      const assets = await client
        .request<Array<{ storage_path: string }>>(`/rest/v1/scrapbook_assets?uploaded_by=eq.${uid}&select=storage_path`, { accessToken })
        .catch(() => []);
      const paths = (assets ?? []).map((asset) => asset.storage_path).filter(Boolean);
      for (let index = 0; index < paths.length; index += 100) {
        await client
          .request(`/storage/v1/object/${SCRAPBOOK_MEDIA_BUCKET}`, { method: "DELETE", accessToken, body: { prefixes: paths.slice(index, index + 100) } })
          .catch(() => undefined);
      }
      try {
        await client.request("/rest/v1/rpc/delete_my_account", { method: "POST", accessToken, body: {} });
      } catch (error) {
        if (error instanceof SupabaseError && (error.code === "PGRST202" || error.status === 404)) {
          throw new SupabaseError("El borrado de cuentas aún no está activado en el servidor. Escríbenos y lo hacemos por ti.", 404, "rpc_missing");
        }
        throw error;
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Local (sin Supabase)                                                */
/* ------------------------------------------------------------------ */

export const LOCAL_PROFILE_KEY = "memento-mundi:profile";

type LocalData = { profile: Profile; settings: UserSettings; claims: UgcClaim[] };

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(blob);
  });

export function createLocalProfileRepository(user: SessionUser, storage: StorageLike | null, now = Date.now): ProfileRepository {
  const read = (): LocalData => {
    const fallback: LocalData = {
      profile: { id: user.id, username: null, displayName: user.name, avatarUrl: null, bio: "", instagram: null, tiktok: null, website: null, isPrivate: false, ugcPoints: 0, createdAt: null },
      settings: DEFAULT_SETTINGS,
      claims: [],
    };
    try {
      const raw = storage?.getItem(LOCAL_PROFILE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<LocalData>) : null;
      return parsed?.profile ? { ...fallback, ...parsed, profile: { ...fallback.profile, ...parsed.profile } } : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (data: LocalData) => {
    try {
      storage?.setItem(LOCAL_PROFILE_KEY, JSON.stringify(data));
    } catch {
      throw new Error("No queda espacio en este navegador para guardar el perfil.");
    }
  };
  const patch = (update: Partial<LocalData>) => {
    const next = { ...read(), ...update };
    write(next);
    return next;
  };

  return {
    async load() {
      const data = read();
      return { ...data, stickers: [], features: { privacy: true, settings: true } };
    },
    async loadProfile() {
      return read().profile;
    },
    async updateProfile(update) {
      return patch({ profile: { ...read().profile, ...update } }).profile;
    },
    async uploadAvatar(blob) {
      const avatarUrl = await blobToDataUrl(blob);
      return patch({ profile: { ...read().profile, avatarUrl } }).profile;
    },
    async removeAvatar() {
      return patch({ profile: { ...read().profile, avatarUrl: null } }).profile;
    },
    async updateSettings(settings) {
      return patch({ settings }).settings;
    },
    async submitClaim(platform, proofUrl) {
      const data = read();
      if (data.claims.some((claim) => claim.proofUrl === proofUrl)) throw new Error("Ya enviaste este enlace.");
      const claim: UgcClaim = { id: `local-${now()}`, platform, proofUrl, reward: "free_magnet", status: "pending", createdAt: new Date(now()).toISOString() };
      patch({ claims: [claim, ...data.claims] });
      return claim;
    },
    async deleteAccount() {
      storage?.removeItem(LOCAL_PROFILE_KEY);
    },
  };
}
