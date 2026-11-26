import { Bell, BellRing, BookOpen, Loader2, MapPin, Plus, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";
import { describeSocialError, getSocialRepository, useFeed } from "@/hooks/useSocial";
import { plural } from "@/lib/social/format";
import { placeUrl, shareLink } from "@/lib/social/share";
import { emitSocial } from "@/lib/social/sync";
import type { SocialPlace, SocialPost } from "@/lib/social/types";
import type { Scrapbook } from "@/lib/scrapbooks";
import PostGrid from "./PostGrid";
import Sheet from "./Sheet";

const KIND_LABEL = { city: "Ciudad", country: "País", region: "Región", spot: "Rincón" } as const;

type Props = {
  slug: string;
  places: SocialPlace[];
  placesLoading: boolean;
  /** Mis scrapbooks, para enlazar los de este lugar. */
  scrapbooks: Scrapbook[];
  onClose: () => void;
  onOpenPost: (post: SocialPost) => void;
  onOpenScrapbook: (id: string) => void;
  onCompose: (placeId: string) => void;
};

/**
 * Ficha de un lugar: su portada propia (no la de un scrapbook), seguir el lugar y, deslizando hacia abajo,
 * todas las fotos y vídeos que la gente ha publicado allí.
 */
export default function PlaceSheet({ slug, places, placesLoading, scrapbooks, onClose, onOpenPost, onOpenScrapbook, onCompose }: Props) {
  const place = places.find((item) => item.slug === slug) ?? null;
  const feed = useFeed({ placeId: place?.id }, { enabled: !!place, pageSize: 18 });
  const mine = place ? scrapbooks.filter((book) => place.my_scrapbook_ids?.includes(book.id)) : [];

  const toggleFollow = async () => {
    const repo = getSocialRepository();
    if (!repo || !place) return;
    const value = !place.following;
    emitSocial({ type: "place-follow", placeId: place.id, following: value });
    try {
      await repo.setFollowingPlace(place.id, value);
      if (value) toast.success(`Verás más de ${place.name} en “Siguiendo”.`);
    } catch (error) {
      emitSocial({ type: "place-follow", placeId: place.id, following: !value });
      toast.error(describeSocialError(error));
    }
  };

  const share = async () => {
    if (!place) return;
    const result = await shareLink(placeUrl(place.slug), `${place.name} en Memento Mundi`);
    if (result === "copied") toast.success("Enlace copiado.");
  };

  return (
    <Sheet label={place ? `Lugar: ${place.name}` : "Lugar"} onClose={onClose} width="xl" bleed>
      {!place ? (
        <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 p-8 text-center">
          {placesLoading ? <Loader2 className="animate-spin text-ink/40" size={26} aria-label="Cargando" /> : <p className="font-display text-3xl font-black">Este lugar no está en el mapa.</p>}
        </div>
      ) : (
        <>
          <div className="relative h-[42dvh] min-h-[260px] overflow-hidden border-b-2 border-ink bg-[#cbd8d2] sm:h-[340px]">
            {place.cover_url ? (
              <img src={place.cover_url} alt={`Portada de ${place.name}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <MapPin size={64} className="text-ink/25" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-cream sm:p-7">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-orange">
                <MapPin size={12} aria-hidden /> {KIND_LABEL[place.kind]} · {place.country}
              </p>
              <h2 className="mt-1 break-words font-display text-5xl font-black leading-[1.04] tracking-[-.01em] sm:text-6xl">{place.name}</h2>
              <p className="mt-2 text-xs font-black text-cream/80">
                {plural(place.post_count, "publicación", "publicaciones")} · {plural(place.follower_count, "seguidor", "seguidores")}
              </p>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void toggleFollow()} aria-pressed={place.following} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-ink px-4 text-sm font-black shadow-hard-sm transition-colors sm:flex-none ${place.following ? "bg-cream hover:bg-white" : "bg-orange hover:bg-ink hover:text-cream"}`}>
                {place.following ? <BellRing size={16} /> : <Bell size={16} />} {place.following ? "Siguiendo" : "Seguir lugar"}
              </button>
              <button type="button" onClick={() => onCompose(place.id)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-ink px-4 text-sm font-black text-cream shadow-hard-sm transition-colors hover:bg-orange hover:text-ink sm:flex-none">
                <Plus size={16} /> Publicar aquí
              </button>
              <button type="button" onClick={() => void share()} aria-label={`Compartir ${place.name}`} className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-ink bg-cream shadow-hard-sm hover:bg-white">
                <Share2 size={16} />
              </button>
            </div>

            {mine.length ? (
              <div className="rounded-2xl border-2 border-ink bg-white/55 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/55">Tus scrapbooks aquí</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {mine.map((book) => (
                    <button key={book.id} type="button" onClick={() => onOpenScrapbook(book.id)} className="flex items-center gap-2 rounded-full border-2 border-ink bg-cream py-1 pl-1 pr-3 text-xs font-black transition-colors hover:bg-orange">
                      <img src={book.cover} alt="" className="h-7 w-7 rounded-full border-2 border-ink object-cover" />
                      {book.title}
                      <BookOpen size={13} aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="flex items-start gap-2 rounded-2xl border-2 border-dashed border-ink/25 p-3 text-xs font-semibold leading-relaxed text-ink/60">
              <QrCode size={16} className="mt-0.5 shrink-0" aria-hidden /> Pronto: escanea el QR de este sitio, haz o sube una foto y aparecerá aquí y en la librería de tu scrapbook.
            </p>

            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-orange">Lo que ha visto la gente en {place.name}</p>
              <div className="-mx-4 sm:mx-0 sm:overflow-hidden sm:rounded-2xl sm:border-2 sm:border-ink">
                <PostGrid
                  posts={feed.posts}
                  loading={feed.loading}
                  done={feed.done}
                  error={feed.error}
                  onLoadMore={feed.loadMore}
                  onOpen={onOpenPost}
                  emptyTitle={`Nadie ha publicado en ${place.name} todavía.`}
                  emptyBody="Sé la primera persona en dejar aquí una foto o un vídeo."
                />
              </div>
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
