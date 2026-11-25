import { authorInitials, avatarTint } from "@/lib/social/format";
import type { SocialAuthor } from "@/lib/social/types";

type Props = {
  author: Pick<SocialAuthor, "id" | "username" | "display_name" | "avatar_url"> | null | undefined;
  size?: number;
  /** Aro naranja (como las historias nuevas). */
  ring?: boolean;
  className?: string;
};

export default function SocialAvatar({ author, size = 36, ring = false, className = "" }: Props) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-ink font-black leading-none text-ink ${ring ? "outline outline-2 outline-offset-2 outline-orange" : ""} ${className}`}
      style={{ width: size, height: size, backgroundColor: author?.avatar_url ? "#EAE7DA" : avatarTint(author?.id ?? "?"), fontSize: Math.max(9, Math.round(size * 0.34)) }}
      aria-hidden
    >
      {author?.avatar_url ? <img src={author.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : authorInitials(author)}
    </span>
  );
}
