import type { ReactNode } from "react";
import { Globe, Instagram, Lock, Music2, Pencil } from "lucide-react";
import { instagramUrl, tiktokUrl, type Profile } from "@/lib/profile";
import { Avatar } from "./ProfileUi";

const memberSince = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES", { month: "long", year: "numeric" }) : null);
type Social = { href: string; label: string; icon: ReactNode; name: string };

const websiteLabel = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/** Tarjeta de identidad: cómo te ven los demás. */
export default function ProfileIdentity({ profile, email, stats, onEdit }: { profile: Profile; email: string | null; stats: Array<{ label: string; value: number }>; onEdit: () => void }) {
  const since = memberSince(profile.createdAt);
  const socials: Social[] = [
    profile.instagram ? { href: instagramUrl(profile.instagram), label: `@${profile.instagram}`, icon: <Instagram size={15} />, name: "Instagram" } : null,
    profile.tiktok ? { href: tiktokUrl(profile.tiktok), label: `@${profile.tiktok}`, icon: <Music2 size={15} />, name: "TikTok" } : null,
    profile.website ? { href: profile.website, label: websiteLabel(profile.website), icon: <Globe size={15} />, name: "Web" } : null,
  ].filter((item): item is Social => item !== null);

  return (
    <section aria-label="Tu perfil" className="relative overflow-hidden rounded-[1.75rem] border-2 border-ink bg-white/70 p-5 shadow-hard sm:rounded-[2rem] sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex items-start justify-between gap-4 sm:block">
          <Avatar name={profile.displayName} url={profile.avatarUrl} size={88} className="sm:!h-[120px] sm:!w-[120px] sm:!text-[46px]" />
          <button type="button" onClick={onEdit} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-4 text-sm font-black shadow-hard-sm transition-transform hover:-translate-y-0.5 sm:hidden">
            <Pencil size={15} /> Editar
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="!text-[clamp(2.1rem,6vw,3.75rem)] break-words">{profile.displayName}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-ink/55">
                {profile.username ? <span className="text-ink">@{profile.username}</span> : <span>Sin nombre de usuario</span>}
                {since ? <span>Desde {since}</span> : null}
                {profile.isPrivate ? (
                  <span className="inline-flex items-center gap-1 rounded-full border-2 border-ink/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[.12em]">
                    <Lock size={11} /> Privado
                  </span>
                ) : null}
              </p>
            </div>
            <button type="button" onClick={onEdit} className="hidden min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-4 text-sm font-black shadow-hard-sm transition-transform hover:-translate-y-0.5 sm:flex">
              <Pencil size={15} /> Editar perfil
            </button>
          </div>

          {profile.bio ? <p className="mt-4 max-w-2xl whitespace-pre-line text-base font-medium leading-relaxed text-ink/75 sm:text-lg">{profile.bio}</p> : null}
          {!profile.bio && email ? <p className="mt-4 text-sm font-medium text-ink/50">Añade una biografía para que tus compañeros de viaje te reconozcan.</p> : null}

          {socials.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {socials.map((social) => (
                <li key={social.name} className="min-w-0 max-w-full">
                  <a href={social.href} target="_blank" rel="noreferrer" aria-label={`${social.name}: ${social.label}`} className="flex min-h-9 max-w-full items-center gap-1.5 rounded-full border-2 border-ink bg-cream px-3 text-xs font-black transition-colors hover:bg-orange">
                    {social.icon}
                    <span className="truncate">{social.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 divide-x-2 divide-ink/10 rounded-2xl border-2 border-ink bg-cream/70">
        {stats.map((stat) => (
          <div key={stat.label} className="px-2 py-3 text-center sm:py-4">
            <dd className="font-display text-3xl leading-none sm:text-4xl">{stat.value}</dd>
            <dt className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-ink/55 sm:text-xs">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
