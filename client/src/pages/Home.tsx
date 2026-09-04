import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, Compass, Globe2, Home as HomeIcon, MapPin, QrCode, ShoppingBag, Sparkles, UserRound, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Dock, { type DockItem } from "@/components/Dock";

const trips = [
  { id: "lisboa", city: "Lisboa", country: "Portugal", title: "Postales del Atlántico", cover: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1000&q=85", unlocked: true, stamps: 7, palette: "bg-[#e7d8c2]" },
  { id: "kyoto", city: "Kyoto", country: "Japón", title: "Rituales de primavera", cover: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1000&q=85", unlocked: false, stamps: 2, palette: "bg-[#d8e2dc]" },
  { id: "oaxaca", city: "Oaxaca", country: "México", title: "Color a medianoche", cover: "https://images.unsplash.com/photo-1518638150340-f706e86654de?auto=format&fit=crop&w=1000&q=85", unlocked: true, stamps: 11, palette: "bg-[#f2c5a0]" },
];

const navLabels = ["Home", "Tienda", "Escanear", "Explorar", "Perfil"] as const;

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { data: ownedTrips, isLoading: tripsLoading, isError: tripsError, refetch: refetchTrips } = trpc.trips.mine.useQuery(undefined, { enabled: isAuthenticated });
  const unlockMutation = trpc.trips.unlockSticker.useMutation();
  const [activeNav, setActiveNav] = useState<(typeof navLabels)[number]>("Home");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [token, setToken] = useState("demo-kyoto-2026");
  const [scanError, setScanError] = useState("");
  const [selectedTrip, setSelectedTrip] = useState(trips[0]);
  const [hardwareNote, setHardwareNote] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const feedTrips = !isAuthenticated ? trips : (ownedTrips ?? []).map((trip, index) => ({ ...trips[index % trips.length], id: String(trip.id), title: trip.title, city: trip.city, country: trip.country, cover: trip.coverUrl ?? trips[index % trips.length].cover }));

  const dockItems: DockItem[] = useMemo(() => [
    { icon: <HomeIcon size={21} strokeWidth={2.6} />, label: "Home", onClick: () => { setActiveNav("Home"); setLocation("/"); } },
    { icon: <ShoppingBag size={21} strokeWidth={2.6} />, label: "Tienda", onClick: () => { setActiveNav("Tienda"); setLocation("/store"); } },
    { icon: <QrCode size={27} strokeWidth={2.3} color="#0B2130" />, label: "Escanear", accent: true, onClick: () => { setActiveNav("Escanear"); setScannerOpen(true); } },
    { icon: <Globe2 size={21} strokeWidth={2.6} />, label: "Explorar", onClick: () => { setActiveNav("Explorar"); setLocation("/explore"); } },
    { icon: <UserRound size={21} strokeWidth={2.6} />, label: "Perfil", onClick: () => { setActiveNav("Perfil"); setLocation("/profile"); } },
  ], [setLocation]);

  const submitToken = (value: string) => {
    setScanError("");
    if (value.trim().length < 8) { setScanError("Introduce un token de al menos 8 caracteres."); return; }
    if (isAuthenticated) {
      unlockMutation.mutate({ token: value.trim() }, { onSuccess: (result) => { if (result.success) { setScanComplete(true); setSelectedTrip(trips[1]); } else setScanError("No encontramos una pegatina vinculada a tu cuenta."); }, onError: () => setScanError("No pudimos validar el recuerdo. Inténtalo de nuevo.") });
      return;
    }
    setScanComplete(true);
    setSelectedTrip(trips[1]);
  };

  const handleScan = () => submitToken(token);

  const scanWithCamera = async () => {
    const BarcodeDetectorCtor = (window as Window & { BarcodeDetector?: new (options?: { formats: string[] }) => { detect: (video: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) { setHardwareNote("Tu navegador no ofrece lectura QR directa. Puedes introducir el token manualmente."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      const detect = async () => { if (!videoRef.current) return; const result = await detector.detect(videoRef.current); const value = result[0]?.rawValue; if (value) { stream.getTracks().forEach((track) => track.stop()); setToken(value); submitToken(value); } else window.requestAnimationFrame(detect); };
      detect();
    } catch { setHardwareNote("No pudimos abrir la cámara. Revisa los permisos o utiliza el token manual."); }
  };

  const scanWithNfc = async () => {
    const NDEFReaderCtor = (window as Window & { NDEFReader?: new () => { scan: () => Promise<void>; onreading?: (event: { message: { records: Array<{ data: ArrayBuffer }> } }) => void } }).NDEFReader;
    if (!NDEFReaderCtor) { setHardwareNote("Web NFC no está disponible en este dispositivo. Usa el QR o el token manual."); return; }
    try { const reader = new NDEFReaderCtor(); reader.onreading = (event) => submitToken(new TextDecoder().decode(event.message.records[0]?.data)); await reader.scan(); setHardwareNote("Acerca la pegatina NFC al teléfono."); } catch { setHardwareNote("No pudimos activar NFC. Puedes usar la cámara o el token manual."); }
  };

  return (
    <main className="min-h-screen overflow-hidden pb-28">
      <div className="mx-auto max-w-7xl px-5 pb-8 pt-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 rotate-[-7deg] items-center justify-center rounded-2xl border-2 border-ink bg-orange shadow-hard-sm">
              <span className="text-xl font-black">M</span>
            </div>
            <div>
              <p className="font-display text-lg font-black leading-none tracking-tight">memento mundi</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink/55">viaja. guarda. vuelve.</p>
            </div>
          </div>
          <button type="button" onClick={() => isAuthenticated ? (setActiveNav("Perfil"), setLocation("/profile")) : startLogin()} className="flex items-center gap-2 rounded-full border-2 border-ink bg-white/60 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition-transform hover:-translate-y-0.5 active:scale-[0.97]">
            <span className="hidden sm:inline">{user?.name?.split(" ")[0] ?? "Entrar"}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-cream"><UserRound size={15} /></span>
          </button>
        </header>

        <section className="mt-14 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] shadow-hard-sm">
              <Sparkles size={13} className="text-orange" fill="currentColor" /> Tu atlas personal
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05 }} className="max-w-3xl font-display text-5xl font-black leading-[0.9] tracking-[-0.06em] sm:text-7xl lg:text-[6.3rem]">
              El mundo<br /><span className="text-orange">te está</span><br />esperando.
            </motion.h1>
            <p className="mt-7 max-w-md text-base font-medium leading-relaxed text-ink/70 sm:text-lg">Convierte cada destino en una historia que puedes tocar. Escanea una pegatina, desbloquea un recuerdo y hazlo tuyo.</p>
            <button type="button" onClick={() => setScannerOpen(true)} className="sticker-button mt-8 inline-flex items-center gap-3 rounded-2xl border-2 border-ink bg-orange px-5 py-3.5 text-sm font-black shadow-hard transition-transform hover:-translate-y-1 active:scale-[0.97]">
              <QrCode size={19} /> Escanear un recuerdo <ArrowUpRight size={18} />
            </button>
          </div>
          <motion.div initial={{ opacity: 0, rotate: 4, scale: 0.96 }} animate={{ opacity: 1, rotate: 2, scale: 1 }} transition={{ duration: 0.6, delay: 0.12 }} className="relative mx-auto w-full max-w-md lg:mr-0">
            <div className="absolute -right-3 -top-4 z-10 rotate-[9deg] rounded-xl border-2 border-ink bg-orange px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] shadow-hard-sm">Nuevo destino</div>
            <div className="overflow-hidden rounded-[2rem] border-2 border-ink bg-[#cbd8d2] p-3 shadow-hard">
              <div className="relative overflow-hidden rounded-[1.5rem] border-2 border-ink">
                <img src={selectedTrip.cover} alt="Paisaje de viaje" className="h-[290px] w-full object-cover sm:h-[340px]" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent p-5 pt-20 text-cream">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange">{selectedTrip.country}</p>
                  <h2 className="mt-1 font-display text-3xl font-black tracking-tight">{selectedTrip.city}</h2>
                  <p className="mt-1 text-sm font-medium text-cream/80">{selectedTrip.title}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-2 pb-1 pt-4 text-xs font-bold"><span className="flex items-center gap-1.5"><MapPin size={14} /> 35.68° N, 139.69° E</span><span className="rounded-full bg-cream px-2.5 py-1 text-[10px] uppercase tracking-wider">01 / 08</span></div>
            </div>
          </motion.div>
        </section>

        <section className="mt-24">
          <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange">Tu colección</p><h2 className="mt-2 font-display text-4xl font-black tracking-[-0.04em] sm:text-5xl">Tus viajes, <span className="text-ink/35">aquí.</span></h2></div><button type="button" onClick={() => setLocation("/explore")} className="hidden items-center gap-1 text-xs font-black uppercase tracking-[0.14em] underline decoration-2 underline-offset-4 sm:flex">Ver mapa <ArrowUpRight size={15} /></button></div>
          {isAuthenticated && tripsLoading ? <div className="mt-8 rounded-[1.75rem] border-2 border-ink bg-white/60 p-8 text-center shadow-hard-sm"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange">Sincronizando tu atlas</p><p className="mt-2 font-display text-2xl font-black">Reuniendo tus recuerdos...</p></div> : isAuthenticated && tripsError ? <div role="alert" className="mt-8 rounded-[1.75rem] border-2 border-ink bg-[#f2c5a0] p-8 shadow-hard-sm"><p className="text-[10px] font-black uppercase tracking-[0.2em]">Algo se perdió en el camino</p><p className="mt-2 max-w-md font-display text-2xl font-black">No pudimos cargar tus viajes ahora mismo.</p><button type="button" onClick={() => refetchTrips()} className="mt-5 rounded-xl border-2 border-ink bg-cream px-4 py-2 text-xs font-black">Reintentar</button></div> : isAuthenticated && ownedTrips?.length === 0 ? <div className="mt-8 rounded-[1.75rem] border-2 border-dashed border-ink bg-white/40 p-8 shadow-hard-sm"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange">Primera página en blanco</p><p className="mt-2 max-w-md font-display text-2xl font-black">Todavía no tienes viajes guardados.</p><p className="mt-2 max-w-md text-sm font-medium text-ink/65">Escanea una pegatina para desbloquear tu primer scrapbook o explora nuevos destinos.</p></div> : <div className="mt-8 grid gap-5 md:grid-cols-3"><p className="sr-only" aria-live="polite">{isAuthenticated ? "Viajes sincronizados" : "Vista de demostración"}</p>{feedTrips.map((trip, index) => <motion.article key={trip.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 + 0.2 }} className={`group relative overflow-hidden rounded-[1.75rem] border-2 border-ink ${trip.palette} p-3 shadow-hard transition-transform hover:-translate-y-1`}>
              <div className="relative overflow-hidden rounded-[1.2rem] border-2 border-ink"><img src={trip.cover} alt={`Portada de ${trip.title}`} className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105" /><div className="absolute left-3 top-3 rounded-full border-2 border-ink bg-cream px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">{trip.unlocked ? "Desbloqueado" : "En espera"}</div><button type="button" aria-label={`Abrir ${trip.title}`} onClick={() => setSelectedTrip(trip)} className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-orange opacity-0 transition-opacity group-hover:opacity-100"><ArrowUpRight size={19} /></button></div>
              <div className="px-1 pb-1 pt-4"><p className="text-[10px] font-black uppercase tracking-[0.17em] text-ink/60">{trip.city} · {trip.country}</p><h3 className="mt-1 font-display text-2xl font-black tracking-tight">{trip.title}</h3><div className="mt-4 flex items-center justify-between border-t-2 border-ink/20 pt-3 text-xs font-bold"><span>{trip.stamps} recuerdos</span><span className="flex items-center gap-1">{trip.unlocked ? <Check size={14} /> : <QrCode size={14} />} {trip.unlocked ? "Abrir scrapbook" : "Escanear"}</span></div></div>
            </motion.article>)}</div>}
        </section>

        <section className="mt-16 grid gap-4 rounded-[2rem] border-2 border-ink bg-ink p-6 text-cream shadow-hard sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange">Siguiente parada</p><h2 className="mt-2 font-display text-3xl font-black tracking-tight">¿Dónde te lleva la curiosidad?</h2></div><button type="button" onClick={() => setLocation("/explore")} className="flex w-fit items-center gap-2 rounded-xl border-2 border-cream bg-orange px-4 py-3 text-sm font-black text-ink shadow-[3px_3px_0px_#EAE7DA]">Explorar destinos <Compass size={17} /></button></section>
      </div>

      <div className="fixed bottom-4 left-0 z-40 flex w-full justify-center px-4"><Dock items={dockItems} /></div>

      <AnimatePresence>{scannerOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"><motion.div initial={{ y: 30, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.97 }} className="relative w-full max-w-md rounded-[2rem] border-2 border-ink bg-cream p-5 shadow-hard sm:p-7"><button type="button" onClick={() => { setScannerOpen(false); setScanComplete(false); }} aria-label="Cerrar escáner" className="absolute right-4 top-4 rounded-full border-2 border-ink bg-white/60 p-2"><X size={18} /></button>{scanComplete ? <div className="py-8 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-ink bg-orange shadow-hard-sm"><Check size={38} /></div><p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-orange">Recuerdo desbloqueado</p><h2 className="mt-2 font-display text-4xl font-black">Kyoto te espera.</h2><p className="mx-auto mt-3 max-w-xs text-sm font-medium leading-relaxed text-ink/65">La pegatina está vinculada a tu scrapbook. Ya puedes guardar tu primer momento.</p><button type="button" onClick={() => { setScannerOpen(false); setScanComplete(false); }} className="mt-7 rounded-xl border-2 border-ink bg-ink px-5 py-3 text-sm font-black text-cream">Abrir scrapbook</button></div> : <><p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange">Escáner de recuerdos</p><h2 className="mt-2 font-display text-4xl font-black tracking-tight">Acerca tu pegatina.</h2><p className="mt-3 text-sm font-medium leading-relaxed text-ink/65">Apunta al código QR o acerca tu móvil a la etiqueta NFC para revelar el siguiente capítulo.</p><div className="relative mx-auto my-8 flex aspect-square max-w-[230px] items-center justify-center rounded-[1.75rem] border-2 border-ink bg-ink p-6 shadow-hard"><div className="absolute inset-7 rounded-xl border-2 border-orange" /><div className="absolute left-8 right-8 top-1/2 h-0.5 bg-orange shadow-[0_0_12px_#FA9223]" /><QrCode size={100} strokeWidth={1.3} className="text-cream" /></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={scanWithCamera} className="rounded-xl border-2 border-ink bg-white/70 px-3 py-2.5 text-xs font-black">Leer QR</button><button type="button" onClick={scanWithNfc} className="rounded-xl border-2 border-ink bg-white/70 px-3 py-2.5 text-xs font-black">Leer NFC</button></div><video ref={videoRef} muted playsInline className="mt-3 hidden w-full rounded-xl border-2 border-ink" /><label className="mt-4 block text-[10px] font-black uppercase tracking-[0.16em]" htmlFor="sticker-token">Token de la pegatina</label><input id="sticker-token" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Ej. lisboa-7f3a" className="mt-2 w-full rounded-xl border-2 border-ink bg-white/70 px-4 py-3 text-sm font-bold outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-orange" />{hardwareNote && <p className="mt-2 text-xs font-bold text-ink/60">{hardwareNote}</p>}{scanError && <p role="alert" className="mt-2 text-xs font-bold text-[#b33a2d]">{scanError}</p>}<button type="button" onClick={handleScan} disabled={unlockMutation.isPending} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-orange px-5 py-3.5 text-sm font-black shadow-hard-sm transition-transform active:translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{unlockMutation.isPending ? "Validando..." : "Desbloquear recuerdo"} <ArrowUpRight size={17} /></button></>}</motion.div></motion.div>}</AnimatePresence>
    </main>
  );
}
