import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Camera, Compass, Globe2, Home, MapPin, Minus, Plus, QrCode, ShoppingBag, UserRound, X } from "lucide-react";
import { useLocation } from "wouter";
import { MapView } from "@/components/Map";
import Dock, { type DockItem } from "@/components/Dock";

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

function markerContent(place: MemoryPlace, active: boolean) {
  const wrapper = document.createElement("button");
  wrapper.type = "button";
  wrapper.setAttribute("aria-label", `Abrir recuerdos de ${place.city}`);
  wrapper.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;background:transparent;border:0;padding:0;transform:translateY(-8px);transition:transform .18s ease;`;

  const pin = document.createElement("span");
  pin.style.cssText = `display:flex;align-items:center;justify-content:center;width:${active ? 42 : 34}px;height:${active ? 42 : 34}px;border:2px solid #0B2130;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);background:${place.color};box-shadow:3px 3px 0 #0B2130;transition:all .18s ease;`;
  const pinDot = document.createElement("span");
  pinDot.textContent = "✦";
  pinDot.style.cssText = "color:#0B2130;font-size:15px;font-weight:900;transform:rotate(45deg);";
  pin.appendChild(pinDot);

  const label = document.createElement("span");
  label.textContent = place.city;
  label.style.cssText = "border:2px solid #0B2130;border-radius:999px;background:#EAE7DA;color:#0B2130;padding:3px 7px;font:900 10px/1 'Space Grotesk',sans-serif;white-space:nowrap;box-shadow:2px 2px 0 #0B2130;";
  wrapper.append(pin, label);
  return wrapper;
}

function WorldMapPreview({ visible, showPlaces, onSelect }: { visible: boolean; showPlaces: boolean; onSelect: (place: MemoryPlace) => void }) {
  return (
    <div className={`absolute inset-0 overflow-hidden bg-[#b8c9c1] transition-opacity duration-300 ${visible ? "opacity-100" : "pointer-events-none opacity-0"} ${showPlaces ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!visible}>
      <svg viewBox="0 0 1000 560" className="absolute inset-0 h-full w-full" role="img" aria-label="Vista previa del mapa mundi">
        <defs>
          <pattern id="map-grid" width="70" height="70" patternUnits="userSpaceOnUse"><path d="M 70 0 L 0 0 0 70" fill="none" stroke="#0B2130" strokeOpacity=".12" strokeWidth="2" /></pattern>
        </defs>
        <rect width="1000" height="560" fill="#cbd8d2" />
        <rect width="1000" height="560" fill="url(#map-grid)" />
        <path d="M77 150 126 113 195 105 232 133 219 169 245 198 215 238 167 230 137 253 101 226 72 190Z" fill="#eae7da" stroke="#0b2130" strokeWidth="4" />
        <path d="M286 106 343 83 394 98 435 89 479 120 468 157 423 166 407 208 365 198 347 168 309 151Z" fill="#eae7da" stroke="#0b2130" strokeWidth="4" />
        <path d="M463 210 505 190 540 201 562 236 545 266 554 320 527 382 493 409 469 372 476 324 451 286Z" fill="#eae7da" stroke="#0b2130" strokeWidth="4" />
        <path d="M587 129 655 108 710 127 759 112 816 142 858 171 835 205 788 199 753 220 704 201 669 227 630 210 611 175Z" fill="#eae7da" stroke="#0b2130" strokeWidth="4" />
        <path d="M733 305 779 283 835 298 882 337 862 374 816 380 790 414 752 390 766 349Z" fill="#eae7da" stroke="#0b2130" strokeWidth="4" />
        <path d="M124 325 166 311 206 332 225 376 206 402 171 394 148 366Z" fill="#eae7da" stroke="#0b2130" strokeWidth="4" />
        <path d="M340 386 391 375 435 394 455 429 419 451 376 443Z" fill="#eae7da" stroke="#0b2130" strokeWidth="4" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center"><div className="rounded-full border-2 border-ink/15 bg-cream/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-ink/55">Vista previa del atlas</div></div>
      {showPlaces && places.map((place) => {
        const x = 500 + place.lng * 2.2;
        const y = 280 - place.lat * 2.2;
        return <button key={place.id} type="button" onClick={() => onSelect(place)} className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110" style={{ left: `${x / 10}%`, top: `${y / 5.6}%` }} aria-label={`Abrir recuerdos de ${place.city}`}><span className="flex h-9 w-9 rotate-[-45deg] items-center justify-center rounded-full rounded-bl-md border-2 border-ink shadow-hard-sm" style={{ backgroundColor: place.color }}><MapPin size={17} className="rotate-45" /></span><span className="mt-1 block rounded-full border-2 border-ink bg-cream px-2 py-0.5 text-[9px] font-black shadow-hard-sm">{place.city}</span></button>;
      })}
    </div>
  );
}

export default function ExplorePage() {
  const [, setLocation] = useLocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Array<google.maps.marker.AdvancedMarkerElement>>([]);
  const [zoom, setZoom] = useState(2.2);
  const [selected, setSelected] = useState<MemoryPlace | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const changeZoom = (delta: number) => {
    if (mapRef.current) {
      mapRef.current.setZoom(Math.max(2, Math.min(10, (mapRef.current.getZoom() ?? zoom) + delta)));
    } else {
      setZoom((current) => Math.max(2, Math.min(10, current + delta)));
    }
  };

  const selectPlace = (place: MemoryPlace) => {
    setSelected(place);
    mapRef.current?.panTo({ lat: place.lat, lng: place.lng });
    mapRef.current?.setZoom(7);
    if (!mapRef.current) setZoom(7);
  };

  const dockItems: DockItem[] = useMemo(() => [
    { icon: <Home size={21} strokeWidth={2.6} />, label: "Home", onClick: () => setLocation("/") },
    { icon: <ShoppingBag size={21} strokeWidth={2.6} />, label: "Tienda", onClick: () => setLocation("/store") },
    { icon: <QrCode size={27} strokeWidth={2.3} />, label: "Escanear", accent: true, onClick: () => setLocation("/#scan") },
    { icon: <Globe2 size={21} strokeWidth={2.6} />, label: "Explorar", onClick: () => setLocation("/explore") },
    { icon: <UserRound size={21} strokeWidth={2.6} />, label: "Perfil", onClick: () => setLocation("/profile") },
  ], [setLocation]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const showMarkers = zoom >= 4;
    markersRef.current.forEach((marker) => { marker.map = showMarkers ? map : null; });
  }, [zoom]);

  const handleMapReady = (map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
    const updateZoom = () => setZoom(map.getZoom() ?? 2.2);
    map.addListener("zoom_changed", updateZoom);
    markersRef.current = places.map((place) => {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: null,
        position: { lat: place.lat, lng: place.lng },
        title: place.city,
        content: markerContent(place, false),
      });
      marker.addListener("click", () => {
        setSelected(place);
        map.panTo({ lat: place.lat, lng: place.lng });
        map.setZoom(Math.max(map.getZoom() ?? 5, 7));
      });
      return marker;
    });
    setZoom(map.getZoom() ?? 2.2);
  };

  useEffect(() => () => {
    markersRef.current.forEach((marker) => { marker.map = null; });
    markersRef.current = [];
  }, []);

  useEffect(() => {
    markersRef.current.forEach((marker, index) => {
      marker.content = markerContent(places[index], selected?.id === places[index].id);
    });
  }, [selected]);

  return (
    <main className="min-h-screen overflow-hidden pb-28">
      <div className="mx-auto max-w-7xl px-5 pb-8 pt-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <button type="button" onClick={() => setLocation("/")} className="group flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-white/60 transition-transform group-hover:-translate-x-1"><ArrowLeft size={16} /></span>
            Volver al atlas
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-right sm:block"><span className="block text-[10px] font-black uppercase tracking-[0.18em] text-orange">Explorar</span><span className="block text-xs font-bold text-ink/60">Atlas compartido</span></span>
            <div className="flex h-11 w-11 rotate-[-7deg] items-center justify-center rounded-2xl border-2 border-ink bg-orange shadow-hard-sm"><span className="font-black">M</span></div>
          </div>
        </header>

        <section className="mt-12 grid gap-8 lg:grid-cols-[.78fr_1.22fr] lg:items-end">
          <div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] shadow-hard-sm"><Compass size={13} className="text-orange" /> Coordenadas con memoria</motion.div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .06 }} className="mt-5 max-w-xl font-display text-5xl font-black leading-[.91] tracking-[-0.07em] sm:text-7xl">El mundo tiene<br /><span className="text-orange">puntos</span> de vuelta.</motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .18 }} className="mt-6 max-w-md text-base font-medium leading-relaxed text-ink/68">Amplía el mapa para descubrir dónde viven tus recuerdos. Cada chincheta aparece cuando la historia está lo bastante cerca.</motion.p>
            <div className="mt-7 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.13em]">
              <span className="rounded-full border-2 border-ink bg-orange px-3 py-2 shadow-hard-sm">{places.length} destinos</span>
              <span className="rounded-full border-2 border-ink bg-white/55 px-3 py-2">{places.reduce((sum, place) => sum + place.memories, 0)} recuerdos</span>
              <span className="rounded-full border-2 border-ink bg-white/55 px-3 py-2">Zoom {Math.round(zoom)}×</span>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, rotate: 1, scale: .98 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ duration: .55 }} className="relative overflow-hidden rounded-[2rem] border-2 border-ink bg-[#d6dfd8] p-2 shadow-hard sm:p-3">
            <div className="absolute left-6 top-6 z-10 rounded-full border-2 border-ink bg-cream px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] shadow-hard-sm">Mapa mundi · vivo</div>
            <div className="pointer-events-none absolute bottom-5 left-6 z-20 max-w-[210px] rounded-2xl border-2 border-ink bg-ink/90 px-3 py-2 text-[10px] font-bold leading-relaxed text-cream shadow-hard-sm">{mapReady ? (zoom >= 4 ? "Chinchetas desbloqueadas: toca una ciudad." : "Amplía para revelar tus recuerdos.") : "Explora el atlas mientras termina de cargar."}</div>
            <div className="relative overflow-hidden rounded-[1.5rem] border-2 border-ink bg-[#b8c9c1]"><WorldMapPreview visible={!mapReady || zoom < 4} showPlaces={zoom >= 4} onSelect={selectPlace} /><MapView initialCenter={{ lat: 18, lng: 0 }} initialZoom={2} showControls={false} onMapReady={handleMapReady} className={`relative z-10 h-[54vh] min-h-[470px] w-full ${mapReady ? "" : "pointer-events-none"}`} /><div className="absolute bottom-5 right-5 z-20 flex flex-col overflow-hidden rounded-xl border-2 border-ink bg-cream shadow-hard-sm"><button type="button" onClick={() => changeZoom(1)} className="flex h-9 w-9 items-center justify-center border-b-2 border-ink transition-colors hover:bg-orange" aria-label="Acercar mapa"><Plus size={16} /></button><button type="button" onClick={() => changeZoom(-1)} className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-orange" aria-label="Alejar mapa"><Minus size={16} /></button></div></div>
          </motion.div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-[1.75rem] border-2 border-ink bg-ink p-5 text-cream shadow-hard sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange">Cómo leer este mapa</p><h2 className="mt-2 font-display text-3xl font-black tracking-tight">Acerca, encuentra, vuelve.</h2></div><Globe2 size={28} className="text-orange" /></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border-2 border-cream/15 bg-white/5 p-3"><p className="font-display text-2xl font-black text-orange">01</p><p className="mt-2 text-xs font-bold leading-relaxed text-cream/70">Empieza con todo el mundo a la vista.</p></div><div className="rounded-2xl border-2 border-cream/15 bg-white/5 p-3"><p className="font-display text-2xl font-black text-orange">02</p><p className="mt-2 text-xs font-bold leading-relaxed text-cream/70">Haz zoom hasta que aparezcan las chinchetas.</p></div><div className="rounded-2xl border-2 border-cream/15 bg-white/5 p-3"><p className="font-display text-2xl font-black text-orange">03</p><p className="mt-2 text-xs font-bold leading-relaxed text-cream/70">Toca una coordenada y abre su historia.</p></div></div>
          </div>
          <div className="rounded-[1.75rem] border-2 border-ink bg-white/55 p-5 shadow-hard-sm sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange">Tus coordenadas</p><h2 className="mt-2 font-display text-3xl font-black tracking-tight">Tres paradas.</h2></div><Camera size={24} /></div><div className="mt-5 space-y-2">{places.map((place) => <button key={place.id} type="button" onClick={() => { setSelected(place); mapRef.current?.panTo({ lat: place.lat, lng: place.lng }); mapRef.current?.setZoom(7); }} className="flex w-full items-center justify-between rounded-2xl border-2 border-ink bg-cream p-3 text-left transition-transform hover:-translate-y-0.5 active:scale-[.99]"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink" style={{ backgroundColor: place.color }}><MapPin size={16} /></span><span><span className="block text-sm font-black">{place.city}</span><span className="block text-[10px] font-bold uppercase tracking-wider text-ink/55">{place.memories} recuerdos · {place.country}</span></span></span><ArrowUpRight size={17} /></button>)}</div></div>
        </section>
      </div>

      <div className="fixed bottom-4 left-0 z-40 flex w-full justify-center px-4"><Dock items={dockItems} /></div>

      <AnimatePresence>{selected && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-4 backdrop-blur-sm sm:items-center"><motion.aside initial={{ y: 28, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} className="relative w-full max-w-md rounded-[2rem] border-2 border-ink bg-cream p-5 shadow-hard sm:p-7"><button type="button" onClick={() => setSelected(null)} aria-label="Cerrar recuerdo" className="absolute right-4 top-4 rounded-full border-2 border-ink bg-white/60 p-2"><X size={17} /></button><div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-ink shadow-hard-sm" style={{ backgroundColor: selected.color }}><MapPin size={28} /></div><p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-orange">Punto de vuelta · {selected.country}</p><h2 className="mt-2 font-display text-4xl font-black tracking-[-0.05em]">{selected.city}</h2><p className="mt-1 font-display text-2xl font-black text-ink/45">{selected.title}</p><p className="mt-5 text-sm font-medium leading-relaxed text-ink/70">{selected.note}</p><div className="mt-7 flex items-center justify-between border-t-2 border-ink/15 pt-4 text-xs font-black"><span>{selected.memories} recuerdos guardados</span><span className="rounded-full border-2 border-ink bg-orange px-3 py-1.5">Abrir scrapbook <ArrowUpRight size={13} className="ml-1 inline" /></span></div></motion.aside></motion.div>}</AnimatePresence>
    </main>
  );
}
