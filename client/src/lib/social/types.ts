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
  /** Bucket donde vive el archivo ("social-private" = publicación privada, URL firmada). */
  bucket?: "social-media" | "social-private";
  /** Ruta en el bucket privado, solo para firmarla; la app rellena `url` con la URL firmada. */
  path?: string | null;
};

export type SocialPlaceRef = { id: string; slug: string; name: string; country: string };

export type SocialComment = {
  id: string;
  body: string;
  created_at: string;
  /** null si el autor tiene la cuenta privada (RLS de profiles). */
  author: SocialAuthor | null;
};

/** "private": solo la ve su autor (RLS en docs/supabase/008_social_privacy.sql). */
export type SocialPostVisibility = "public" | "private";

export type SocialPost = {
  id: string;
  caption: string | null;
  created_at: string;
  /** Puede faltar si la base de datos aún no tiene 008_social_privacy.sql: se trata como pública. */
  visibility?: SocialPostVisibility;
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

/** Persona en la búsqueda de amigos y en las listas de conexiones (docs/supabase/010_social_friends.sql). */
export type SocialUser = SocialAuthor & {
  bio: string | null;
  post_count: number;
  follower_count: number;
  followed_by_me: boolean;
  follows_me: boolean;
};

/** friends = os seguís mutuamente; followers = te siguen; following = sigues. */
export type ConnectionKind = "friends" | "followers" | "following";

/** "mine": la pestaña @usuario, solo lo que he subido yo (público y privado). */
export type FeedScope = "all" | "following" | "saved" | "mine";

export type FeedQuery = { scope?: FeedScope; placeId?: string; authorId?: string; visibility?: SocialPostVisibility };

/** Cursor de paginación: el último post recibido (fecha + id, para desempatar). */
export type FeedCursor = { created_at: string; id: string };

/** Archivo listo para subir desde el compositor. */
export type NewPostMedia = {
  kind: SocialMediaKind;
  blob: Blob;
  mimeType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
};
