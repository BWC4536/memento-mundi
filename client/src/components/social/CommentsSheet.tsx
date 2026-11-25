import { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { describeSocialError, getSocialRepository } from "@/hooks/useSocial";
import { authorName, timeAgoShort } from "@/lib/social/format";
import { emitSocial } from "@/lib/social/sync";
import type { SocialComment, SocialPost } from "@/lib/social/types";
import { Caption } from "./PostCard";
import Sheet from "./Sheet";
import SocialAvatar from "./SocialAvatar";

const QUICK_REACTIONS = ["❤️", "🙌", "🔥", "👏", "😍", "😮", "🌍", "✈️"];

type Props = { post: SocialPost; meId: string | null; onClose: () => void; onOpenProfile: (userId: string) => void };

export default function CommentsSheet({ post, meId, onClose, onOpenProfile }: Props) {
  const repo = getSocialRepository();
  const [comments, setComments] = useState<SocialComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const postIsMine = post.author.id === meId;

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    repo
      .comments(post.id)
      .then((items) => !cancelled && setComments(items))
      .catch((err) => !cancelled && setError(describeSocialError(err)));
    return () => {
      cancelled = true;
    };
  }, [repo, post.id]);

  const sync = (next: SocialComment[]) => {
    setComments(next);
    emitSocial({ type: "post-patch", id: post.id, patch: { comment_count: next.length, preview_comments: next.slice(-2) } });
  };

  const send = async (text = draft) => {
    const body = text.trim();
    if (!repo || !body || sending) return;
    setSending(true);
    try {
      const created = await repo.addComment(post.id, body);
      sync([...(comments ?? []), created]);
      setDraft("");
      requestAnimationFrame(() => listEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    } catch (err) {
      toast.error(describeSocialError(err));
    } finally {
      setSending(false);
    }
  };

  const remove = async (comment: SocialComment) => {
    if (!repo || !comments) return;
    const previous = comments;
    sync(comments.filter((item) => item.id !== comment.id));
    try {
      await repo.deleteComment(comment.id);
    } catch (err) {
      sync(previous);
      toast.error(describeSocialError(err));
    }
  };

  return (
    <Sheet label="Comentarios" onClose={onClose} width="md" layer="top" bleed>
      <div className="flex min-h-[60dvh] flex-col">
        <div className="sticky top-0 z-10 border-b-2 border-ink bg-cream px-5 pb-3 pt-6 text-center">
          <p className="font-display text-2xl font-black">Comentarios</p>
        </div>

        <div className="flex-1 space-y-4 px-5 py-4">
          {post.caption ? (
            <div className="flex gap-3 border-b-2 border-ink/10 pb-4">
              <SocialAvatar author={post.author} size={34} />
              <p className="min-w-0 flex-1 whitespace-pre-line break-words text-sm leading-snug">
                <button type="button" onClick={() => onOpenProfile(post.author.id)} className="mr-1.5 font-black hover:underline">
                  {authorName(post.author)}
                </button>
                <Caption text={post.caption} />
                <span className="mt-1 block text-[11px] font-bold text-ink/45">{timeAgoShort(post.created_at)}</span>
              </p>
            </div>
          ) : null}

          {error ? <p className="rounded-2xl border-2 border-ink bg-[#f2c5a0] p-3 text-sm font-bold">{error}</p> : null}
          {!comments && !error ? (
            <div className="flex justify-center py-10" aria-busy="true">
              <Loader2 className="animate-spin text-ink/40" size={24} aria-label="Cargando comentarios" />
            </div>
          ) : null}
          {comments?.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-display text-2xl font-black">Aún no hay comentarios.</p>
              <p className="mt-1 text-sm font-semibold text-ink/55">Empieza la conversación.</p>
            </div>
          ) : null}
          {comments?.map((comment) => {
            const canDelete = comment.author?.id === meId || postIsMine;
            return (
              <div key={comment.id} className="group flex gap-3">
                <button type="button" onClick={() => comment.author && onOpenProfile(comment.author.id)} aria-label={`Ver perfil de ${authorName(comment.author)}`}>
                  <SocialAvatar author={comment.author} size={34} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm leading-snug">
                    <button type="button" onClick={() => comment.author && onOpenProfile(comment.author.id)} className="mr-1.5 font-black hover:underline">
                      {comment.author ? authorName(comment.author) : "Cuenta privada"}
                    </button>
                    <Caption text={comment.body} />
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-ink/45">{timeAgoShort(comment.created_at)}</p>
                </div>
                {canDelete ? (
                  <button type="button" onClick={() => void remove(comment)} aria-label="Borrar comentario" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/40 opacity-100 transition-opacity hover:bg-[#f2c5a0] hover:text-[#b44728] sm:opacity-0 sm:group-hover:opacity-100">
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            );
          })}
          <div ref={listEnd} />
        </div>

        <div className="sticky bottom-0 border-t-2 border-ink bg-cream px-4 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mb-2.5 flex justify-between gap-1 overflow-x-auto [scrollbar-width:none]">
            {QUICK_REACTIONS.map((emoji) => (
              <button key={emoji} type="button" disabled={sending} onClick={() => void send(emoji)} aria-label={`Comentar ${emoji}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 disabled:opacity-50">
                {emoji}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, 1000))}
              placeholder="Añade un comentario…"
              aria-label="Escribe un comentario"
              className="min-h-11 flex-1 rounded-full border-2 border-ink bg-white/70 px-4 text-sm font-semibold outline-none focus:ring-4 focus:ring-orange/40"
            />
            <button type="submit" disabled={!draft.trim() || sending} aria-label="Publicar comentario" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-orange shadow-hard-sm transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:shadow-none">
              {sending ? <Loader2 size={17} className="animate-spin" /> : <SendHorizontal size={17} />}
            </button>
          </form>
        </div>
      </div>
    </Sheet>
  );
}
