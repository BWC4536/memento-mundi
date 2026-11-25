import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { authStore, supabaseClient } from "@/lib/supabase/auth";
import { SupabaseError } from "@/lib/supabase/client";
import { createSocialRepository, FEED_PAGE_SIZE, SocialSetupError, type SocialRepository } from "@/lib/supabase/social-repository";
import { applySocialEvent, useSocialEvents } from "@/lib/social/sync";
import type { FeedQuery, SocialPlace, SocialPost } from "@/lib/social/types";

let repository: SocialRepository | null | undefined;

/** Repositorio único de la red social (null si la app no usa Supabase). */
export function getSocialRepository(): SocialRepository | null {
  if (repository === undefined) {
    repository =
      supabaseClient && authStore
        ? createSocialRepository({ client: supabaseClient, getAccessToken: () => authStore!.getAccessToken(), getUserId: () => authStore!.getSession()?.user.id ?? null })
        : null;
  }
  return repository;
}

export const describeSocialError = (error: unknown) =>
  error instanceof SocialSetupError || error instanceof SupabaseError ? error.message : "No se pudo conectar con la comunidad.";

const matchesQuery = (query: FeedQuery, post: SocialPost, meId: string | null) => {
  if (query.scope === "saved") return false;
  if (query.placeId && post.place?.id !== query.placeId) return false;
  if (query.authorId && post.author.id !== query.authorId) return false;
  return query.scope !== "following" || post.author.id === meId;
};

type FeedState = { posts: SocialPost[]; loading: boolean; done: boolean; error: string | null; setupMissing: boolean };

/** Feed paginado por fecha (cursor = created_at del último post) y sincronizado con el resto de listas. */
export function useFeed(query: FeedQuery, { enabled = true, pageSize = FEED_PAGE_SIZE }: { enabled?: boolean; pageSize?: number } = {}) {
  const repo = getSocialRepository();
  const key = `${query.scope ?? "all"}|${query.placeId ?? ""}|${query.authorId ?? ""}`;
  const [state, setState] = useState<FeedState>({ posts: [], loading: enabled, done: false, error: null, setupMissing: false });
  const busy = useRef(false);
  const generation = useRef(0);
  const queryRef = useRef(query);
  queryRef.current = query;
  const stateRef = useRef(state);
  stateRef.current = state;

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!repo || !enabled || (busy.current && !reset)) return;
      const run = ++generation.current;
      busy.current = true;
      setState((current) => ({ ...current, loading: true, error: null, ...(reset ? { posts: [], done: false } : {}) }));
      try {
        const before = reset ? undefined : stateRef.current.posts.at(-1)?.created_at;
        const page = await repo.feed(queryRef.current, before, pageSize);
        if (run !== generation.current) return;
        setState((current) => {
          const base = reset ? [] : current.posts;
          const seen = new Set(base.map((post) => post.id));
          return { posts: [...base, ...page.filter((post) => !seen.has(post.id))], loading: false, done: page.length < pageSize, error: null, setupMissing: false };
        });
      } catch (error) {
        if (run !== generation.current) return;
        setState((current) => ({ ...current, loading: false, error: describeSocialError(error), setupMissing: error instanceof SocialSetupError }));
      } finally {
        if (run === generation.current) busy.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repo, enabled, pageSize, key],
  );

  useEffect(() => {
    if (enabled) void fetchPage(true);
  }, [enabled, fetchPage]);

  useSocialEvents((event) => {
    if (event.type === "post-created") {
      if (matchesQuery(queryRef.current, event.post, repo?.me() ?? null)) setState((current) => ({ ...current, posts: [event.post, ...current.posts.filter((post) => post.id !== event.post.id)] }));
      return;
    }
    // "Guardados": si quito el guardado, desaparece de la lista.
    if (event.type === "post-patch" && queryRef.current.scope === "saved" && event.patch.saved === false) {
      setState((current) => ({ ...current, posts: current.posts.filter((post) => post.id !== event.id) }));
      return;
    }
    setState((current) => ({ ...current, posts: applySocialEvent(current.posts, event) }));
  });

  const loadMore = useCallback(() => {
    if (!stateRef.current.done && !stateRef.current.loading) void fetchPage(false);
  }, [fetchPage]);
  const reload = useCallback(() => void fetchPage(true), [fetchPage]);

  return { ...state, loadMore, reload, available: !!repo };
}

/** Lugares del mapa con sus contadores; se actualizan al seguir un lugar o publicar en él. */
export function useSocialPlaces(enabled: boolean) {
  const repo = getSocialRepository();
  const [places, setPlaces] = useState<SocialPlace[]>([]);
  const [loading, setLoading] = useState(enabled && !!repo);
  const [error, setError] = useState<string | null>(null);
  const [setupMissing, setSetupMissing] = useState(false);

  const reload = useCallback(async () => {
    if (!repo || !enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setPlaces(await repo.places());
      setError(null);
      setSetupMissing(false);
    } catch (err) {
      setError(describeSocialError(err));
      setSetupMissing(err instanceof SocialSetupError);
    } finally {
      setLoading(false);
    }
  }, [repo, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useSocialEvents((event) => {
    if (event.type === "place-follow") {
      setPlaces((items) =>
        items.map((place) =>
          place.id === event.placeId && place.following !== event.following
            ? { ...place, following: event.following, follower_count: Math.max(0, place.follower_count + (event.following ? 1 : -1)) }
            : place,
        ),
      );
    } else if (event.type === "post-created" && event.post.place) {
      const placeId = event.post.place.id;
      setPlaces((items) => items.map((place) => (place.id === placeId ? { ...place, post_count: place.post_count + 1, latest_at: event.post.created_at } : place)));
    }
  });

  return { places, loading, error, setupMissing, reload };
}

/** Llama a `onHit` cuando el centinela se acerca a la vista (scroll infinito). */
export function useInfiniteScroll(ref: RefObject<Element | null>, onHit: () => void, enabled: boolean) {
  const callback = useRef(onHit);
  callback.current = onHit;
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && callback.current(), { rootMargin: "700px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);
}

// ── Sonido de los vídeos: un único interruptor para todo el feed, como en Instagram ──
let videoMuted = true;
const soundListeners = new Set<() => void>();

export function useVideoMuted(): [boolean, (muted: boolean) => void] {
  const muted = useSyncExternalStore(
    (listener) => {
      soundListeners.add(listener);
      return () => soundListeners.delete(listener);
    },
    () => videoMuted,
    () => true,
  );
  const set = useCallback((value: boolean) => {
    videoMuted = value;
    soundListeners.forEach((listener) => listener());
  }, []);
  return [muted, set];
}
