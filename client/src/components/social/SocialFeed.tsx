import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AtSign, Bookmark, Compass, Database, Globe, Lock, LogIn, Plus, RotateCcw, Sparkles, UserCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { describeSocialError, getSocialRepository, useFeed, useInfiniteScroll } from "@/hooks/useSocial";
import { authorName, plural } from "@/lib/social/format";
import { emitSocial, useSocialEvents } from "@/lib/social/sync";
import type { FeedScope, SocialPlace, SocialPostVisibility, SocialProfile, SocialSuggestion } from "@/lib/social/types";
import { paisajeSrc, PAISAJES } from "@/lib/paisajes";
import FeedWindow from "./FeedWindow";
import PostCard, { type PostNavigation } from "./PostCard";
import SocialAvatar from "./SocialAvatar";

const DAY = 24 * 60 * 60 * 1000;

const TABS: Array<{ id: FeedScope; label: string; icon: typeof Compass }> = [
  { id: "all", label: "Para ti", icon: Compass },
  { id: "following", label: "Siguiendo", icon: Users },
  { id: "saved", label: "Guardados", icon: Bookmark },
  // La etiqueta real es el @usuario de quien mira (ver tabLabel).
  { id: "mine", label: "Tú", icon: AtSign },
];

const tabLabel = (id: FeedScope, fallback: string, me: SocialProfile | null) => (id === "mine" && me?.username ? `@${me.username}` : fallback);

const VISIBILITY_FILTERS: Array<{ id: SocialPostVisibility | null; label: string; icon: typeof Globe | null }> = [
  { id: null, label: "Todo", icon: null },
  { id: "public", label: "Públicas", icon: Globe },
  { id: "private", label: "Privadas", icon: Lock },
];

/** Fila de lugares tipo "historias": los que sigues primero y con aro si tienen algo nuevo de las últimas 24 h. */
function PlaceStories({ places, onOpenPlace, onCompose }: { places: SocialPlace[]; onOpenPlace: (slug: string) => void; onCompose: () => void }) {
  const ordered = useMemo(
    () =>
      [...places]
        .filter((place) => place.post_count > 0 || place.following)
        .sort((a, b) => Number(b.following) - Number(a.following) || Date.parse(b.latest_at ?? "0") - Date.parse(a.latest_at ?? "0")),
    [places],
  );
  const now = Date.now();
  return (
    <div className="-mx-4 flex gap-3.5 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <button type="button" onClick={onCompose} className="flex w-[74px] shrink-0 flex-col items-center gap-1.5">
        <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-dashed border-ink bg-white/60 transition-transform hover:scale-105">
          <Plus size={24} />
        </span>
        <span className="w-full truncate text-center text-[11px] font-black">Publicar</span>
      </button>
      {ordered.map((place) => {
        const fresh = place.latest_at ? now - Date.parse(place.latest_at) < DAY : false;
        return (
          <button key={place.id} type="button" onClick={() => onOpenPlace(place.slug)} className="group flex w-[74px] shrink-0 flex-col items-center gap-1.5" aria-label={`Abrir ${place.name}`}>
            <span className={`rounded-full p-[3px] ${fresh ? "bg-[conic-gradient(#FA9223,#e0452b,#F6D27A,#FA9223)]" : place.following ? "bg-ink" : "bg-ink/15"}`}>
              <span className="block h-[62px] w-[62px] overflow-hidden rounded-full border-2 border-cream bg-[#cbd8d2]">
                {place.cover_url ? <img src={place.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" /> : null}
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] font-black">{place.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function useSuggestions(enabled: boolean) {
  const [items, setItems] = useState<SocialSuggestion[]>([]);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const repo = getSocialRepository();
    if (!repo || !enabled) return;
    repo.suggestions(8).then(setItems).catch(() => undefined);
  }, [enabled]);
  useSocialEvents((event) => {
    if (event.type === "follow") setFollowing((current) => ({ ...current, [event.userId]: event.following }));
  });
  const toggle = async (userId: string) => {
    const repo = getSocialRepository();
    if (!repo) return;
    const value = !following[userId];
    emitSocial({ type: "follow", userId, following: value });
    try {
      await repo.setFollowing(userId, value);
    } catch (error) {
      emitSocial({ type: "follow", userId, following: !value });
      toast.error(describeSocialError(error));
    }
  };
  return { items, following, toggle };
}

function FollowButton({ active, onClick, compact = false }: { active: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-ink font-black transition-colors ${compact ? "h-8 px-3 text-[11px]" : "min-h-9 w-full px-3 text-xs"} ${active ? "bg-cream hover:bg-white" : "bg-orange hover:bg-ink hover:text-cream"}`}>
      {active ? <UserCheck size={14} /> : <UserPlus size={14} />} {active ? "Siguiendo" : "Seguir"}
    </button>
  );
}

function SuggestionsCarousel({ suggestions, onOpenProfile }: { suggestions: ReturnType<typeof useSuggestions>; onOpenProfile: (id: string) => void }) {
  if (suggestions.items.length === 0) return null;
  return (
    <section className="rounded-[1.6rem] border-2 border-ink bg-white/55 p-4 shadow-hard-sm" aria-label="Viajeros que quizá te gusten">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange">Sugerencias para ti</p>
      <p className="font-display text-2xl font-black">Viajeros que quizá te gusten</p>
      <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {suggestions.items.map((person) => (
          <div key={person.id} className="flex w-40 shrink-0 flex-col items-center gap-2 rounded-2xl border-2 border-ink bg-cream p-3 text-center">
            <button type="button" onClick={() => onOpenProfile(person.id)} className="relative h-20 w-full overflow-hidden rounded-xl border-2 border-ink bg-ink/10">
              {person.preview_url ? <img src={person.preview_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
            </button>
            <button type="button" onClick={() => onOpenProfile(person.id)} className="-mt-7">
              <SocialAvatar author={person} size={44} />
            </button>
            <button type="button" onClick={() => onOpenProfile(person.id)} className="w-full truncate text-sm font-black hover:underline">{authorName(person)}</button>
            <p className="-mt-1.5 text-[10px] font-bold text-ink/50">{plural(person.post_count, "publicación", "publicaciones")}</p>
            <FollowButton active={!!suggestions.following[person.id]} onClick={() => void suggestions.toggle(person.id)} />
          </div>
        ))}
      </div>
    </section>
  );
}

function SidebarSuggestions({ suggestions, onOpenProfile }: { suggestions: ReturnType<typeof useSuggestions>; onOpenProfile: (id: string) => void }) {
  if (suggestions.items.length === 0) return null;
  return (
    <section className="rounded-[1.6rem] border-2 border-ink bg-white/55 p-4 shadow-hard-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange">Sugerencias para ti</p>
      <ul className="mt-3 space-y-3">
        {suggestions.items.slice(0, 6).map((person) => (
          <li key={person.id} className="flex items-center gap-3">
            <button type="button" onClick={() => onOpenProfile(person.id)}><SocialAvatar author={person} size={38} /></button>
            <button type="button" onClick={() => onOpenProfile(person.id)} className="min-w-0 flex-1 text-left leading-tight">
              <span className="block truncate text-sm font-black hover:underline">{authorName(person)}</span>
              <span className="block truncate text-[11px] font-bold text-ink/50">{person.display_name && person.username ? person.display_name : plural(person.post_count, "publicación", "publicaciones")}</span>
            </button>
            <FollowButton compact active={!!suggestions.following[person.id]} onClick={() => void suggestions.toggle(person.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PostSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.6rem] border-2 border-ink/20 bg-cream" aria-hidden>
      <div className="flex items-center gap-3 p-3.5">
        <span className="h-9 w-9 animate-pulse rounded-full bg-ink/10" />
        <span className="h-3 w-32 animate-pulse rounded-full bg-ink/10" />
      </div>
      <div className="aspect-[4/5] animate-pulse bg-ink/10" />
      <div className="space-y-2 p-4">
        <span className="block h-3 w-24 animate-pulse rounded-full bg-ink/10" />
        <span className="block h-3 w-3/4 animate-pulse rounded-full bg-ink/10" />
      </div>
    </div>
  );
}

/** Lo que ve quien no ha entrado (o la app sin Supabase): un adelanto borroso y el botón para entrar. */
function LockedCommunity({ onLogin, canLogin }: { onLogin: () => void; canLogin: boolean }) {
  const photos = [PAISAJES.panama, PAISAJES.pragaPuente, PAISAJES.rialto, PAISAJES.bled, PAISAJES.alsacia, PAISAJES.budapest];
  return (
    <div className="relative overflow-hidden rounded-[2rem] border-2 border-ink shadow-hard">
      <div className="grid grid-cols-3 gap-0.5 blur-[3px] saturate-75" aria-hidden>
        {photos.map((photo) => (
          <img key={photo.slug} src={paisajeSrc(photo)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/55 p-6 text-center text-cream">
        <p className="font-display text-4xl font-black leading-[1.04]">La comunidad te espera.</p>
        <p className="max-w-sm text-sm font-semibold text-cream/80">Fotos y vídeos de la gente en cada chincheta del mapa. Sigue a viajeros y lugares, comenta y guarda lo que te inspire.</p>
        {canLogin ? (
          <button type="button" onClick={onLogin} className="mt-1 flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-5 text-sm font-black text-ink shadow-hard-sm">
            <LogIn size={16} /> Entrar para verla
          </button>
        ) : (
          <p className="text-xs font-bold text-cream/70">Disponible con la cuenta en la nube.</p>
        )}
      </div>
    </div>
  );
}

function SetupMissing() {
  return (
    <div className="rounded-[1.75rem] border-2 border-ink bg-white/65 p-6 shadow-hard-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink bg-orange shadow-hard-sm"><Database size={22} /></span>
      <p className="mt-4 font-display text-3xl font-black">La comunidad está casi lista.</p>
      <p className="mt-2 max-w-xl text-sm font-semibold leading-relaxed text-ink/65">
        Falta activar sus tablas en Supabase: ejecuta <code className="rounded bg-ink/10 px-1">docs/supabase/006_social.sql</code> y después <code className="rounded bg-ink/10 px-1">007_social_seed.sql</code> (datos de muestra) en el editor SQL.
      </p>
    </div>
  );
}

type Props = {
  meId: string | null;
  /** Hay Supabase y sesión: se puede usar la red social. */
  available: boolean;
  canLogin: boolean;
  onLogin: () => void;
  places: SocialPlace[];
  setupMissing: boolean;
  navigation: PostNavigation;
  onOpenPlace: (slug: string) => void;
  onCompose: () => void;
  onEditProfile: () => void;
};

export default function SocialFeed({ meId, available, canLogin, onLogin, places, setupMissing, navigation, onOpenPlace, onCompose, onEditProfile }: Props) {
  const [scope, setScope] = useState<FeedScope>("all");
  const [visibility, setVisibility] = useState<SocialPostVisibility | null>(null);
  // El filtro de privacidad solo existe en la pestaña propia.
  const feed = useFeed({ scope, visibility: scope === "mine" ? visibility ?? undefined : undefined }, { enabled: available });
  const suggestions = useSuggestions(available && !setupMissing && !feed.setupMissing);
  const sentinel = useRef<HTMLDivElement>(null);
  const [me, setMe] = useState<SocialProfile | null>(null);
  useInfiniteScroll(sentinel, feed.loadMore, available && !feed.done && !feed.loading && feed.posts.length > 0);

  useEffect(() => {
    const repo = getSocialRepository();
    if (!repo || !available || !meId) return;
    repo.profile(meId).then(setMe).catch(() => undefined);
  }, [available, meId]);

  const followedPlaces = places.filter((place) => place.following);
  const missing = setupMissing || feed.setupMissing;

  return (
    <section id="comunidad" className="mt-14 scroll-mt-24" aria-labelledby="comunidad-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <motion.p initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] shadow-hard-sm">
            <Sparkles size={13} className="text-orange" /> La comunidad
          </motion.p>
          <h2 id="comunidad-title" className="mt-4 font-display text-5xl font-black leading-[1.04] tracking-[-.01em] sm:text-6xl">
            Lo último desde <span className="text-orange">el mapa</span>.
          </h2>
        </div>
        {available && !missing ? (
          <button type="button" onClick={onCompose} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-5 text-sm font-black shadow-hard-sm transition-transform hover:-translate-y-0.5">
            <Plus size={17} /> Publicar
          </button>
        ) : null}
      </div>

      <div className="mt-7">
        {!available ? (
          <LockedCommunity onLogin={onLogin} canLogin={canLogin} />
        ) : missing ? (
          <SetupMissing />
        ) : (
          <>
            <PlaceStories places={places} onOpenPlace={onOpenPlace} onCompose={onCompose} />

            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="mx-auto w-full max-w-[540px]">
                <div role="tablist" aria-label="Qué ver" className="sticky top-3 z-20 mb-5 flex rounded-2xl border-2 border-ink bg-cream/95 p-1 shadow-hard-sm backdrop-blur">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = scope === tab.id;
                    return (
                      <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => setScope(tab.id)} className={`relative flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-black transition-colors ${active ? "text-ink" : "text-ink/50 hover:text-ink"}`}>
                        {active ? <motion.span layoutId="feed-tab" className="absolute inset-0 rounded-xl bg-orange" transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
                        <span className="relative flex min-w-0 items-center gap-1.5"><Icon size={14} className="shrink-0" /> <span className="max-w-[9ch] truncate sm:max-w-[14ch]">{tabLabel(tab.id, tab.label, me)}</span></span>
                      </button>
                    );
                  })}
                </div>

                {scope === "mine" ? (
                  <div className="-mt-1 mb-5 rounded-[1.4rem] border-2 border-ink bg-white/55 p-3 shadow-hard-sm">
                    <p className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-ink/60">
                      <Lock size={12} className="shrink-0" aria-hidden /> Solo tú ves esta pestaña: todo lo que has subido, público y privado.
                    </p>
                    <div role="group" aria-label="Filtrar por privacidad" className="mt-2 flex gap-1.5">
                      {VISIBILITY_FILTERS.map((filter) => {
                        const Icon = filter.icon;
                        const active = visibility === filter.id;
                        return (
                          <button key={filter.label} type="button" aria-pressed={active} onClick={() => setVisibility(filter.id)} className={`flex min-h-8 items-center gap-1 rounded-full border-2 border-ink px-3 text-[11px] font-black transition-colors ${active ? "bg-ink text-cream" : "bg-cream hover:bg-orange"}`}>
                            {Icon ? <Icon size={12} /> : null} {filter.label}
                          </button>
                        );
                      })}
                      {!me?.username ? (
                        <button type="button" onClick={onEditProfile} className="ml-auto text-[11px] font-black text-orange hover:underline">Elige tu @usuario</button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-6">
                  {feed.posts.map((post, index) => (
                    <Fragment key={post.id}>
                      {/* Solo se montan las publicaciones cercanas a la vista: lo ya visto se libera de memoria. */}
                      <FeedWindow initiallyVisible={index < 3}>
                        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.35 }}>
                          <PostCard post={post} meId={meId} {...navigation} />
                        </motion.div>
                      </FeedWindow>
                      {index === 1 && scope === "all" ? (
                        <div className="lg:hidden">
                          <SuggestionsCarousel suggestions={suggestions} onOpenProfile={navigation.onOpenProfile} />
                        </div>
                      ) : null}
                    </Fragment>
                  ))}

                  {feed.loading ? (
                    <>
                      <PostSkeleton />
                      {feed.posts.length === 0 ? <PostSkeleton /> : null}
                    </>
                  ) : null}

                  {feed.error ? (
                    <div className="rounded-2xl border-2 border-ink bg-[#f2c5a0] p-4 text-sm font-bold">
                      {feed.error}
                      <button type="button" onClick={feed.reload} className="ml-3 inline-flex items-center gap-1 underline"><RotateCcw size={13} /> Reintentar</button>
                    </div>
                  ) : null}

                  {!feed.loading && !feed.error && feed.posts.length === 0 ? (
                    <div className="rounded-[1.6rem] border-2 border-dashed border-ink/35 p-8 text-center">
                      {scope === "following" ? (
                        <>
                          <p className="font-display text-3xl font-black">Aún no sigues a nadie.</p>
                          <p className="mt-2 text-sm font-semibold text-ink/60">Sigue a viajeros o a lugares (desde su chincheta) y sus publicaciones aparecerán aquí.</p>
                        </>
                      ) : scope === "mine" ? (
                        <>
                          <p className="font-display text-3xl font-black">{visibility === "private" ? "Nada privado todavía." : visibility === "public" ? "Nada público todavía." : "Aún no has subido nada."}</p>
                          <p className="mt-2 text-sm font-semibold text-ink/60">Al publicar puedes elegir “Solo yo” para guardar recuerdos que nadie más verá.</p>
                          <button type="button" onClick={onCompose} className="mx-auto mt-4 flex min-h-10 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-4 text-sm font-black shadow-hard-sm"><Plus size={15} /> Publicar</button>
                        </>
                      ) : scope === "saved" ? (
                        <>
                          <p className="font-display text-3xl font-black">Nada guardado todavía.</p>
                          <p className="mt-2 text-sm font-semibold text-ink/60">Toca el marcador de una publicación para guardarla aquí. Solo tú ves tus guardados.</p>
                        </>
                      ) : (
                        <>
                          <p className="font-display text-3xl font-black">La comunidad está empezando.</p>
                          <p className="mt-2 text-sm font-semibold text-ink/60">Sé la primera persona en publicar un recuerdo.</p>
                        </>
                      )}
                    </div>
                  ) : null}
                  {scope === "following" && !feed.loading && feed.posts.length === 0 ? <SuggestionsCarousel suggestions={suggestions} onOpenProfile={navigation.onOpenProfile} /> : null}

                  {feed.done && feed.posts.length > 3 ? <p className="py-4 text-center text-xs font-black uppercase tracking-[0.16em] text-ink/40">✦ Estás al día ✦</p> : null}
                  <div ref={sentinel} className="h-2" />
                </div>
              </div>

              <aside className="hidden lg:block">
                <div className="sticky top-6 space-y-4">
                  {me ? (
                    <section className="flex items-center gap-3 rounded-[1.6rem] border-2 border-ink bg-cream p-4 shadow-hard-sm">
                      <button type="button" onClick={() => navigation.onOpenProfile(me.id)}><SocialAvatar author={me} size={48} /></button>
                      <div className="min-w-0 flex-1 leading-tight">
                        <button type="button" onClick={() => navigation.onOpenProfile(me.id)} className="block truncate text-sm font-black hover:underline">{authorName(me)}</button>
                        <p className="text-[11px] font-bold text-ink/50">{plural(me.follower_count, "seguidor", "seguidores")} · {me.following_count} seguidos</p>
                        {!me.username ? (
                          <button type="button" onClick={onEditProfile} className="mt-1 text-[11px] font-black text-orange hover:underline">Elige tu @usuario</button>
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                  <SidebarSuggestions suggestions={suggestions} onOpenProfile={navigation.onOpenProfile} />
                  {followedPlaces.length ? (
                    <section className="rounded-[1.6rem] border-2 border-ink bg-white/55 p-4 shadow-hard-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange">Lugares que sigues</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {followedPlaces.map((place) => (
                          <button key={place.id} type="button" onClick={() => onOpenPlace(place.slug)} className="rounded-full border-2 border-ink bg-cream px-3 py-1 text-xs font-black hover:bg-orange">{place.name}</button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  <p className="px-2 text-[10px] font-bold leading-relaxed text-ink/40">Memento Mundi · Comunidad beta. Los vídeos solo viven aquí y en el mapa.</p>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
