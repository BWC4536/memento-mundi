import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Camera, Compass, Globe, Lock, MapPin, Minus, Plus, QrCode, X } from "lucide-react";
import { useLocation } from "wouter";
import AtlasMap, { type AtlasMapHandle } from "@/components/AtlasMap";
import CharacterGuide from "@/components/CharacterGuide";
import Mascot from "@/components/ui/Mascot";
import PageHero from "@/components/home/PageHero";
import PhotoMosaic from "@/components/home/PhotoMosaic";
import { countScrapbookItems } from "@/components/ScrapbookCard";
import { useSharedScrapbookLibrary } from "@/contexts/ScrapbookLibraryContext";
import { useAppAuth } from "@/hooks/useAppAuth";
import { PAISAJES } from "@/lib/paisajes";
import { scrapbooksToPlaces, type ScrapbookPlace } from "@/lib/scrapbook-map";
import type { Scrapbook } from "@/lib/scrapbooks";

export default function ExplorePage() {
  const [, setLocation] = useLocation();
  const auth = useAppAuth();
  const library = useSharedScrapbookLibrary();
  const { listPublicScrapbooks } = library;
  const mapRef = useRef<AtlasMapHandle>(null);
  const [zoom, setZoom] = useState(2);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Si las teselas de OpenStreetMap no se descargan (sin red), lo decimos en vez de dejar el mapa gris.
  const [tilesError, setTilesError] = useState(false);
  // Scrapbooks públicos de otros viajeros (solo con sesión de Supabase).
  const [publicBooks, setPublicBooks] = useState<Scrapbook[]>([]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    listPublicScrapbooks()
      .then((books) => {
        if (!cancelled) setPublicBooks(books);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, listPublicScrapbooks]);

  const places = useMemo(() => scrapbooksToPlaces(library.scrapbooks, publicBooks), [library.scrapbooks, publicBooks]);
  const selected = places.find((place) => place.id === selectedId) ?? null;
  const totalItems = places.reduce((sum, place) => sum + countScrapbookItems(place.book), 0);

  const selectPlace = (place: ScrapbookPlace) => {
    setSelectedId(place.id);
    mapRef.current?.flyToPlace(place.id, 7);
  };

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
            <motion.h2 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .06 }} className="mt-5 max-w-xl break-words font-display text-5xl font-black leading-[.91] tracking-[-0.07em] sm:text-6xl">El mundo tiene<br /><span className="text-orange">puntos</span> de vuelta.</motion.h2>
            {/* Miriam acompañando el texto grande */}
            <div className="mt-6">
              <CharacterGuide
                character="miriam"
                speech="Haz zoom sobre el mapa: cada chincheta es un sitio al que prometimos volver."
                subtext="Tus coordenadas aparecen al acercarte."
              />
            </div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .18 }} className="mt-6 max-w-md text-base font-medium leading-relaxed text-ink/68">Amplía el mapa para descubrir dónde viven tus recuerdos. Cada chincheta aparece cuando la historia está lo bastante cerca.</motion.p>
            <div className="mt-7 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.13em]">
              <span className="rounded-full border-2 border-ink bg-orange px-3 py-2 shadow-hard-sm">{places.length} {places.length === 1 ? "destino" : "destinos"}</span>
              <span className="rounded-full border-2 border-ink bg-white/55 px-3 py-2">{totalItems} recuerdos</span>
              <span className="rounded-full border-2 border-ink bg-white/55 px-3 py-2">Zoom {Math.round(zoom)}×</span>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, rotate: 1, scale: .98 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ duration: .55 }} className="relative overflow-hidden rounded-[2rem] border-2 border-ink bg-[#d6dfd8] p-2 shadow-hard sm:p-3">
            <div className="absolute left-6 top-6 z-10 rounded-full border-2 border-ink bg-cream px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] shadow-hard-sm">Mapa mundi · vivo</div><div className="pointer-events-none absolute right-4 top-3 z-20 sm:right-5 sm:top-4"><Mascot name="10-mapa-explorar" size="sm" tilt={4} className="!w-20 sm:!w-28" priority /></div>
            <div className="pointer-events-none absolute bottom-5 left-6 z-20 max-w-[210px] rounded-2xl border-2 border-ink bg-ink/90 px-3 py-2 text-[10px] font-bold leading-relaxed text-cream shadow-hard-sm">{tilesError ? "No se pudo descargar el mapa. Revisa tu conexión: la lista de coordenadas sigue disponible." : zoom >= 4 ? "Chinchetas desbloqueadas: toca una ciudad." : "Amplía para revelar tus recuerdos."}</div>
            <div className="relative overflow-hidden rounded-[1.5rem] border-2 border-ink bg-[#cbd8d2]"><AtlasMap ref={mapRef} places={places} selectedId={selected?.id} onSelect={(id) => { const place = places.find((item) => item.id === id); if (place) selectPlace(place); }} onZoomChange={setZoom} onTilesError={() => setTilesError(true)} className="relative z-0 h-[52vh] min-h-[320px] w-full touch-none sm:min-h-[470px]" /><div className="absolute bottom-5 right-5 z-20 flex flex-col overflow-hidden rounded-xl border-2 border-ink bg-cream shadow-hard-sm"><button type="button" onClick={() => mapRef.current?.zoomBy(1)} className="flex h-11 w-11 items-center justify-center border-b-2 border-ink transition-colors hover:bg-orange" aria-label="Acercar mapa"><Plus size={16} /></button><button type="button" onClick={() => mapRef.current?.zoomBy(-1)} className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-orange" aria-label="Alejar mapa"><Minus size={16} /></button></div></div>
          </motion.div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-[1.75rem] border-2 border-ink bg-ink p-5 text-cream shadow-hard sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange">Cómo leer este mapa</p><h2 className="mt-2 font-display text-3xl font-black tracking-tight">Acerca, encuentra, vuelve.</h2></div><Mascot name="08-globo-terraqueo" size="sm" className="!w-20 shrink-0" /></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border-2 border-cream/15 bg-white/5 p-3"><p className="font-display text-2xl font-black text-orange">01</p><p className="mt-2 text-xs font-bold leading-relaxed text-cream/70">Empieza con todo el mundo a la vista.</p></div><div className="rounded-2xl border-2 border-cream/15 bg-white/5 p-3"><p className="font-display text-2xl font-black text-orange">02</p><p className="mt-2 text-xs font-bold leading-relaxed text-cream/70">Haz zoom hasta que aparezcan las chinchetas.</p></div><div className="rounded-2xl border-2 border-cream/15 bg-white/5 p-3"><p className="font-display text-2xl font-black text-orange">03</p><p className="mt-2 text-xs font-bold leading-relaxed text-cream/70">Toca una coordenada y abre su historia.</p></div></div>
          </div>
          <div className="rounded-[1.75rem] border-2 border-ink bg-white/55 p-5 shadow-hard-sm sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange">Tus coordenadas</p><h2 className="mt-2 font-display text-3xl font-black tracking-tight">{places.length === 0 ? "Sin paradas aún." : places.length === 1 ? "Una parada." : `${places.length} paradas.`}</h2></div><Camera size={24} /></div><div className="mt-5 space-y-2">{places.length === 0 ? <p className="rounded-2xl border-2 border-dashed border-ink/30 p-4 text-sm font-semibold text-ink/60">{auth.isAuthenticated ? "Cuando un scrapbook tenga ubicación, aparecerá aquí su chincheta." : "Entra para ver las chinchetas de tus scrapbooks."}</p> : places.map((place) => <button key={place.id} type="button" onClick={() => selectPlace(place)} className="flex w-full items-center justify-between rounded-2xl border-2 border-ink bg-cream p-3 text-left transition-transform hover:-translate-y-0.5 active:scale-[.99]"><span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink" style={{ backgroundColor: place.color }}><MapPin size={16} /></span><span className="min-w-0"><span className="block truncate text-sm font-black">{place.book.title}</span><span className="block truncate text-[10px] font-bold uppercase tracking-wider text-ink/55">{countScrapbookItems(place.book)} recuerdos · {place.book.location}</span></span></span><span className="flex shrink-0 items-center gap-2">{place.book.isPublic === false ? <Lock size={14} aria-label="Privado" /> : null}<ArrowUpRight size={17} /></span></button>)}</div></div>
        </section>

        <PhotoMosaic set="c" className="mt-16" />
      </div>

      <AnimatePresence>{selected && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedId(null)} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-4 backdrop-blur-sm sm:items-center"><motion.aside initial={{ y: 28, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} onClick={(event) => event.stopPropagation()} className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[2rem] border-2 border-ink bg-cream p-5 shadow-hard sm:p-7"><button type="button" onClick={() => setSelectedId(null)} aria-label="Cerrar recuerdo" className="absolute right-4 top-4 z-10 rounded-full border-2 border-ink bg-white/80 p-2"><X size={17} /></button>
        <div className="aspect-[4/3] overflow-hidden rounded-[1.25rem] border-2 border-ink bg-[#EAE7DA]"><img src={selected.book.cover} alt={`Portada de ${selected.book.title}`} className="h-full w-full object-cover" /></div>
        <p className="mt-5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-orange"><MapPin size={12} aria-hidden /> Punto de vuelta · {selected.country}</p>
        <h2 className="mt-2 break-words font-display text-4xl font-black tracking-[-0.05em]">{selected.book.title}</h2>
        <p className="mt-1 text-sm font-bold text-ink/55">{selected.book.location}</p>
        {selected.book.description ? <p className="mt-4 text-sm font-medium leading-relaxed text-ink/70">{selected.book.description}</p> : null}
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]">{selected.book.isPublic === false ? <><Lock size={12} aria-hidden /> Privado · solo lo ves tú</> : <><Globe size={12} aria-hidden /> Público</>}</span>
        <p className="mt-4 flex items-start gap-2 rounded-2xl border-2 border-dashed border-ink/30 p-3 text-xs font-semibold leading-relaxed text-ink/60"><QrCode size={16} className="mt-0.5 shrink-0" aria-hidden /> Pronto: escanea el QR de este sitio, haz o sube una foto y aparecerá en esta chincheta y en la librería del scrapbook.</p>
        <div className="mt-5 flex items-center justify-between gap-3 border-t-2 border-ink/15 pt-4 text-xs font-black"><span>{countScrapbookItems(selected.book)} recuerdos guardados</span>{selected.mine ? <button type="button" onClick={() => setLocation(`/?scrapbook=${encodeURIComponent(selected.id)}`)} className="shrink-0 rounded-full border-2 border-ink bg-orange px-3 py-1.5 transition-transform hover:-translate-y-0.5">Abrir scrapbook <ArrowUpRight size={13} className="ml-1 inline" /></button> : <span className="shrink-0 rounded-full border-2 border-ink/30 px-3 py-1.5 text-ink/50">De otro viajero</span>}</div>
      </motion.aside></motion.div>}</AnimatePresence>
    </main>
  );
}
