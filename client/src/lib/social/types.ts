/**
 * Tipos de la red social de Explorar. Llegan tal cual de las funciones SQL
 * (docs/supabase/006_social.sql), por eso van en snake_case.
 */
export type SocialAuthor = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type SocialMediaKind = "photo" | "video";

export type SocialMedia = {
  id: string;
  kind: SocialMediaKind;
  url: string;
  width: number | null;
  height: number | null;
  duration: number | null;
};

export type SocialPlaceRef = { id: string; slug: string; name: string; country: string };

export type SocialComment = {
  id: string;
  body: string;
  created_at: string;
  /** null si el autor tiene la cuenta privada (RLS de profiles). */
  author: SocialAuthor | null;
};

export type SocialPost = {
  id: string;
  caption: string | null;
  created_at: string;
  author: SocialAuthor;
  place: SocialPlaceRef | null;
  media: SocialMedia[];
  like_count: number;
  comment_count: number;
  liked: boolean;
  saved: boolean;
  following_author: boolean;
  preview_comments: SocialComment[];
};

export type SocialPlaceKind = "city" | "country" | "region" | "spot";

export type SocialPlace = SocialPlaceRef & {
  kind: SocialPlaceKind;
  lat: number;
  lng: number;
  /** Portada propia del lugar (no la de un scrapbook). */
  cover_url: string | null;
  post_count: number;
  follower_count: number;
  following: boolean;
  latest_at: string | null;
  /** Mis scrapbooks (propios o compartidos) enlazados a este lugar. */
  my_scrapbook_ids: string[];
};

export type SocialProfile = SocialAuthor & {
  bio: string | null;
  website_url: string | null;
  post_count: number;
  follower_count: number;
  following_count: number;
  followed_by_me: boolean;
  follows_me: boolean;
};

export type SocialSuggestion = SocialAuthor & { post_count: number; preview_url: string | null };

export type FeedScope = "all" | "following" | "saved";

export type FeedQuery = { scope?: FeedScope; placeId?: string; authorId?: string };

/** Archivo listo para subir desde el compositor. */
export type NewPostMedia = {
  kind: SocialMediaKind;
  blob: Blob;
  mimeType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
};
