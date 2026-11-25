/**
 * Red social de Explorar sobre Supabase (docs/supabase/006_social.sql).
 *
 * - Lecturas con funciones SQL (social_feed, social_places_overview…) que devuelven JSON listo para pintar.
 * - Fotos y vídeos al bucket público `social-media`, en la carpeta del usuario: <user_id>/<post_id>/<n>.<ext>.
 * - Los permisos los impone RLS con el token del usuario.
 */
import type { FeedQuery, NewPostMedia, SocialComment, SocialPlace, SocialPost, SocialProfile, SocialSuggestion } from "../social/types";
import { SupabaseError, type RequestOptions, type SupabaseClient } from "./client";

export const SOCIAL_MEDIA_BUCKET = "social-media";
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

  const publicUrl = (path: string) => `${client.config.url}/storage/v1/object/public/${SOCIAL_MEDIA_BUCKET}/${path}`;

  // ── Lecturas ──
  async function feed(query: FeedQuery = {}, before?: string, limit = FEED_PAGE_SIZE) {
    return (
      (await rpc<SocialPost[]>("social_feed", {
        p_scope: query.scope ?? "all",
        p_place: query.placeId ?? null,
        p_author: query.authorId ?? null,
        p_before: before ?? null,
        p_limit: limit,
      })) ?? []
    );
  }

  async function post(id: string) {
    const [found] = (await rpc<SocialPost[]>("social_feed", { p_post: id, p_limit: 1 })) ?? [];
    return found ?? null;
  }

  const places = async () => (await rpc<SocialPlace[]>("social_places_overview")) ?? [];
  const profile = (userId: string) => rpc<SocialProfile | null>("social_profile", { p_user: userId });
  const suggestions = async (limit = 6) => (await rpc<SocialSuggestion[]>("social_suggestions", { p_limit: limit })) ?? [];

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
  async function createPost(input: { caption: string; placeId: string | null; media: NewPostMedia[] }, onProgress?: (done: number, total: number) => void) {
    const userId = me();
    if (input.media.length === 0) throw new SupabaseError("Añade al menos una foto o un vídeo.", 400, "no_media");
    const postId = createId();
    await call("/rest/v1/social_posts", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: { id: postId, author_id: userId, place_id: input.placeId, caption: input.caption.trim() || null },
    });

    const uploaded: string[] = [];
    try {
      const rows = [];
      for (let index = 0; index < input.media.length; index += 1) {
        const item = input.media[index]!;
        const path = buildSocialMediaPath(userId, postId, index, item.mimeType);
        await call(`/storage/v1/object/${SOCIAL_MEDIA_BUCKET}/${path}`, {
          method: "POST",
          rawBody: item.blob,
          headers: { "Content-Type": item.mimeType, "cache-control": "31536000", "x-upsert": "false" },
        });
        uploaded.push(path);
        onProgress?.(index + 1, input.media.length);
        rows.push({ post_id: postId, kind: item.kind, url: publicUrl(path), storage_path: path, width: item.width, height: item.height, duration_seconds: item.duration, position: index });
      }
      await call("/rest/v1/social_post_media", { method: "POST", headers: { Prefer: "return=minimal" }, body: rows });
    } catch (error) {
      // Sin medios el post no tiene sentido: lo deshacemos para no dejar publicaciones vacías.
      await call(`/rest/v1/social_posts?id=eq.${postId}`, { method: "DELETE" }).catch(() => undefined);
      if (uploaded.length) await call(`/storage/v1/object/${SOCIAL_MEDIA_BUCKET}`, { method: "DELETE", body: { prefixes: uploaded } }).catch(() => undefined);
      throw error;
    }
    return post(postId);
  }

  async function deletePost(postId: string) {
    const media = (await call<Array<{ storage_path: string | null }>>(`/rest/v1/social_post_media?select=storage_path&post_id=eq.${encodeURIComponent(postId)}`)) ?? [];
    await call(`/rest/v1/social_posts?id=eq.${encodeURIComponent(postId)}`, { method: "DELETE" });
    const paths = media.map((item) => item.storage_path).filter((path): path is string => !!path);
    if (paths.length) await call(`/storage/v1/object/${SOCIAL_MEDIA_BUCKET}`, { method: "DELETE", body: { prefixes: paths } }).catch(() => undefined);
  }

  return { feed, post, places, profile, suggestions, comments, setLiked, setSaved, setFollowing, setFollowingPlace, addComment, deleteComment, createPost, deletePost, me: getUserId };
}

export type SocialRepository = ReturnType<typeof createSocialRepository>;
