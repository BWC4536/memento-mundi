import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Search, Send, UserCheck, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { describeSocialError, getSocialRepository, usePeopleSearch } from "@/hooks/useSocial";
import { authorName, plural } from "@/lib/social/format";
import { profileUrl, shareLink } from "@/lib/social/share";
import { emitSocial } from "@/lib/social/sync";
import type { ConnectionKind, SocialUser } from "@/lib/social/types";
import Sheet from "./Sheet";
import SocialAvatar from "./SocialAvatar";

export const CONNECTION_TABS: Array<{ id: ConnectionKind; label: string; empty: string }> = [
  { id: "friends", label: "Amigos", empty: "Cuando tú y otra persona os sigáis, aparecerá aquí." },
  { id: "followers", label: "Te siguen", empty: "Aún no te sigue nadie. Comparte tu perfil para que te encuentren." },
  { id: "following", label: "Sigues", empty: "Todavía no sigues a nadie. Busca arriba por @usuario o nombre." },
];

/** Seguir / dejar de seguir con actualización optimista (todas las listas se enteran por evento). */
async function toggleFollow(user: SocialUser) {
  const repo = getSocialRepository();
  if (!repo) return;
  const value = !user.followed_by_me;
  emitSocial({ type: "follow", userId: user.id, following: value });
  try {
    await repo.setFollowing(user.id, value);
  } catch (error) {
    emitSocial({ type: "follow", userId: user.id, following: !value });
    toast.error(describeSocialError(error));
  }
}

function relation(user: SocialUser) {
  if (user.followed_by_me && user.follows_me) return "Amigos";
  if (user.follows_me) return "Te sigue";
  return null;
}

function PersonRow({ user, onOpen }: { user: SocialUser; onOpen: (id: string) => void }) {
  const tag = relation(user);
  const name = authorName(user);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button type="button" onClick={() => onOpen(user.id)} aria-label={`Ver perfil de ${name}`} className="shrink-0 transition-transform hover:scale-105">
        <SocialAvatar author={user} size={46} />
      </button>
      <button type="button" onClick={() => onOpen(user.id)} className="min-w-0 flex-1 text-left leading-tight">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-black hover:underline">{name}</span>
          {tag ? <span className="shrink-0 rounded-full bg-ink/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">{tag}</span> : null}
        </span>
        <span className="block truncate text-xs font-semibold text-ink/55">
          {user.display_name && user.username ? `${user.display_name} · ` : ""}
          {plural(user.post_count, "publicación", "publicaciones")}
        </span>
      </button>
      <button
        type="button"
        onClick={() => void toggleFollow(user)}
        aria-pressed={user.followed_by_me}
        aria-label={`${user.followed_by_me ? "Dejar de seguir a" : "Seguir a"} ${name}`}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl border-2 border-ink px-2.5 text-xs font-black transition-colors min-[380px]:px-3 ${user.followed_by_me ? "bg-cream hover:bg-white" : "bg-orange hover:bg-ink hover:text-cream"}`}
      >
        {user.followed_by_me ? <UserCheck size={14} /> : <UserPlus size={14} />}
        <span className="hidden min-[380px]:inline">{user.followed_by_me ? "Siguiendo" : user.follows_me ? "Seguir también" : "Seguir"}</span>
      </button>
    </li>
  );
}

type Props = {
  meId: string | null;
  initialTab?: ConnectionKind;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
};

/** Buscar amigos por @usuario o nombre, y ver tus amigos, quién te sigue y a quién sigues. */
export default function FriendsSheet({ meId, initialTab = "friends", onClose, onOpenProfile }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ConnectionKind>(initialTab);
  const inputRef = useRef<HTMLInputElement>(null);
  const people = usePeopleSearch(query, tab);

  // En escritorio el cursor va directo al buscador; en móvil no, para no tapar la lista con el teclado.
  useEffect(() => {
    if (window.matchMedia("(min-width: 640px)").matches) inputRef.current?.focus();
  }, []);

  const invite = async () => {
    if (!meId) return;
    const result = await shareLink(profileUrl(meId), "Sígueme en Memento Mundi", "Mis viajes, fotos y lugares en Memento Mundi.");
    if (result === "copied") toast.success("Enlace de tu perfil copiado.");
    else if (result === "failed") toast.error("No se pudo compartir.");
  };

  const current = CONNECTION_TABS.find((item) => item.id === tab)!;

  return (
    <Sheet label="Buscar amigos" onClose={onClose} width="md" bleed>
      <div className="flex min-h-[70dvh] flex-col sm:min-h-[560px]">
        <div className="sticky top-0 z-10 border-b-2 border-ink bg-cream px-4 pb-3 pt-6 sm:px-6">
          <p className="pr-12 font-display text-3xl font-black tracking-[-.01em]">Buscar amigos</p>
          <div className="relative mt-3">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/45" aria-hidden />
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 60))}
              placeholder="@usuario o nombre"
              aria-label="Buscar personas por @usuario o nombre"
              className="min-h-11 w-full rounded-full border-2 border-ink bg-white/75 pl-10 pr-10 text-[16px] font-semibold outline-none focus:ring-4 focus:ring-orange/40 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full hover:bg-ink/10">
                <X size={14} />
              </button>
            ) : null}
          </div>
          {!people.searching ? (
            <div role="tablist" aria-label="Tus conexiones" className="mt-3 flex gap-1 rounded-2xl border-2 border-ink bg-white/50 p-1">
              {CONNECTION_TABS.map((item) => {
                const active = item.id === tab;
                return (
                  <button key={item.id} type="button" role="tab" aria-selected={active} onClick={() => setTab(item.id)} className={`relative min-h-9 flex-1 rounded-xl text-xs font-black transition-colors ${active ? "text-ink" : "text-ink/50 hover:text-ink"}`}>
                    {active ? <motion.span layoutId="friends-tab" className="absolute inset-0 rounded-xl bg-orange" transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
                    <span className="relative">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6" aria-live="polite" aria-busy={people.loading}>
          {people.error ? <p className="mt-4 rounded-2xl border-2 border-ink bg-[#f2c5a0] p-3 text-sm font-bold">{people.error}</p> : null}

          {people.loading && people.users.length === 0 ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-ink/40" size={22} aria-label="Buscando" /></div>
          ) : null}

          {!people.loading && !people.error && people.users.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink"><Users size={22} /></span>
              <p className="font-display text-2xl font-black">{people.searching ? `Nadie se llama “${query.trim()}”.` : `Nada en “${current.label}”.`}</p>
              <p className="max-w-xs text-sm font-semibold text-ink/55">{people.searching ? "Prueba con otra parte del nombre o del @usuario. Las cuentas privadas no aparecen." : current.empty}</p>
            </div>
          ) : null}

          {people.users.length ? (
            <ul className={`divide-y-2 divide-ink/10 transition-opacity ${people.loading ? "opacity-60" : ""}`}>
              {people.users.map((user) => (
                <PersonRow key={user.id} user={user} onOpen={onOpenProfile} />
              ))}
            </ul>
          ) : null}

          <button type="button" onClick={() => void invite()} className="mt-4 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-ink/35 p-3 text-left transition-colors hover:border-ink hover:bg-white/60">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-orange"><Send size={16} /></span>
            <span className="leading-tight">
              <span className="block text-sm font-black">Invitar a tus amigos</span>
              <span className="block text-xs font-semibold text-ink/55">Comparte el enlace de tu perfil para que te sigan.</span>
            </span>
          </button>
        </div>
      </div>
    </Sheet>
  );
}
