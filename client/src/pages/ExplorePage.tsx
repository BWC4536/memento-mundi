import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowLeft, Compass, Minus, Plus } from "lucide-react";
import { useLocation } from "wouter";
import AtlasMap, { type AtlasMapHandle, type AtlasPlace } from "@/components/AtlasMap";
import CharacterGuide from "@/components/CharacterGuide";
import Mascot from "@/components/ui/Mascot";
import PageHero from "@/components/home/PageHero";
import CommentsSheet from "@/components/social/CommentsSheet";
import ComposerSheet from "@/components/social/ComposerSheet";
import FriendsSheet from "@/components/social/FriendsSheet";
import PlaceSheet from "@/components/social/PlaceSheet";
import PostSheet from "@/components/social/PostSheet";
import ProfileSheet from "@/components/social/ProfileSheet";
import SocialFeed from "@/components/social/SocialFeed";
import type { PostNavigation } from "@/components/social/PostCard";
import { useSharedScrapbookLibrary } from "@/contexts/ScrapbookLibraryContext";
import { useAppAuth } from "@/hooks/useAppAuth";
import { getSocialRepository, useSocialPlaces } from "@/hooks/useSocial";
import { PAISAJES } from "@/lib/paisajes";
import { scrapbooksToPlaces } from "@/lib/scrapbook-map";
import type { ConnectionKind, SocialPost } from "@/lib/social/types";

/** Fichas con URL propia (compartibles): /explore/lugar/:slug, /explore/u/:id, /explore/p/:id y /explore/amigos/:lista. */
type ExploreProps = { kind?: string; id?: string };

const PLACE_PIN = "place:";
const SCRAPBOOK_PIN = "sb:";
/** Marca las entradas del historial abiertas desde la propia página, para cerrar con "atrás". */
const IN_APP = { exploreSheet: true };
/** Lista de conexiones <-> segmento de la URL de "Buscar amigos". */
const FRIEND_SLUGS: Record<ConnectionKind, string> = { friends: "amigos", followers: "seguidores", following: "seguidos" };
const friendsTabFromSlug = (slug?: string): ConnectionKind => (Object.entries(FRIEND_SLUGS).find(([, value]) => value === slug)?.[0] as ConnectionKind | undefined) ?? "friends";

export default function ExplorePage({ kind, id }: ExploreProps) {
  const [, setLocation] = useLocation();
  const auth = useAppAuth();
  const library = useSharedScrapbookLibrary();
  const mapRef = useRef<AtlasMapHandle>(null);
  const [zoom, setZoom] = useState(2);
  // Si las teselas de OpenStreetMap no se descargan (sin red), lo decimos en vez de dejar el mapa gris.
  const [tilesError, setTilesError] = useState(false);
  const [commentsFor, setCommentsFor] = useState<SocialPost | null>(null);
  const [composer, setComposer] = useState<{ placeId: string | null } | null>(null);

  const meId = auth.user?.id ?? null;
  const available = !!getSocialRepository() && auth.provider === "supabase" && auth.isAuthenticated;
  const social = useSocialPlaces(available);

  // Chinchetas: los lugares de la comunidad + mis scrapbooks con ubicación que aún no pertenecen a ningún lugar.
  const pins = useMemo<AtlasPlace[]>(() => {
    const linked = new Set(social.places.flatMap((place) => place.my_scrapbook_ids ?? []));
    const placePins = social.places.map((place) => ({
      id: `${PLACE_PIN}${place.slug}`,
      city: place.name,
      lat: place.lat,
      lng: place.lng,
      color: place.following ? "#FA9223" : place.my_scrapbook_ids?.length ? "#F6D27A" : "#F2C5A0",
    }));
    const scrapbookPins = scrapbooksToPlaces(library.scrapbooks.filter((book) => !linked.has(book.id))).map((place) => ({ ...place, id: `${SCRAPBOOK_PIN}${place.id}` }));
    return [...placePins, ...scrapbookPins];
  }, [library.scrapbooks, social.places]);
  const totalPosts = social.places.reduce((sum, place) => sum + place.post_count, 0);

  const open = useCallback((path: string) => setLocation(path, { state: IN_APP }), [setLocation]);
  const closeSheet = useCallback(() => {
    const state = window.history.state as { exploreSheet?: boolean } | null;
    if (state?.exploreSheet) window.history.back();
    else setLocation("/explore", { replace: true });
  }, [setLocation]);

  const openPlace = useCallback(
    (slug: string) => {
      const place = social.places.find((item) => item.slug === slug);
      if (place) mapRef.current?.flyToPlace(`${PLACE_PIN}${slug}`, 6);
      open(`/explore/lugar/${encodeURIComponent(slug)}`);
    },
    [open, social.places],
  );

  const navigation: PostNavigation = useMemo(
    () => ({
      onOpenPlace: openPlace,
      onOpenProfile: (userId: string) => open(`/explore/u/${encodeURIComponent(userId)}`),
      onOpenComments: (post: SocialPost) => setCommentsFor(post),
    }),
    [open, openPlace],
  );
  const openFriends = useCallback((tab: ConnectionKind = "friends") => open(`/explore/amigos/${FRIEND_SLUGS[tab]}`), [open]);
  const openPost = (post: SocialPost) => open(`/explore/p/${encodeURIComponent(post.id)}`);
  const openScrapbook = (scrapbookId: string) => setLocation(`/?scrapbook=${encodeURIComponent(scrapbookId)}`);

  const selectedPin = kind === "lugar" && id ? `${PLACE_PIN}${id}` : null;

  return (
    <main className="min-h-screen overflow-x-hidden pb-32">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-8 sm:pt-28 lg:px-12">
        <header className="flex items-center justify-end">
          <button type="button" onClick={() => setLocation("/")} className="group flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-white/60 transition-transform group-hover:-translate-x-1"><ArrowLeft size={16} /></span>
            Volver a casa
          </button>
        </header>

        <PageHero className="mt-6 sm:mt-8" photo={PAISAJES.bled} eyebrow="Atlas compartido" title={<>El mundo tiene<br /><span className="text-orange">puntos</span> de vuelta.</>} priority>
          Cada chincheta es un sitio al que prometimos volver.
        </PageHero>

        <section className="mt-10 grid gap-8 sm:mt-14 lg:grid-cols-[.78fr_1.22fr] lg:items-end">
          <div className="min-w-0">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] shadow-hard-sm"><Compass size={13} className="text-orange" /> Coordenadas con memoria</motion.div>
            <motion.h2 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="mt-5 max-w-xl break-words font-display text-5xl font-black leading-[1.04] tracking-[-.01em] sm:text-6xl">Toca una chincheta,<br /><span className="text-orange">mira</span> quién estuvo.</motion.h2>
            <div className="mt-6">
              <CharacterGuide character="miriam" speech="Cada chincheta guarda las fotos y vídeos de toda la gente que pasó por allí." subtext="Acerca el mapa para que aparezcan." />
            </div>
            <div className="mt-7 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.13em]">
              <span className="rounded-full border-2 border-ink bg-orange px-3 py-2 shadow-hard-sm">{pins.length} {pins.length === 1 ? "lugar" : "lugares"}</span>
              <span className="rounded-full border-2 border-ink bg-white/55 px-3 py-2">{totalPosts} {totalPosts === 1 ? "publicación" : "publicaciones"}</span>
              <span className="rounded-full border-2 border-ink bg-white/55 px-3 py-2">Zoom {Math.round(zoom)}×</span>
            </div>
            <a href="#comunidad" className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] hover:text-orange">
              <ArrowDown size={15} className="animate-bounce" /> Baja para ver la comunidad
            </a>
          </div>

          <motion.div initial={{ opacity: 0, rotate: 1, scale: 0.98 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ duration: 0.55 }} className="relative overflow-hidden rounded-[2rem] border-2 border-ink bg-[#d6dfd8] p-2 shadow-hard sm:p-3">
            <div className="absolute left-6 top-6 z-10 rounded-full border-2 border-ink bg-cream px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] shadow-hard-sm">Mapa mundi · vivo</div>
            <div className="pointer-events-none absolute right-4 top-3 z-20 sm:right-5 sm:top-4"><Mascot name="10-mapa-explorar" size="sm" tilt={4} className="!w-20 sm:!w-28" priority /></div>
            <div className="pointer-events-none absolute bottom-5 left-6 z-20 max-w-[210px] rounded-2xl border-2 border-ink bg-ink/90 px-3 py-2 text-[10px] font-bold leading-relaxed text-cream shadow-hard-sm">
              {tilesError ? "No se pudo descargar el mapa. Revisa tu conexión: los lugares siguen abajo, en la comunidad." : zoom >= 4 ? "Chinchetas desbloqueadas: toca un lugar." : "Amplía para revelar las chinchetas."}
            </div>
            <div className="relative overflow-hidden rounded-[1.5rem] border-2 border-ink bg-[#cbd8d2]">
              <AtlasMap
                ref={mapRef}
                places={pins}
                selectedId={selectedPin}
                onSelect={(pinId) => {
                  if (pinId.startsWith(PLACE_PIN)) openPlace(pinId.slice(PLACE_PIN.length));
                  else if (pinId.startsWith(SCRAPBOOK_PIN)) openScrapbook(pinId.slice(SCRAPBOOK_PIN.length));
                }}
                onZoomChange={setZoom}
                onTilesError={() => setTilesError(true)}
                className="relative z-0 h-[52vh] min-h-[320px] w-full touch-none sm:min-h-[470px]"
              />
              <div className="absolute bottom-5 right-5 z-20 flex flex-col overflow-hidden rounded-xl border-2 border-ink bg-cream shadow-hard-sm">
                <button type="button" onClick={() => mapRef.current?.zoomBy(1)} className="flex h-11 w-11 items-center justify-center border-b-2 border-ink transition-colors hover:bg-orange" aria-label="Acercar mapa"><Plus size={16} /></button>
                <button type="button" onClick={() => mapRef.current?.zoomBy(-1)} className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-orange" aria-label="Alejar mapa"><Minus size={16} /></button>
              </div>
            </div>
          </motion.div>
        </section>

        <SocialFeed
          meId={meId}
          available={available}
          canLogin={auth.provider === "supabase" && !!getSocialRepository()}
          onLogin={auth.openLogin}
          places={social.places}
          setupMissing={social.setupMissing}
          navigation={navigation}
          onOpenPlace={openPlace}
          onCompose={() => setComposer({ placeId: null })}
          onEditProfile={() => setLocation("/perfil")}
          onFindFriends={openFriends}
        />
      </div>

      {available ? (
        <>
          <AnimatePresence>
            {kind === "lugar" && id ? (
              <PlaceSheet
                key={`lugar-${id}`}
                slug={id}
                places={social.places}
                placesLoading={social.loading}
                scrapbooks={library.scrapbooks}
                onClose={closeSheet}
                onOpenPost={openPost}
                onOpenScrapbook={openScrapbook}
                onCompose={(placeId) => setComposer({ placeId })}
              />
            ) : kind === "u" && id ? (
              <ProfileSheet key={`u-${id}`} userId={id} meId={meId} onClose={closeSheet} onOpenPost={openPost} onEditProfile={() => setLocation("/perfil")} onOpenConnections={openFriends} />
            ) : kind === "amigos" ? (
              <FriendsSheet key="amigos" meId={meId} initialTab={friendsTabFromSlug(id)} onClose={closeSheet} onOpenProfile={navigation.onOpenProfile} />
            ) : kind === "p" && id ? (
              <PostSheet key={`p-${id}`} postId={id} meId={meId} onClose={closeSheet} {...navigation} />
            ) : null}
          </AnimatePresence>
          <AnimatePresence>
            {commentsFor ? <CommentsSheet key={commentsFor.id} post={commentsFor} meId={meId} onClose={() => setCommentsFor(null)} onOpenProfile={(userId) => { setCommentsFor(null); navigation.onOpenProfile(userId); }} /> : null}
          </AnimatePresence>
          <AnimatePresence>
            {composer ? <ComposerSheet places={social.places} defaultPlaceId={composer.placeId} onClose={() => setComposer(null)} /> : null}
          </AnimatePresence>
        </>
      ) : null}
    </main>
  );
}
