/**
 * Red social de Explorar sobre Supabase (docs/supabase/006_social.sql).
 *
 * - Lecturas con funciones SQL (social_feed, social_places_overview…) que devuelven JSON listo para pintar.
 * - Fotos y vídeos al bucket público `social-media`, en la carpeta del usuario: <user_id>/<post_id>/<n>.<ext>.
 * - Los de publicaciones privadas van al bucket privado `social-private` (misma ruta) y se
 *   sirven con URLs firmadas que caducan (docs/supabase/009_social_private_bucket.sql).
 * - Los permisos los impone RLS con el token del usuario.
 */
import type { ConnectionKind, FeedCursor, FeedQuery, NewPostMedia, SocialComment, SocialPlace, SocialPost, SocialPostVisibility, SocialProfile, SocialSuggestion, SocialUser } from "../social/types";
import { SupabaseError, type RequestOptions, type SupabaseClient } from "./client";

export const SOCIAL_MEDIA_BUCKET = "social-media";
export const SOCIAL_PRIVATE_BUCKET = "social-private";
/** Vida de las URLs firmadas de lo privado: de sobra para una sesión de scroll. */
export const PRIVATE_URL_TTL_SECONDS = 6 * 60 * 60;

type SocialBucket = typeof SOCIAL_MEDIA_BUCKET | typeof SOCIAL_PRIVATE_BUCKET;
export const FEED_PAGE_SIZE = 8;

export type SocialRepositoryDeps = {
  client: SupabaseClient;
  getAccessToken: () => Promise<string | null>;
  getUserId: () => string | null;
  createId?: () => string;
};

/** La base de datos aún no tiene las tablas/funciones de la red social. */
export class SocialSetupError extends Error {
  constructor() {
    super("La comunidad aún no está activada: falta aplicar docs/supabase/006_social.sql en Supabase.");
    this.name = "SocialSetupError";
  }
}

const MISSING_CODES = new Set(["PGRST202", "PGRST205", "42P01", "42883"]);
const isMissingSchema = (error: unknown) => error instanceof SupabaseError && (MISSING_CODES.has(error.code ?? "") || (error.status === 404 && !error.code));

const extensionFor = (mime: string) => {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  return "jpg";
};

export function buildSocialMediaPath(userId: string, postId: string, index: number, mimeType: string) {
  return `${userId}/${postId}/${index}.${extensionFor(mimeType)}`;
}

export function createSocialRepository({ client, getAccessToken, getUserId, createId = () => crypto.randomUUID() }: SocialRepositoryDeps) {
  async function token() {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new SupabaseError("Inicia sesión para entrar en la comunidad.", 401, "no_session");
    return accessToken;
  }

  function me() {
    const userId = getUserId();
    if (!userId) throw new SupabaseError("Inicia sesión para entrar en la comunidad.", 401, "no_session");
    return userId;
  }

  async function call<T>(path: string, options: RequestOptions = {}): Promise<T> {
    try {
      return await client.request<T>(path, { ...options, accessToken: await token() });
    } catch (error) {
      if (isMissingSchema(error)) throw new SocialSetupError();
      throw error;
    }
  }

  const rpc = <T>(name: string, body: Record<string, unknown> = {}) => call<T>(`/rest/v1/rpc/${name}`, { method: "POST", body });

  const publicBase = () => `${client.config.url}/storage/v1/object/public/${SOCIAL_MEDIA_BUCKET}`;
  const publicUrl = (path: string) => `${publicBase()}/${path}`;

  /** Firma de una vez las rutas de los medios privados y las pone como `url`. */
  async function signPrivateMedia(posts: SocialPost[]) {
    const paths = Array.from(new Set(posts.flatMap((item) => (item.media ?? []).filter((media) => media.bucket === SOCIAL_PRIVATE_BUCKET && media.path).map((media) => media.path!))));
    if (paths.length === 0) return posts;
    const signed = new Map<string, string>();
    const result = await call<Array<{ path: string; signedURL: string | null; error: string | null }>>(`/storage/v1/object/sign/${SOCIAL_PRIVATE_BUCKET}`, {
      method: "POST",
      body: { expiresIn: PRIVATE_URL_TTL_SECONDS, paths },
    });
    for (const item of result ?? []) {
      if (item.signedURL) signed.set(item.path, `${client.config.url}/storage/v1${item.signedURL.startsWith("/") ? "" : "/"}${item.signedURL}`);
    }
    return posts.map((item) =>
      item.media?.some((media) => media.bucket === SOCIAL_PRIVATE_BUCKET)
        ? { ...item, media: item.media.map((media) => (media.bucket === SOCIAL_PRIVATE_BUCKET && media.path ? { ...media, url: signed.get(media.path) ?? "" } : media)) }
        : item,
    );
  }

  // ── Lecturas ──
  /**
   * Una página del feed. Paginación por cursor (created_at, id) del último post: el servidor
   * solo devuelve `limit` posts cada vez, así el scroll infinito no carga todo de golpe.
   * Los parámetros nuevos solo se envían si hacen falta, para seguir funcionando sin 008.
   */
  async function feed(query: FeedQuery = {}, before?: FeedCursor | string, limit = FEED_PAGE_SIZE) {
    const cursor = typeof before === "string" ? { created_at: before, id: null } : before;
    const body: Record<string, unknown> = {
      p_scope: query.scope ?? "all",
      p_place: query.placeId ?? null,
      p_author: query.authorId ?? null,
      p_before: cursor?.created_at ?? null,
      p_limit: limit,
    };
    if (cursor?.id) body.p_before_id = cursor.id;
    if (query.visibility) body.p_visibility = query.visibility;
    return signPrivateMedia((await rpc<SocialPost[]>("social_feed", body)) ?? []);
  }

  async function post(id: string) {
    const [found] = await signPrivateMedia((await rpc<SocialPost[]>("social_feed", { p_post: id, p_limit: 1 })) ?? []);
    return found ?? null;
  }

  const places = async () => (await rpc<SocialPlace[]>("social_places_overview")) ?? [];
  const profile = (userId: string) => rpc<SocialProfile | null>("social_profile", { p_user: userId });
  const suggestions = async (limit = 6) => (await rpc<SocialSuggestion[]>("social_suggestions", { p_limit: limit })) ?? [];

  /** Busca personas por @usuario o nombre (sin tildes ni mayúsculas). Texto vacío = sin resultados. */
  async function searchUsers(query: string, limit = 20) {
    const term = query.trim().replace(/^@+/, "");
    if (!term) return [];
    return (await rpc<SocialUser[]>("social_search_users", { p_query: term.slice(0, 60), p_limit: limit })) ?? [];
  }

  const connections = async (kind: ConnectionKind, limit = 100) => (await rpc<SocialUser[]>("social_connections", { p_kind: kind, p_limit: limit })) ?? [];

  async function comments(postId: string) {
    return (
      (await call<SocialComment[]>(
        `/rest/v1/social_comments?select=id,body,created_at,author:profiles(id,username,display_name,avatar_url)&post_id=eq.${encodeURIComponent(postId)}&order=created_at.asc&limit=200`,
      )) ?? []
    );
  }

  // ── Interacciones (idempotentes: repetir un like no falla) ──
  async function toggleRow(table: string, row: Record<string, string>, on: boolean, conflict: string) {
    if (on) {
      await call(`/rest/v1/${table}?on_conflict=${conflict}`, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: row });
    } else {
      const filter = Object.entries(row)
        .map(([key, value]) => `${key}=eq.${encodeURIComponent(value)}`)
        .join("&");
      await call(`/rest/v1/${table}?${filter}`, { method: "DELETE" });
    }
  }

  const setLiked = (postId: string, liked: boolean) => toggleRow("social_likes", { post_id: postId, user_id: me() }, liked, "post_id,user_id");
  const setSaved = (postId: string, saved: boolean) => toggleRow("social_saves", { post_id: postId, user_id: me() }, saved, "post_id,user_id");
  const setFollowing = (userId: string, following: boolean) => toggleRow("social_follows", { follower_id: me(), followee_id: userId }, following, "follower_id,followee_id");
  const setFollowingPlace = (placeId: string, following: boolean) => toggleRow("social_place_follows", { user_id: me(), place_id: placeId }, following, "user_id,place_id");

  async function addComment(postId: string, body: string) {
    const [created] = await call<SocialComment[]>(`/rest/v1/social_comments?select=id,body,created_at,author:profiles(id,username,display_name,avatar_url)`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: { post_id: postId, author_id: me(), body: body.trim() },
    });
    return created;
  }

  const deleteComment = (commentId: string) => call(`/rest/v1/social_comments?id=eq.${encodeURIComponent(commentId)}`, { method: "DELETE" });

  // ── Publicar ──
  async function createPost(input: { caption: string; placeId: string | null; media: NewPostMedia[]; visibility?: SocialPostVisibility }, onProgress?: (done: number, total: number) => void) {
    const userId = me();
    if (input.media.length === 0) throw new SupabaseError("Añade al menos una foto o un vídeo.", 400, "no_media");
    const postId = createId();
    await call("/rest/v1/social_posts", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      // Solo se envía si es privada: las bases sin 008 siguen aceptando posts públicos.
      body: { id: postId, author_id: userId, place_id: input.placeId, caption: input.caption.trim() || null, ...(input.visibility === "private" ? { visibility: "private" } : {}) },
    });

    const isPrivate = input.visibility === "private";
    const bucket: SocialBucket = isPrivate ? SOCIAL_PRIVATE_BUCKET : SOCIAL_MEDIA_BUCKET;
    const uploaded: string[] = [];
    try {
      const rows = [];
      for (let index = 0; index < input.media.length; index += 1) {
        const item = input.media[index]!;
        const path = buildSocialMediaPath(userId, postId, index, item.mimeType);
        await call(`/storage/v1/object/${bucket}/${path}`, {
          method: "POST",
          rawBody: item.blob,
          headers: { "Content-Type": item.mimeType, "cache-control": isPrivate ? "3600" : "31536000", "x-upsert": "false" },
        });
        uploaded.push(path);
        onProgress?.(index + 1, input.media.length);
        const location = isPrivate ? { bucket, url: null } : { url: publicUrl(path) };
        rows.push({ post_id: postId, kind: item.kind, ...location, storage_path: path, width: item.width, height: item.height, duration_seconds: item.duration, position: index });
      }
      await call("/rest/v1/social_post_media", { method: "POST", headers: { Prefer: "return=minimal" }, body: rows });
    } catch (error) {
      // Sin medios el post no tiene sentido: lo deshacemos para no dejar publicaciones vacías.
      await call(`/rest/v1/social_posts?id=eq.${postId}`, { method: "DELETE" }).catch(() => undefined);
      if (uploaded.length) await call(`/storage/v1/object/${bucket}`, { method: "DELETE", body: { prefixes: uploaded } }).catch(() => undefined);
      throw error;
    }
    return post(postId);
  }

  type StoredMedia = { storage_path: string | null; bucket?: SocialBucket };

  async function storedMedia(postId: string) {
    const filter = `post_id=eq.${encodeURIComponent(postId)}`;
    try {
      return (await call<StoredMedia[]>(`/rest/v1/social_post_media?select=storage_path,bucket&${filter}`)) ?? [];
    } catch (error) {
      // Base sin 009: aún no existe la columna bucket, todo vive en el bucket público.
      if (error instanceof SupabaseError && error.code === "42703") return (await call<StoredMedia[]>(`/rest/v1/social_post_media?select=storage_path&${filter}`)) ?? [];
      throw error;
    }
  }

  const moveObject = (path: string, from: SocialBucket, to: SocialBucket) =>
    call("/storage/v1/object/move", { method: "POST", body: { bucketId: from, sourceKey: path, destinationKey: path, destinationBucket: to } });

  /**
   * Cambia quién ve una publicación mía. Primero mueve sus archivos al bucket que toca
   * (privado <-> público) y después actualiza post y medios en una sola transacción SQL.
   * Si algo falla, devuelve los archivos ya movidos a su sitio.
   */
  async function setVisibility(postId: string, visibility: SocialPostVisibility) {
    const userId = me();
    const target: SocialBucket = visibility === "private" ? SOCIAL_PRIVATE_BUCKET : SOCIAL_MEDIA_BUCKET;
    const pending = (await storedMedia(postId))
      .map((item) => ({ path: item.storage_path, from: item.bucket ?? SOCIAL_MEDIA_BUCKET }))
      .filter((item): item is { path: string; from: SocialBucket } => !!item.path && item.path.startsWith(`${userId}/`) && item.from !== target);
    const moved: typeof pending = [];
    try {
      for (const item of pending) {
        await moveObject(item.path, item.from, target);
        moved.push(item);
      }
      await rpc("social_set_visibility", { p_post: postId, p_visibility: visibility, p_public_base: publicBase() });
    } catch (error) {
      for (const item of moved.reverse()) await moveObject(item.path, target, item.from).catch(() => undefined);
      throw error;
    }
    return post(postId);
  }

  async function deletePost(postId: string) {
    const media = await storedMedia(postId);
    await call(`/rest/v1/social_posts?id=eq.${encodeURIComponent(postId)}`, { method: "DELETE" });
    for (const bucket of [SOCIAL_MEDIA_BUCKET, SOCIAL_PRIVATE_BUCKET] as const) {
      const paths = media.filter((item) => (item.bucket ?? SOCIAL_MEDIA_BUCKET) === bucket).map((item) => item.storage_path).filter((path): path is string => !!path);
      if (paths.length) await call(`/storage/v1/object/${bucket}`, { method: "DELETE", body: { prefixes: paths } }).catch(() => undefined);
    }
  }

  return { feed, post, places, profile, suggestions, searchUsers, connections, comments, setLiked, setSaved, setFollowing, setFollowingPlace, addComment, deleteComment, createPost, setVisibility, deletePost, me: getUserId };
}

export type SocialRepository = ReturnType<typeof createSocialRepository>;
