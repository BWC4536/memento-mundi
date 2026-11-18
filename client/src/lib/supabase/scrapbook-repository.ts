/**
 * Scrapbooks y composiciones en Supabase.
 *
 * - Las fotos se suben al bucket privado `scrapbook-media`; la base de datos solo
 *   guarda una referencia `storage://scrapbook-media/<ruta>` y sus metadatos.
 * - Al cargar, las referencias se convierten en URLs firmadas (válidas 7 días).
 * - Los permisos los imponen las políticas RLS (migración 002) con el token del usuario.
 */
import { ensureUuidIds, createElementId, sortByZ, type CanvasElement, type ScrapbookComposition } from "../composition";
import type { Scrapbook } from "../scrapbooks";
import { buildAssetStoragePath, compositionToRows, rowsToComposition, SCRAPBOOK_MEDIA_BUCKET, type ScrapbookElementRow, type ScrapbookPageRow } from "../supabase-composition";
import { SupabaseError, type SupabaseClient } from "./client";

export const STORAGE_REF_PREFIX = `storage://${SCRAPBOOK_MEDIA_BUCKET}/`;
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export const toStorageRef = (path: string) => `${STORAGE_REF_PREFIX}${path}`;
export const storagePathFromRef = (value: string | null | undefined) => (value?.startsWith(STORAGE_REF_PREFIX) ? value.slice(STORAGE_REF_PREFIX.length) : null);

const PALETTES = ["bg-[#d7dfd6]", "bg-[#e7d8c2]", "bg-[#d8e2dc]", "bg-[#f2c5a0]"];

/** Portada provisional para scrapbooks sin fotos todavía. */
export const EMPTY_COVER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#EAE7DA"/><g fill="none" stroke="#0B2130" stroke-opacity=".12" stroke-width="2">${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${i * 34 + 20}" x2="400" y2="${i * 34 + 20}"/>`).join("")}</g><path d="M200 102c4 31 14 41 45 45-31 4-41 14-45 45-4-31-14-41-45-45 31-4 41-14 45-45z" fill="#FA9223" stroke="#0B2130" stroke-width="3"/></svg>`,
  );

type ScrapbookRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  cover_url: string | null;
  location_name: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  scrapbook_members?: Array<{ count: number }>;
  scrapbook_assets?: Array<{ count: number }>;
};

export type RepositoryDeps = {
  client: SupabaseClient;
  getAccessToken: () => Promise<string | null>;
  getUserId: () => string | null;
  /** Convierte una data URL en Blob (inyectable en tests). */
  toBlob?: (src: string) => Promise<Blob>;
};

const SCRAPBOOK_SELECT =
  "id,owner_id,title,description,cover_image_url,cover_url,location_name,city,country,latitude,longitude,is_public,created_at,updated_at,scrapbook_members(count),scrapbook_assets(count)";

export function rowToScrapbook(row: ScrapbookRow, index: number, cover: string): Scrapbook {
  const location = row.location_name || [row.city, row.country].filter(Boolean).join(", ") || "Sin ubicación";
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    location,
    country: row.country ?? "",
    cover,
    photos: row.scrapbook_assets?.[0]?.count ?? 0,
    invited: row.scrapbook_members?.[0]?.count ?? 0,
    updated: "",
    palette: PALETTES[index % PALETTES.length],
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: "cloud",
    ownerId: row.owner_id,
    isPublic: row.is_public,
  };
}

const extensionFor = (mime: string) => (mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg");

export function createScrapbookRepository({ client, getAccessToken, getUserId, toBlob = async (src) => (await fetch(src)).blob() }: RepositoryDeps) {
  async function token() {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new SupabaseError("Inicia sesión para sincronizar tus scrapbooks.", 401, "no_session");
    return accessToken;
  }

  async function signPaths(paths: string[]) {
    const unique = Array.from(new Set(paths));
    if (unique.length === 0) return new Map<string, string>();
    const result = await client.request<Array<{ path: string; signedURL: string | null; error: string | null }>>(`/storage/v1/object/sign/${SCRAPBOOK_MEDIA_BUCKET}`, {
      method: "POST",
      accessToken: await token(),
      body: { expiresIn: SIGNED_URL_TTL_SECONDS, paths: unique },
    });
    const map = new Map<string, string>();
    for (const item of result ?? []) {
      if (item.signedURL) map.set(item.path, `${client.config.url}/storage/v1${item.signedURL.startsWith("/") ? "" : "/"}${item.signedURL}`);
    }
    return map;
  }

  /** Sustituye las referencias storage:// por URLs firmadas para poder pintarlas. */
  async function resolveMedia(composition: ScrapbookComposition): Promise<ScrapbookComposition> {
    const paths = composition.elements.map((element) => element.asset?.storagePath ?? storagePathFromRef(element.src)).filter((path): path is string => !!path);
    if (paths.length === 0) return composition;
    const signed = await signPaths(paths);
    return {
      ...composition,
      elements: composition.elements.map((element) => {
        const path = element.asset?.storagePath ?? storagePathFromRef(element.src);
        if (!path) return element;
        return { ...element, src: signed.get(path) ?? element.src, asset: { ...element.asset, storagePath: path, inline: false } };
      }),
    };
  }

  async function listScrapbooks(): Promise<Scrapbook[]> {
    const rows = await client.request<ScrapbookRow[]>(`/rest/v1/scrapbooks?select=${SCRAPBOOK_SELECT}&order=updated_at.desc`, { accessToken: await token() });
    const coverPaths = rows.map((row) => storagePathFromRef(row.cover_image_url ?? row.cover_url)).filter((path): path is string => !!path);
    const signed = await signPaths(coverPaths).catch(() => new Map<string, string>());
    return rows.map((row, index) => {
      const raw = row.cover_image_url ?? row.cover_url;
      const path = storagePathFromRef(raw);
      const cover = path ? signed.get(path) ?? EMPTY_COVER : raw || EMPTY_COVER;
      return rowToScrapbook(row, index, cover);
    });
  }

  async function createScrapbook(input: { title: string; description?: string; location?: string }): Promise<Scrapbook> {
    const userId = getUserId();
    if (!userId) throw new SupabaseError("Inicia sesión para crear scrapbooks.", 401, "no_session");
    const [row] = await client.request<ScrapbookRow[]>(`/rest/v1/scrapbooks?select=${SCRAPBOOK_SELECT}`, {
      method: "POST",
      accessToken: await token(),
      headers: { Prefer: "return=representation" },
      body: { owner_id: userId, title: input.title.trim(), description: input.description?.trim() || null, location_name: input.location?.trim() || null },
    });
    return rowToScrapbook(row, 0, EMPTY_COVER);
  }

  async function deleteScrapbook(id: string) {
    await client.request(`/rest/v1/scrapbooks?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", accessToken: await token() });
  }

  async function loadComposition(scrapbookId: string): Promise<ScrapbookComposition | null> {
    const accessToken = await token();
    const [page] = await client.request<ScrapbookPageRow[]>(`/rest/v1/scrapbook_pages?scrapbook_id=eq.${encodeURIComponent(scrapbookId)}&order=sort_order.asc&limit=1`, { accessToken });
    if (!page) return null;
    const rows = await client.request<ScrapbookElementRow[]>(`/rest/v1/scrapbook_elements?page_id=eq.${encodeURIComponent(page.id)}&order=z_index.asc`, { accessToken });
    const composition = rowsToComposition(page, rows);
    if (!composition) return null;
    return resolveMedia({ ...composition, pageId: page.id });
  }

  /** Sube a Storage las fotos que siguen embebidas (data URL) y registra sus metadatos. */
  async function uploadInlineMedia(scrapbookId: string, composition: ScrapbookComposition): Promise<ScrapbookComposition> {
    const userId = getUserId();
    if (!userId) throw new SupabaseError("Inicia sesión para subir fotos.", 401, "no_session");
    const elements: CanvasElement[] = [];
    for (const element of composition.elements) {
      if (!element.src || !/^(data|blob):/i.test(element.src)) {
        elements.push(element);
        continue;
      }
      const blob = await toBlob(element.src);
      const mimeType = blob.type || element.asset?.mimeType || "image/jpeg";
      const assetId = createElementId();
      const path = buildAssetStoragePath(scrapbookId, userId, assetId, `image/${extensionFor(mimeType)}`);
      const accessToken = await token();
      await client.request(`/storage/v1/object/${SCRAPBOOK_MEDIA_BUCKET}/${path}`, {
        method: "POST",
        accessToken,
        rawBody: blob,
        headers: { "Content-Type": mimeType, "x-upsert": "true", "cache-control": "31536000" },
      });
      await client.request("/rest/v1/scrapbook_assets", {
        method: "POST",
        accessToken,
        headers: { Prefer: "return=minimal" },
        body: {
          id: assetId,
          scrapbook_id: scrapbookId,
          uploaded_by: userId,
          storage_path: path,
          mime_type: mimeType,
          width: element.asset?.width ?? null,
          height: element.asset?.height ?? null,
        },
      });
      elements.push({ ...element, asset: { ...element.asset, storagePath: path, mimeType, inline: false } });
    }
    return { ...composition, elements };
  }

  async function ensurePageId(scrapbookId: string, composition: ScrapbookComposition, accessToken: string) {
    if (composition.pageId) return composition.pageId;
    const [existing] = await client.request<Array<{ id: string }>>(`/rest/v1/scrapbook_pages?select=id&scrapbook_id=eq.${encodeURIComponent(scrapbookId)}&order=sort_order.asc&limit=1`, { accessToken });
    return existing?.id ?? createElementId();
  }

  async function saveComposition(scrapbookId: string, composition: ScrapbookComposition): Promise<ScrapbookComposition> {
    const userId = getUserId();
    if (!userId) throw new SupabaseError("Inicia sesión para guardar en la nube.", 401, "no_session");
    const uploaded = await uploadInlineMedia(scrapbookId, ensureUuidIds(composition));
    const accessToken = await token();
    const pageId = await ensurePageId(scrapbookId, uploaded, accessToken);

    // En la base de datos las fotos subidas se guardan como referencia de Storage, nunca como bytes.
    const forDatabase: ScrapbookComposition = {
      ...uploaded,
      elements: uploaded.elements.map((element) => (element.asset?.storagePath ? { ...element, src: toStorageRef(element.asset.storagePath) } : element)),
    };
    const { page, elements } = compositionToRows(forDatabase, { scrapbookId, pageId, createdBy: userId });

    await client.request("/rest/v1/scrapbook_pages?on_conflict=id", {
      method: "POST",
      accessToken,
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: page,
    });
    if (elements.length > 0) {
      await client.request("/rest/v1/scrapbook_elements?on_conflict=id", {
        method: "POST",
        accessToken,
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: elements,
      });
    }
    const keep = elements.map((row) => row.id);
    const staleFilter = keep.length ? `&id=not.in.(${keep.join(",")})` : "";
    await client.request(`/rest/v1/scrapbook_elements?page_id=eq.${pageId}${staleFilter}`, { method: "DELETE", accessToken });

    // Portada = primera foto de la composición. Solo el propietario puede cambiarla (RLS): si no lo es, se ignora.
    const coverPhoto = sortByZ(forDatabase.elements).find((element) => element.type === "photo" && storagePathFromRef(element.src));
    await client
      .request(`/rest/v1/scrapbooks?id=eq.${encodeURIComponent(scrapbookId)}`, {
        method: "PATCH",
        accessToken,
        headers: { Prefer: "return=minimal" },
        body: { updated_at: uploaded.updatedAt, ...(coverPhoto ? { cover_image_url: coverPhoto.src } : {}) },
      })
      .catch(() => undefined);

    return resolveMedia({ ...uploaded, pageId });
  }

  return { listScrapbooks, createScrapbook, deleteScrapbook, loadComposition, saveComposition, signPaths };
}

export type ScrapbookRepository = ReturnType<typeof createScrapbookRepository>;
