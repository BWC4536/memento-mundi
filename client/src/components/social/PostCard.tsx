import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Ellipsis, Heart, Link2, MapPin, MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { describeSocialError, getSocialRepository } from "@/hooks/useSocial";
import { authorName, plural, timeAgoShort, tokenizeCaption } from "@/lib/social/format";
import { postUrl, shareLink } from "@/lib/social/share";
import { emitSocial } from "@/lib/social/sync";
import type { SocialPost } from "@/lib/social/types";
import MediaCarousel from "./MediaCarousel";
import SocialAvatar from "./SocialAvatar";

export type PostNavigation = {
  onOpenPlace: (slug: string) => void;
  onOpenProfile: (userId: string) => void;
  onOpenComments: (post: SocialPost) => void;
};

const timeLabel = (iso: string) => {
  const value = timeAgoShort(iso);
  return value === "ahora" || /\d{4}$/.test(value) ? value : `hace ${value}`;
};

export function Caption({ text, onTag }: { text: string; onTag?: (tag: string) => void }) {
  return (
    <>
      {tokenizeCaption(text).map((part, index) =>
        part.tag ? (
          <button key={index} type="button" onClick={() => onTag?.(part.text)} className="font-bold text-[#2f6f8f] hover:underline">
            {part.text}
          </button>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Acciones con actualización optimista: se pintan al instante y se deshacen si el servidor falla. */
export function usePostActions(post: SocialPost) {
  const repo = getSocialRepository();

  const like = async (value = !post.liked) => {
    if (!repo || value === post.liked) return;
    emitSocial({ type: "post-patch", id: post.id, patch: { liked: value, like_count: Math.max(0, post.like_count + (value ? 1 : -1)) } });
    try {
      await repo.setLiked(post.id, value);
    } catch (error) {
      emitSocial({ type: "post-patch", id: post.id, patch: { liked: post.liked, like_count: post.like_count } });
      toast.error(describeSocialError(error));
    }
  };

  const save = async () => {
    if (!repo) return;
    const value = !post.saved;
    emitSocial({ type: "post-patch", id: post.id, patch: { saved: value } });
    try {
      await repo.setSaved(post.id, value);
      toast.success(value ? "Guardado en tu colección." : "Quitado de guardados.");
    } catch (error) {
      emitSocial({ type: "post-patch", id: post.id, patch: { saved: post.saved } });
      toast.error(describeSocialError(error));
    }
  };

  const follow = async (value = !post.following_author) => {
    if (!repo) return;
    emitSocial({ type: "follow", userId: post.author.id, following: value });
    try {
      await repo.setFollowing(post.author.id, value);
    } catch (error) {
      emitSocial({ type: "follow", userId: post.author.id, following: !value });
      toast.error(describeSocialError(error));
    }
  };

  const share = async () => {
    const result = await shareLink(postUrl(post.id), `${authorName(post.author)} en Memento Mundi`, post.caption ?? undefined);
    if (result === "copied") toast.success("Enlace copiado.");
    else if (result === "failed") toast.error("No se pudo compartir.");
  };

  const remove = async () => {
    if (!repo) return;
    try {
      await repo.deletePost(post.id);
      emitSocial({ type: "post-deleted", id: post.id });
      toast.success("Publicación eliminada.");
    } catch (error) {
      toast.error(describeSocialError(error));
    }
  };

  return { like, save, follow, share, remove };
}

function PostMenu({ post, mine, onClose, onRemove, onOpenPlace }: { post: SocialPost; mine: boolean; onClose: () => void; onRemove: () => void; onOpenPlace: (slug: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-black hover:bg-orange";
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-3 top-12 z-30 w-56 rounded-2xl border-2 border-ink bg-cream p-2 shadow-hard">
      <button
        type="button"
        className={item}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(postUrl(post.id));
            toast.success("Enlace copiado.");
          } catch {
            toast.error("No se pudo copiar el enlace.");
          }
          onClose();
        }}
      >
        <Link2 size={16} /> Copiar enlace
      </button>
      {post.place ? (
        <button type="button" className={item} onClick={() => { onOpenPlace(post.place!.slug); onClose(); }}>
          <MapPin size={16} /> Ver {post.place.name} en el mapa
        </button>
      ) : null}
      {mine ? (
        <>
          <div className="my-1 border-t-2 border-ink/10" />
          <button type="button" className={`${item} text-[#b44728] hover:bg-[#f2c5a0]`} onClick={() => (confirming ? (onRemove(), onClose()) : setConfirming(true))}>
            <Trash2 size={16} /> {confirming ? "Toca otra vez para borrar" : "Eliminar publicación"}
          </button>
        </>
      ) : null}
    </motion.div>
  );
}

type Props = PostNavigation & { post: SocialPost; meId: string | null; priority?: boolean };

export default function PostCard({ post, meId, onOpenPlace, onOpenProfile, onOpenComments }: Props) {
  const actions = usePostActions(post);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const mine = post.author.id === meId;
  const name = authorName(post.author);
  const caption = post.caption ?? "";
  const longCaption = caption.length > 140 || caption.includes("\n");

  return (
    <article className="relative overflow-visible rounded-[1.6rem] border-2 border-ink bg-cream shadow-hard-sm" aria-label={`Publicación de ${name}`}>
      <header className="flex items-center gap-3 px-3.5 py-3">
        <button type="button" onClick={() => onOpenProfile(post.author.id)} aria-label={`Ver perfil de ${name}`} className="transition-transform hover:scale-105">
          <SocialAvatar author={post.author} size={38} />
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="flex min-w-0 items-center gap-1.5 text-sm">
            <button type="button" onClick={() => onOpenProfile(post.author.id)} className="truncate font-black hover:underline">
              {name}
            </button>
            {!mine && !post.following_author ? (
              <>
                <span className="text-ink/35" aria-hidden>·</span>
                <button type="button" onClick={() => void actions.follow(true)} className="shrink-0 font-black text-orange hover:text-ink">
                  Seguir
                </button>
              </>
            ) : null}
          </p>
          {post.place ? (
            <button type="button" onClick={() => onOpenPlace(post.place!.slug)} className="mt-0.5 flex max-w-full items-center gap-1 truncate text-[11px] font-bold text-ink/60 hover:text-ink">
              <MapPin size={11} className="shrink-0" aria-hidden /> <span className="truncate">{post.place.name}, {post.place.country}</span>
            </button>
          ) : null}
        </div>
        <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Más opciones" aria-expanded={menuOpen} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-ink/5">
          <Ellipsis size={18} />
        </button>
        <AnimatePresence>{menuOpen ? <PostMenu post={post} mine={mine} onClose={() => setMenuOpen(false)} onRemove={() => void actions.remove()} onOpenPlace={onOpenPlace} /> : null}</AnimatePresence>
      </header>

      <div className="border-y-2 border-ink">
        <MediaCarousel media={post.media} alt={caption ? caption.slice(0, 120) : `Publicación de ${name}`} onDoubleTap={() => void actions.like(true)} />
      </div>

      <div className="px-3.5 pb-4 pt-2.5">
        <div className="flex items-center gap-1">
          <motion.button type="button" whileTap={{ scale: 0.8 }} onClick={() => void actions.like()} aria-pressed={post.liked} aria-label={post.liked ? "Quitar me gusta" : "Me gusta"} className="-ml-1.5 flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5">
            <motion.span key={String(post.liked)} initial={post.liked ? { scale: 0.5 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}>
              <Heart size={24} strokeWidth={2.2} className={post.liked ? "fill-[#e0452b] text-[#e0452b]" : ""} />
            </motion.span>
          </motion.button>
          <button type="button" onClick={() => onOpenComments(post)} aria-label="Comentar" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5">
            <MessageCircle size={23} strokeWidth={2.2} className="-scale-x-100" />
          </button>
          <button type="button" onClick={() => void actions.share()} aria-label="Compartir" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5">
            <Send size={22} strokeWidth={2.2} />
          </button>
          <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => void actions.save()} aria-pressed={post.saved} aria-label={post.saved ? "Quitar de guardados" : "Guardar"} className="-mr-1.5 ml-auto flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/5">
            <Bookmark size={23} strokeWidth={2.2} className={post.saved ? "fill-ink" : ""} />
          </motion.button>
        </div>

        <p className="mt-0.5 text-sm font-black">{post.like_count > 0 ? plural(post.like_count, "me gusta", "me gusta") : "Sé el primero en darle me gusta"}</p>

        {caption ? (
          <p className={`mt-1 whitespace-pre-line break-words text-sm leading-snug ${!expanded && longCaption ? "line-clamp-2" : ""}`}>
            <button type="button" onClick={() => onOpenProfile(post.author.id)} className="mr-1.5 font-black hover:underline">
              {name}
            </button>
            <Caption text={caption} />
          </p>
        ) : null}
        {!expanded && longCaption ? (
          <button type="button" onClick={() => setExpanded(true)} className="text-sm font-bold text-ink/50 hover:text-ink">
            más
          </button>
        ) : null}

        {post.comment_count > 0 ? (
          <button type="button" onClick={() => onOpenComments(post)} className="mt-1.5 block text-sm font-semibold text-ink/55 hover:text-ink">
            {post.comment_count === 1 ? "Ver el comentario" : `Ver los ${post.comment_count} comentarios`}
          </button>
        ) : null}
        {post.preview_comments.map((comment) => (
          <p key={comment.id} className="mt-0.5 line-clamp-1 break-words text-sm leading-snug">
            <button type="button" onClick={() => comment.author && onOpenProfile(comment.author.id)} className="mr-1.5 font-black hover:underline">
              {authorName(comment.author)}
            </button>
            {comment.body}
          </p>
        ))}

        <button type="button" onClick={() => onOpenComments(post)} className="mt-2 block w-full text-left text-sm font-semibold text-ink/40 hover:text-ink/70">
          Añade un comentario…
        </button>
        <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-ink/40">
          <time dateTime={post.created_at}>{timeLabel(post.created_at)}</time>
        </p>
      </div>
    </article>
  );
}
