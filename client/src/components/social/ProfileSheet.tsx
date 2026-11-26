import { useEffect, useState } from "react";
import { Globe, Loader2, Pencil, Search, Share2, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { describeSocialError, getSocialRepository, useFeed } from "@/hooks/useSocial";
import { authorName, compactCount } from "@/lib/social/format";
import { profileUrl, shareLink } from "@/lib/social/share";
import { emitSocial, useSocialEvents } from "@/lib/social/sync";
import type { ConnectionKind, SocialPost, SocialProfile } from "@/lib/social/types";
import PostGrid from "./PostGrid";
import Sheet from "./Sheet";
import SocialAvatar from "./SocialAvatar";

type Props = {
  userId: string;
  meId: string | null;
  onClose: () => void;
  onOpenPost: (post: SocialPost) => void;
  onEditProfile: () => void;
  /** Solo en mi perfil: abre mis listas de seguidores / seguidos. */
  onOpenConnections?: (kind: ConnectionKind) => void;
};

export default function ProfileSheet({ userId, meId, onClose, onOpenPost, onEditProfile, onOpenConnections }: Props) {
  const repo = getSocialRepository();
  const [profile, setProfile] = useState<SocialProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const feed = useFeed({ authorId: userId }, { pageSize: 18 });
  const isMe = userId === meId;

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    setProfile(undefined);
    repo
      .profile(userId)
      .then((data) => !cancelled && setProfile(data))
      .catch((err) => !cancelled && setError(describeSocialError(err)));
    return () => {
      cancelled = true;
    };
  }, [repo, userId]);

  // Si sigo a esta persona desde un post (en otra lista), el botón y el contador se actualizan aquí también.
  useSocialEvents((event) => {
    if (event.type === "follow" && event.userId === userId) {
      setProfile((current) => (current && current.followed_by_me !== event.following ? { ...current, followed_by_me: event.following, follower_count: Math.max(0, current.follower_count + (event.following ? 1 : -1)) } : current));
    }
    if (event.type === "post-created" && event.post.author.id === userId) setProfile((current) => (current ? { ...current, post_count: current.post_count + 1 } : current));
    if (event.type === "post-deleted") setProfile((current) => (current && isMe ? { ...current, post_count: Math.max(0, current.post_count - 1) } : current));
  });

  const toggleFollow = async () => {
    if (!repo || !profile) return;
    const value = !profile.followed_by_me;
    emitSocial({ type: "follow", userId, following: value });
    try {
      await repo.setFollowing(userId, value);
    } catch (err) {
      emitSocial({ type: "follow", userId, following: !value });
      toast.error(describeSocialError(err));
    }
  };

  const name = profile ? authorName(profile) : "";

  return (
    <Sheet label={profile ? `Perfil de ${name}` : "Perfil"} onClose={onClose} width="xl">
      {profile === undefined && !error ? (
        <div className="flex min-h-[40dvh] items-center justify-center"><Loader2 className="animate-spin text-ink/40" size={26} aria-label="Cargando perfil" /></div>
      ) : !profile ? (
        <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-2 text-center">
          <p className="font-display text-3xl font-black">{error ?? "Este perfil es privado o ya no existe."}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 pr-10 min-[400px]:gap-5 sm:gap-8">
            <SocialAvatar author={profile} size={72} className="shadow-hard-sm min-[400px]:!h-[88px] min-[400px]:!w-[88px] sm:!h-[112px] sm:!w-[112px]" />
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 text-center">
              {([
                [profile.post_count, profile.post_count === 1 ? "publicación" : "publicaciones", null],
                [profile.follower_count, profile.follower_count === 1 ? "seguidor" : "seguidores", "followers"],
                [profile.following_count, "seguidos", "following"],
              ] as const).map(([value, label, kind]) => {
                const content = (
                  <>
                    <span className="block font-display text-xl font-black min-[400px]:text-2xl sm:text-3xl">{compactCount(Number(value))}</span>
                    <span className="block truncate text-[9px] font-black uppercase tracking-[0.06em] text-ink/55 min-[400px]:text-[10px]">{label}</span>
                  </>
                );
                return isMe && kind && onOpenConnections ? (
                  <button key={label} type="button" onClick={() => onOpenConnections(kind)} className="min-w-0 rounded-xl py-1 transition-colors hover:bg-ink/5">{content}</button>
                ) : (
                  <div key={label} className="min-w-0 py-1">{content}</div>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <h2 className="break-words font-display text-3xl font-black tracking-[-.01em]">{profile.display_name || name}</h2>
            {profile.username ? <p className="text-sm font-bold text-ink/55">@{profile.username}</p> : null}
            {profile.follows_me && !isMe ? <span className="mt-1 inline-block rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">Te sigue</span> : null}
            {profile.bio ? <p className="mt-2 whitespace-pre-line text-sm font-medium leading-relaxed">{profile.bio}</p> : null}
            {profile.website_url ? (
              <a href={profile.website_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-sm font-black text-[#2f6f8f] hover:underline">
                <Globe size={13} /> {profile.website_url.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </div>

          <div className="mt-4 flex gap-2">
            {isMe ? (
              <>
                <button type="button" onClick={onEditProfile} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-cream text-sm font-black shadow-hard-sm hover:bg-white">
                  <Pencil size={15} /> Editar perfil
                </button>
                {onOpenConnections ? (
                  <button type="button" onClick={() => onOpenConnections("friends")} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-orange text-sm font-black shadow-hard-sm hover:bg-ink hover:text-cream">
                    <Search size={15} /> Amigos
                  </button>
                ) : null}
              </>
            ) : (
              <button type="button" onClick={() => void toggleFollow()} aria-pressed={profile.followed_by_me} className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-ink text-sm font-black shadow-hard-sm transition-colors ${profile.followed_by_me ? "bg-cream hover:bg-white" : "bg-orange hover:bg-ink hover:text-cream"}`}>
                {profile.followed_by_me ? <UserCheck size={16} /> : <UserPlus size={16} />} {profile.followed_by_me ? "Siguiendo" : profile.follows_me ? "Seguir también" : "Seguir"}
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                const result = await shareLink(profileUrl(userId), `${name} en Memento Mundi`);
                if (result === "copied") toast.success("Enlace copiado.");
              }}
              aria-label="Compartir perfil"
              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink bg-cream shadow-hard-sm hover:bg-white"
            >
              <Share2 size={15} />
            </button>
          </div>

          <div className="-mx-4 mt-6 border-t-2 border-ink sm:-mx-6">
            <PostGrid
              posts={feed.posts}
              loading={feed.loading}
              done={feed.done}
              error={feed.error}
              onLoadMore={feed.loadMore}
              onOpen={onOpenPost}
              emptyTitle={isMe ? "Comparte tu primer recuerdo." : "Aún no ha publicado nada."}
              emptyBody={isMe ? "Tus fotos y vídeos aparecerán aquí y en la chincheta de su lugar." : undefined}
            />
          </div>
        </>
      )}
    </Sheet>
  );
}
