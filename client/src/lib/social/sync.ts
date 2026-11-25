/**
 * Sincronización entre listas: un like dado en la ficha de un lugar se ve también en el feed,
 * seguir a alguien desde su perfil actualiza el botón "Seguir" de todos sus posts, etc.
 * Cada lista escucha estos eventos y aplica `applySocialEvent` a su estado.
 */
import { useEffect, useRef } from "react";
import type { SocialPost } from "./types";

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
