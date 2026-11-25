import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Camera, Compass, MapPin, Minus, Plus, X } from "lucide-react";
import { useLocation } from "wouter";
import AtlasMap, { type AtlasMapHandle } from "@/components/AtlasMap";
import CharacterGuide from "@/components/CharacterGuide";
import Mascot from "@/components/ui/Mascot";
import PageHero from "@/components/home/PageHero";
import PhotoMosaic from "@/components/home/PhotoMosaic";
import { PAISAJES } from "@/lib/paisajes";

type MemoryPlace = {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  memories: number;
  title: string;
  note: string;
  color: string;
};

const places: MemoryPlace[] = [
  { id: "barcelona", city: "Barcelona", country: "España", lat: 41.3874, lng: 2.1686, memories: 12, title: "Sol entre azulejos", note: "Una colección de paseos, vermuts y fachadas que guardan el sol de la ciudad.", color: "#FA9223" },
  { id: "madrid", city: "Madrid", country: "España", lat: 40.4168, lng: -3.7038, memories: 8, title: "La ciudad despierta", note: "Fotos de sobremesas largas, esquinas con historia y noches que empiezan tarde.", color: "#F2C5A0" },
  { id: "valencia", city: "Valencia", country: "España", lat: 39.4699, lng: -0.3763, memories: 6, title: "Naranja y sal", note: "Un scrapbook junto al Mediterráneo: mercados, bici y luz de última hora.", color: "#CBD8D2" },
];

export default function ExplorePage() {
  const [, setLocation] = useLocation();
  const mapRef = useRef<AtlasMapHandle>(null);
  const [zoom, setZoom] = useState(2);
  const [selected, setSelected] = useState<MemoryPlace | null>(null);
  // Si las teselas de OpenStreetMap no se descargan (sin red), lo decimos en vez de dejar el mapa gris.
  const [tilesError, setTilesError] = useState(false);

  const selectPlace = (place: MemoryPlace) => {
    setSelected(place);
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
              <span className="rounded-full border-2 border-ink bg-orange px-3 py-2 shadow-hard-sm">{places.length} destinos</span>
              <span className="rounded-full border-2 border-ink bg-white/55 px-3 py-2">{places.reduce((sum, place) => sum + place.memories, 0)} recuerdos</span>
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
          <div className="rounded-[1.75rem] border-2 border-ink bg-white/55 p-5 shadow-hard-sm sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange">Tus coordenadas</p><h2 className="mt-2 font-display text-3xl font-black tracking-tight">Tres paradas.</h2></div><Camera size={24} /></div><div className="mt-5 space-y-2">{places.map((place) => <button key={place.id} type="button" onClick={() => selectPlace(place)} className="flex w-full items-center justify-between rounded-2xl border-2 border-ink bg-cream p-3 text-left transition-transform hover:-translate-y-0.5 active:scale-[.99]"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink" style={{ backgroundColor: place.color }}><MapPin size={16} /></span><span><span className="block text-sm font-black">{place.city}</span><span className="block text-[10px] font-bold uppercase tracking-wider text-ink/55">{place.memories} recuerdos · {place.country}</span></span></span><ArrowUpRight size={17} /></button>)}</div></div>
        </section>

        <PhotoMosaic set="c" className="mt-16" />
      </div>

      <AnimatePresence>{selected && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-4 backdrop-blur-sm sm:items-center"><motion.aside initial={{ y: 28, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} className="relative w-full max-w-md rounded-[2rem] border-2 border-ink bg-cream p-5 shadow-hard sm:p-7"><button type="button" onClick={() => setSelected(null)} aria-label="Cerrar recuerdo" className="absolute right-4 top-4 rounded-full border-2 border-ink bg-white/60 p-2"><X size={17} /></button><Mascot name="11-ubicacion-pin" size="sm" /><p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-orange">Punto de vuelta · {selected.country}</p><h2 className="mt-2 font-display text-4xl font-black tracking-[-0.05em]">{selected.city}</h2><p className="mt-1 font-display text-2xl font-black text-ink/45">{selected.title}</p><p className="mt-5 text-sm font-medium leading-relaxed text-ink/70">{selected.note}</p><div className="mt-7 flex items-center justify-between border-t-2 border-ink/15 pt-4 text-xs font-black"><span>{selected.memories} recuerdos guardados</span><span className="rounded-full border-2 border-ink bg-orange px-3 py-1.5">Abrir scrapbook <ArrowUpRight size={13} className="ml-1 inline" /></span></div></motion.aside></motion.div>}</AnimatePresence>
    </main>
  );
}
