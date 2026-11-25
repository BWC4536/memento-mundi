import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CloudOff, FilePlus2, Loader2, LogOut, Pencil, Plus, RotateCcw, Search, Share2, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { HOME_EVENT, SCAN_EVENT } from "@/components/NavigationDock";
import CharacterGuide from "@/components/CharacterGuide";
import Mascot from "@/components/ui/Mascot";
import QrScannerDialog from "@/components/QrScannerDialog";
import ScrapbookPhotoView from "@/components/ScrapbookPhotoView";
import ScrapbookCard, { scrapbookGridVariants } from "@/components/ScrapbookCard";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useSharedScrapbookLibrary } from "@/contexts/ScrapbookLibraryContext";
import { getScrapbookComposition } from "@/lib/scrapbook-library";
import type { Scrapbook } from "@/lib/scrapbooks";
import EmptyState from "@/components/ui/EmptyState";
import Landing from "@/components/home/Landing";
import PaisajePhoto, { PhotoTag } from "@/components/home/PaisajePhoto";
import { RecuerdaMementoBlock, ViveMundiBlock } from "@/components/home/HomeShowcase";
import PhotoMosaic from "@/components/home/PhotoMosaic";
import { PAISAJES } from "@/lib/paisajes";

type Modal = "create" | "share" | "invite" | "scan" | null;

/** El editor vive en su propia ruta: /scrapbooks/:id. */
const editorPath = (id: string) => `/scrapbooks/${encodeURIComponent(id)}`;

function BrandHeader({ userName, onProfile, onSignOut }: { userName?: string | null; onProfile: () => void; onSignOut?: () => void }) {
  return <header className="flex items-center justify-end gap-2">{onSignOut ? <button type="button" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión" className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-white/60 transition-transform hover:-translate-y-0.5"><LogOut size={16} /></button> : null}<button type="button" onClick={onProfile} className="flex items-center gap-2 rounded-full border-2 border-ink bg-white/60 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition-transform hover:-translate-y-0.5 active:scale-[.97]"><span className="hidden sm:inline">{userName?.split(" ")[0] ?? "Entrar"}</span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-cream"><UserRound size={15} /></span></button></header>;
}

function QuickMenu({ onClose, onShare, onInvite, onEdit, onDelete }: { onClose: () => void; onShare: () => void; onInvite: () => void; onEdit: () => void; onDelete: () => void }) {
  return <motion.div initial={{ opacity: 0, scale: .95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="absolute right-3 top-12 z-30 w-52 rounded-2xl border-2 border-ink bg-cream p-2 shadow-hard" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => { onShare(); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-black hover:bg-orange"><Share2 size={16} /> Compartir scrapbook</button><button type="button" onClick={() => { onInvite(); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-black hover:bg-orange"><Plus size={17} /> Añadir gente</button><button type="button" onClick={() => { onEdit(); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-black hover:bg-orange"><Pencil size={16} /> Editar scrapbook</button><div className="my-1 border-t-2 border-ink/10" /><button type="button" onClick={() => { onDelete(); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-black text-[#b44728] hover:bg-[#f2c5a0]"><Trash2 size={16} /> Borrar scrapbook</button></motion.div>;
}

function Dialog({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"><motion.div initial={{ y: 25, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 15, scale: .97 }} className={`relative max-h-[92vh] w-full overflow-y-auto rounded-[2rem] border-2 border-ink bg-cream p-5 shadow-hard sm:p-7 ${wide ? "max-w-3xl" : "max-w-md"}`}><button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 z-10 rounded-full border-2 border-ink bg-white/70 p-2 transition-transform hover:rotate-90"><X size={17} /></button>{children}</motion.div></motion.div>;
}

export default function Home() {
  const auth = useAppAuth();
  const { user, isAuthenticated } = auth;
  const [, setLocation] = useLocation();
  // Estado compartido: los scrapbooks (con su composición) viven aquí (Supabase o local), no en el editor.
  const library = useSharedScrapbookLibrary();
  const { scrapbooks } = library;
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Scrapbook | null>(null);
  // Guardamos el id, no una copia: así la vista previa siempre lee la composición actualizada.
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("scrapbook") ?? (params.has("preview") ? "algarve-2026" : null);
  });
  const [menu, setMenu] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [activeTab, setActiveTab] = useState("Todos");
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const filtered = useMemo(() => scrapbooks.filter((book) => `${book.title} ${book.location}`.toLowerCase().includes(search.toLowerCase()) && (activeTab === "Todos" || book.country === activeTab)), [activeTab, search, scrapbooks]);
  const selected = scrapbooks.find((book) => book.id === selectedId) ?? null;
  const setSelected = (book: Scrapbook | null) => setSelectedId(book?.id ?? null);
  const compositionStatus = selected ? library.compositionStatus(selected.id) : "ready";
  const selectedComposition = useMemo(() => (selected && (selected.composition || compositionStatus === "ready") ? getScrapbookComposition(selected) : null), [selected, compositionStatus]);
  const { ensureComposition } = library;

  useEffect(() => {
    if (selectedId) void ensureComposition(selectedId);
  }, [ensureComposition, selectedId]);

  const deleteScrapbook = async (id: string) => {
    try {
      await library.deleteScrapbook(id);
    } catch {
      toast.error("No se pudo borrar el scrapbook. Inténtalo de nuevo.");
    }
  };

  // El dock global (App) abre el escáner aquí: por evento si ya estamos en "/", o con ?scan=1 si venimos de otra ruta.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("scan") === "1") {
      setModal("scan");
      params.delete("scan");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
    const openScan = () => setModal("scan");
    const goHome = () => { setSelected(null); setModal(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
    window.addEventListener(SCAN_EVENT, openScan);
    window.addEventListener(HOME_EVENT, goHome);
    return () => {
      window.removeEventListener(SCAN_EVENT, openScan);
      window.removeEventListener(HOME_EVENT, goHome);
    };
  }, []);

  const addScrapbook = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const created = await library.createScrapbook(newTitle, newDescription);
      setNewTitle("");
      setNewDescription("");
      setModal(null);
      setSelected(created);
    } catch {
      toast.error("No se pudo crear el scrapbook. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setCreating(false);
    }
  };

  if (auth.loading) return (
    <main className="flex min-h-screen items-center justify-center bg-[#EAE7DA]" aria-busy="true">
      <Loader2 className="animate-spin text-ink/50" size={28} aria-label="Cargando" />
    </main>
  );

  if (!isAuthenticated) return (
    <>
      <Landing header={<BrandHeader userName={undefined} onProfile={() => auth.openLogin()} />} onStore={() => setLocation("/store")} onLogin={() => auth.openLogin()} />
      {modal === "scan" && <QrScannerDialog onClose={() => setModal(null)} onDetected={() => { setModal(null); auth.openLogin(); }} />}
    </>
  );

  if (selected && !selectedComposition) return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center" aria-busy={compositionStatus === "loading"}>
      {compositionStatus === "error" ? (
        <>
          <Mascot name="24-offline-sin-wifi" size="md" mobileSize="sm" decorative={false} alt="Sin conexión con el servidor" />
          <p className="font-display text-3xl">No se pudo abrir “{selected.title}”.</p>
          <p className="max-w-sm text-sm font-semibold text-ink/60">Revisa tu conexión e inténtalo de nuevo.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => void ensureComposition(selected.id, true)} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-4 text-sm font-black shadow-hard-sm"><RotateCcw size={16} /> Reintentar</button>
            <button type="button" onClick={() => setSelected(null)} className="min-h-11 rounded-xl border-2 border-ink bg-white/70 px-4 text-sm font-black">Volver</button>
          </div>
        </>
      ) : (
        <>
          <Mascot name="22-cargando-reloj" size="md" mobileSize="sm" decorative={false} alt="Cargando" />
          <p className="text-sm font-black uppercase tracking-[.16em] text-ink/60">Abriendo “{selected.title}”…</p>
        </>
      )}
    </main>
  );

  if (selected && selectedComposition) return (
    <>
      <ScrapbookPhotoView
        key={selected.id}
        scrapbook={selected}
        composition={selectedComposition}
        initialFullscreen={new URLSearchParams(window.location.search).has("fullscreen")}
        onBack={() => { setSelected(null); setModal(null); }}
        onEdit={() => setLocation(editorPath(selected.id))}
        onScan={() => setModal("scan")}
      />
      {modal === "scan" && <QrScannerDialog onClose={() => setModal(null)} onDetected={() => setLocation(editorPath(selected.id))} />}
    </>
  );

  return <main className="min-h-screen overflow-x-hidden pb-32 bg-[#EAE7DA]"><div className="mx-auto max-w-7xl px-4 pb-10 pt-24 sm:px-8 sm:pt-28 lg:px-12 lg:pt-5"><div className="hidden lg:block"><BrandHeader userName={user?.name} onProfile={() => setLocation("/perfil")} onSignOut={() => { setSelected(null); void auth.signOut(); }} /></div><section className="relative isolate mt-2 overflow-hidden rounded-[2rem] lg:mt-14 border-2 border-ink bg-ink text-cream shadow-hard sm:mt-14"><div className="absolute inset-0 -z-10"><PaisajePhoto photo={PAISAJES.budapest} sizes="(min-width: 1280px) 1200px, 100vw" priority /><div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/10 lg:bg-gradient-to-r lg:from-ink/90 lg:via-ink/50 lg:to-transparent" /></div><div className="absolute right-4 top-4 hidden sm:block"><PhotoTag photo={PAISAJES.budapest} /></div><div className="flex min-h-[360px] flex-col justify-end gap-8 p-6 sm:min-h-[400px] sm:p-10 xl:flex-row xl:items-end xl:justify-between lg:p-12"><div className="min-w-0"><motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border-2 border-cream/80 bg-ink/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] backdrop-blur-sm"><Sparkles size={13} className="text-orange" fill="currentColor" /> Tu colección personal</motion.p><motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .06 }} className="mt-5 font-display ![font-size:clamp(2.75rem,11vw,5.25rem)] leading-[.88] tracking-[-.04em]">Tus<br /><span className="whitespace-nowrap text-orange">scrapbooks.</span></motion.h1><p className="mt-5 max-w-md text-sm font-medium leading-relaxed text-cream/80 sm:text-base">Tus viajes, tus fotos y tu gente. Ábrelos cuando quieras volver.</p><button type="button" onClick={() => setModal("create")} className="mt-7 flex w-fit items-center gap-3 rounded-2xl border-2 border-cream bg-orange px-5 py-3.5 text-sm font-black text-ink shadow-[4px_4px_0_#EAE7DA] transition-transform hover:-translate-y-1 active:scale-[.97]"><FilePlus2 size={19} /> Nuevo scrapbook <ArrowUpRight size={18} /></button></div><div className="hidden shrink-0 text-ink xl:block"><CharacterGuide character="arturo" speech="¡Qué recuerdos! Todos tus destinos, guardados aquí." /></div></div></section><section className="mt-10 flex flex-col justify-between gap-3 border-b-2 border-ink/15 pb-4 sm:mt-14 sm:flex-row sm:items-center sm:gap-4"><div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"><button type="button" onClick={() => setActiveTab("Todos")} className={`shrink-0 rounded-full border-2 border-ink px-4 py-2 text-xs font-black ${activeTab === "Todos" ? "bg-ink text-cream" : "bg-white/50"}`}>Todos · {scrapbooks.length}</button><button type="button" onClick={() => setActiveTab("Portugal")} className={`shrink-0 rounded-full border-2 border-ink px-4 py-2 text-xs font-black ${activeTab === "Portugal" ? "bg-orange" : "bg-white/50"}`}>Portugal</button><button type="button" onClick={() => setActiveTab("Japón")} className={`shrink-0 rounded-full border-2 border-ink px-4 py-2 text-xs font-black ${activeTab === "Japón" ? "bg-orange" : "bg-white/50"}`}>Japón</button></div><label className="flex w-full items-center gap-2 rounded-full border-2 border-ink bg-white/50 px-3 py-2 text-xs font-bold text-ink/60 sm:w-auto"><Search size={15} className="shrink-0" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar recuerdos" aria-label="Buscar scrapbooks" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/45 sm:w-40 sm:flex-none" /></label></section><motion.section layout variants={scrapbookGridVariants} initial="hidden" animate="show" className="mt-7 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-4"><AnimatePresence mode="popLayout">{filtered.map((book) => <ScrapbookCard key={book.id} book={book} menuOpen={menu === book.id} onOpen={() => setSelected(book)} onToggleMenu={() => setMenu(menu === book.id ? null : book.id)} menu={menu === book.id ? <QuickMenu onClose={() => setMenu(null)} onShare={() => setModal("share")} onInvite={() => setModal("invite")} onEdit={() => setLocation(editorPath(book.id))} onDelete={() => setConfirmDelete(book)} /> : null} />)}</AnimatePresence></motion.section>{library.error ? <div role="alert" className="mt-7 flex flex-col items-start justify-between gap-3 rounded-[1.5rem] border-2 border-ink bg-[#f2c5a0] p-5 sm:flex-row sm:items-center"><Mascot name="24-offline-sin-wifi" size="sm" decorative={false} alt="Sin conexión con el servidor" /><p className="flex items-center gap-2 text-sm font-black"><CloudOff size={18} /> No se pudieron cargar tus scrapbooks: {library.error}</p><button type="button" onClick={() => void library.reload()} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-cream px-4 text-sm font-black"><RotateCcw size={15} /> Reintentar</button></div> : null}{library.loading ? <div className="mt-10 flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[.16em] text-ink/60" aria-busy="true"><Loader2 className="animate-spin" size={20} /> Cargando tus scrapbooks…</div> : null}{!library.loading && filtered.length === 0 && <EmptyState className="mt-10" mascot={search.trim() ? "17-buscar" : "23-vacio-sin-nada"} title="Todavía no hay páginas aquí." description="Prueba otra búsqueda o empieza un scrapbook nuevo." action={{ label: "Nuevo scrapbook", onClick: () => setModal("create"), icon: <FilePlus2 size={17} /> }} />}<div className="-mx-4 mt-20 space-y-20 sm:-mx-8 sm:mt-28 sm:space-y-28 lg:-mx-12"><ViveMundiBlock as="h2" /><RecuerdaMementoBlock /><section className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12"><PhotoMosaic /></section></div><section className="mt-16 grid overflow-hidden rounded-[2rem] border-2 border-ink bg-ink text-cream shadow-hard md:grid-cols-[1fr_.85fr]"><div className="order-2 flex flex-col justify-center gap-5 p-6 sm:p-8 md:order-1 lg:p-10"><Mascot name="07-camara" size="sm" className="shrink-0" /><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-orange">Tu siguiente recuerdo</p><h2 className="mt-2 font-display ![font-size:clamp(2rem,5vw,3rem)] leading-[.95] tracking-[-.02em]">Una foto puede abrir otra página.</h2></div><button type="button" onClick={() => setModal("create")} className="flex w-fit items-center gap-2 rounded-xl border-2 border-cream bg-orange px-4 py-3 text-sm font-black text-ink shadow-[3px_3px_0_#EAE7DA] transition-transform hover:-translate-y-0.5"><Plus size={17} /> Crear scrapbook</button></div><div className="relative order-1 aspect-[16/10] border-b-2 border-ink md:order-2 md:aspect-auto md:min-h-[300px] md:border-b-0 md:border-l-2"><PaisajePhoto photo={PAISAJES.pragaPuente} sizes="(min-width: 768px) 45vw, 100vw" /><PhotoTag photo={PAISAJES.pragaPuente} className="absolute bottom-4 left-4" /></div></section></div><AnimatePresence>{modal === "create" && <Dialog onClose={() => setModal(null)}><div className="pr-8"><Mascot name="25-maleta-viaje" size="sm" className="mb-3" /><p className="text-[10px] font-black uppercase tracking-[.18em] text-orange">Nueva historia</p><h2 className="mt-2 font-display text-4xl font-black tracking-[-.06em]">¿Cómo se llama este viaje?</h2></div><label className="mt-7 block text-xs font-black uppercase tracking-wider">Título<input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void addScrapbook()} placeholder="Ej. Verano sin mapa" className="mt-2 w-full rounded-xl border-2 border-ink bg-white/70 px-4 py-3 font-display text-xl font-black outline-none focus:ring-4 focus:ring-orange/40" /></label><label className="mt-4 block text-xs font-black uppercase tracking-wider">Descripción opcional<textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Unas palabras para recordar el contexto..." className="mt-2 min-h-24 w-full resize-none rounded-xl border-2 border-ink bg-white/70 px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-orange/40" /></label><button type="button" onClick={() => void addScrapbook()} disabled={creating} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-orange px-4 py-3 text-sm font-black shadow-hard-sm"><FilePlus2 size={17} /> Crear scrapbook</button></Dialog>}{(modal === "share" || modal === "invite") && <Dialog onClose={() => setModal(null)}><Mascot name={modal === "share" ? "14-compartir" : "33-invitar-amigos"} size="sm" /><h2 className="mt-6 font-display text-3xl font-black">{modal === "share" ? "Comparte la historia." : "Invita a tu gente."}</h2><p className="mt-3 text-sm font-medium leading-relaxed text-ink/65">{modal === "share" ? "Copia un enlace para que tus acompañantes puedan ver y aportar recuerdos al scrapbook." : "Añade personas por email y decidid juntos qué momentos se quedan en la página."}</p><div className="mt-6 flex gap-2"><input placeholder={modal === "share" ? "memento.mundi/algarve-2026" : "email@amigo.com"} className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-white/70 px-3 py-3 text-sm outline-none" /><button type="button" onClick={() => setModal(null)} className="rounded-xl border-2 border-ink bg-orange px-4 py-3 text-sm font-black">{modal === "share" ? "Copiar" : "Añadir"}</button></div></Dialog>}{modal === "scan" && <QrScannerDialog onClose={() => setModal(null)} onDetected={() => { setModal(null); if (scrapbooks[0]) setLocation(editorPath(scrapbooks[0].id)); }} />}{confirmDelete && <Dialog onClose={() => setConfirmDelete(null)}><Mascot name="35-borrar-papelera" size="sm" /><h2 className="mt-4 font-display text-3xl font-black">¿Borrar “{confirmDelete.title}”?</h2><p className="mt-3 text-sm font-medium leading-relaxed text-ink/65">Se borrará el scrapbook con todas sus páginas y fotos. Esta acción no se puede deshacer.</p><div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => { const book = confirmDelete; setConfirmDelete(null); void deleteScrapbook(book.id); }} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-[#f2c5a0] px-4 text-sm font-black shadow-hard-sm"><Trash2 size={16} /> Borrar scrapbook</button><button type="button" onClick={() => setConfirmDelete(null)} className="min-h-12 rounded-xl border-2 border-ink bg-white/70 px-4 text-sm font-black">Cancelar</button></div></Dialog>}</AnimatePresence></main>;
}
