import { useRef } from "react";
import { Camera, Copy, Heart, Loader2, MessageCircle, Play } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/useSocial";
import { compactCount } from "@/lib/social/format";
import type { SocialPost } from "@/lib/social/types";

type Props = {
  posts: SocialPost[];
  loading: boolean;
  done: boolean;
  error?: string | null;
  onLoadMore: () => void;
  onOpen: (post: SocialPost) => void;
  emptyTitle: string;
  emptyBody?: string;
};

/** Cuadrícula 3×N tipo perfil de Instagram, con scroll infinito. */
export default function PostGrid({ posts, loading, done, error, onLoadMore, onOpen, emptyTitle, emptyBody }: Props) {
  const sentinel = useRef<HTMLDivElement>(null);
  useInfiniteScroll(sentinel, onLoadMore, !done && !loading && posts.length > 0);

  if (!loading && !error && posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink"><Camera size={26} /></span>
        <p className="font-display text-2xl font-black">{emptyTitle}</p>
        {emptyBody ? <p className="max-w-xs text-sm font-semibold text-ink/55">{emptyBody}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
        {posts.map((post) => {
          const first = post.media[0];
          const poster = post.media.find((item) => item.kind === "photo") ?? first;
          return (
            <button key={post.id} type="button" onClick={() => onOpen(post)} className="group relative aspect-square overflow-hidden bg-ink/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange/60" aria-label={post.caption ? post.caption.slice(0, 80) : "Abrir publicación"}>
              {poster?.kind === "video" ? (
                <video src={`${poster.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : poster ? (
                <img src={poster.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : null}
              {post.media.length > 1 ? <Copy size={16} className="absolute right-2 top-2 text-cream drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]" aria-hidden /> : first?.kind === "video" ? <Play size={16} className="absolute right-2 top-2 fill-cream text-cream drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]" aria-hidden /> : null}
              <span className="absolute inset-0 hidden items-center justify-center gap-4 bg-ink/45 text-sm font-black text-cream group-hover:flex">
                <span className="flex items-center gap-1"><Heart size={16} className="fill-cream" /> {compactCount(post.like_count)}</span>
                <span className="flex items-center gap-1"><MessageCircle size={16} className="fill-cream" /> {compactCount(post.comment_count)}</span>
              </span>
            </button>
          );
        })}
        {loading ? Array.from({ length: posts.length ? 3 : 9 }, (_, index) => <div key={`s-${index}`} className="aspect-square animate-pulse bg-ink/10" />) : null}
      </div>
      {error ? <p className="mt-4 rounded-2xl border-2 border-ink bg-[#f2c5a0] p-3 text-sm font-bold">{error}</p> : null}
      <div ref={sentinel} className="h-4" />
      {loading && posts.length > 0 ? <Loader2 className="mx-auto my-4 animate-spin text-ink/40" size={20} aria-label="Cargando más" /> : null}
    </div>
  );
}
