import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { describeSocialError, getSocialRepository } from "@/hooks/useSocial";
import { applySocialEvent, useSocialEvents } from "@/lib/social/sync";
import type { SocialPost } from "@/lib/social/types";
import PostCard, { type PostNavigation } from "./PostCard";
import Sheet from "./Sheet";

type Props = PostNavigation & { postId: string; meId: string | null; onClose: () => void };

/** Una publicación suelta: la que se abre desde una cuadrícula o desde un enlace compartido. */
export default function PostSheet({ postId, meId, onClose, ...navigation }: Props) {
  const repo = getSocialRepository();
  const [post, setPost] = useState<SocialPost | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    setPost(undefined);
    repo
      .post(postId)
      .then((found) => !cancelled && setPost(found))
      .catch((err) => !cancelled && setError(describeSocialError(err)));
    return () => {
      cancelled = true;
    };
  }, [repo, postId]);

  useSocialEvents((event) => {
    if (event.type === "post-deleted" && event.id === postId) {
      onClose();
      return;
    }
    setPost((current) => (current ? applySocialEvent([current], event)[0] ?? null : current));
  });

  return (
    <Sheet label="Publicación" onClose={onClose} width="md">
      {post === undefined && !error ? (
        <div className="flex min-h-[40dvh] items-center justify-center"><Loader2 className="animate-spin text-ink/40" size={26} aria-label="Cargando publicación" /></div>
      ) : !post ? (
        <div className="flex min-h-[40dvh] items-center justify-center text-center">
          <p className="font-display text-3xl font-black">{error ?? "Esta publicación ya no existe."}</p>
        </div>
      ) : (
        <div className="pt-6 sm:pt-8">
          <PostCard post={post} meId={meId} {...navigation} />
        </div>
      )}
    </Sheet>
  );
}
