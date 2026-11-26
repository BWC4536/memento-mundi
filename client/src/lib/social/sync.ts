/**
 * Sincronización entre listas: un like dado en la ficha de un lugar se ve también en el feed,
 * seguir a alguien desde su perfil actualiza el botón "Seguir" de todos sus posts, etc.
 * Cada lista escucha estos eventos y aplica `applySocialEvent` a su estado.
 */
import { useEffect, useRef } from "react";
import type { FeedQuery, SocialPost } from "./types";

export type SocialEvent =
  | { type: "post-patch"; id: string; patch: Partial<SocialPost> }
  | { type: "post-created"; post: SocialPost }
  | { type: "post-deleted"; id: string }
  | { type: "follow"; userId: string; following: boolean }
  | { type: "place-follow"; placeId: string; following: boolean };

const EVENT = "memento:social";

export function emitSocial(event: SocialEvent) {
  window.dispatchEvent(new CustomEvent<SocialEvent>(EVENT, { detail: event }));
}

export function useSocialEvents(handler: (event: SocialEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const listener = (event: Event) => ref.current((event as CustomEvent<SocialEvent>).detail);
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, []);
}

/** Aplica un evento a una lista de posts (inmutable). Los posts nuevos los añade quien publica, no esta función. */
export function applySocialEvent(posts: SocialPost[], event: SocialEvent): SocialPost[] {
  switch (event.type) {
    case "post-patch":
      return posts.map((post) => (post.id === event.id ? { ...post, ...event.patch } : post));
    case "post-deleted":
      return posts.filter((post) => post.id !== event.id);
    case "follow":
      return posts.map((post) => (post.author.id === event.userId ? { ...post, following_author: event.following } : post));
    default:
      return posts;
  }
}

export const isPrivate = (post: Pick<SocialPost, "visibility">) => post.visibility === "private";

/** ¿Puede este post estar en esta lista? (lo privado solo en "@usuario" o en mi propio perfil). */
export const matchesQuery = (query: FeedQuery, post: SocialPost, meId: string | null) => {
  if (query.scope === "saved") return false;
  if (query.placeId && post.place?.id !== query.placeId) return false;
  if (query.authorId && post.author.id !== query.authorId) return false;
  if (query.visibility && (post.visibility ?? "public") !== query.visibility) return false;
  if (query.scope === "mine") return post.author.id === meId;
  if (isPrivate(post) && !(query.authorId && query.authorId === meId)) return false;
  return query.scope !== "following" || post.author.id === meId;
};
