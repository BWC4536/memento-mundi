import { useEffect, useMemo } from "react";
import { Loader2, LogIn, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import InfiniteCanvasEditor from "@/components/InfiniteCanvasEditor";
import Mascot, { type MascotName } from "@/components/ui/Mascot";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useSharedScrapbookLibrary } from "@/contexts/ScrapbookLibraryContext";
import { getScrapbookComposition } from "@/lib/scrapbook-library";

/** Pantalla de estado (cargando, error, sin sesión) con la misma estética que Home. */
function StatusScreen({ mascot, title, children, busy = false }: { mascot: MascotName; title: string; children?: React.ReactNode; busy?: boolean }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center" aria-busy={busy}>
      <Mascot name={mascot} size="md" mobileSize="sm" decorative={false} alt={title} />
      <p className="font-display text-3xl">{title}</p>
      {children}
    </main>
  );
}

/**
 * Editor de un scrapbook en su propia ruta: `/scrapbooks/:id`.
 * Carga el scrapbook y su cuaderno (Supabase o local), y al cerrar vuelve a su vista previa.
 */
export default function ScrapbookEditorPage({ id }: { id: string }) {
  const auth = useAppAuth();
  const [, setLocation] = useLocation();
  const library = useSharedScrapbookLibrary();
  const scrapbook = library.scrapbooks.find((book) => book.id === id) ?? null;
  const status = scrapbook ? library.compositionStatus(scrapbook.id) : "loading";
  const composition = useMemo(() => (scrapbook && (scrapbook.composition || status === "ready") ? getScrapbookComposition(scrapbook) : null), [scrapbook, status]);
  const { ensureComposition } = library;

  useEffect(() => {
    if (scrapbook) void ensureComposition(scrapbook.id);
  }, [ensureComposition, scrapbook]);

  const backToPreview = () => setLocation(`/?scrapbook=${encodeURIComponent(id)}`);

  if (auth.loading || library.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream" aria-busy="true">
        <Loader2 className="animate-spin text-ink/50" size={28} aria-label="Cargando" />
      </main>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <StatusScreen mascot="12-scrapbook-album" title="Entra para abrir tu cuaderno.">
        <button type="button" onClick={auth.openLogin} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-4 text-sm font-black shadow-hard-sm">
          <LogIn size={16} /> Entrar
        </button>
      </StatusScreen>
    );
  }

  if (!scrapbook && library.error) {
    return (
      <StatusScreen mascot="24-offline-sin-wifi" title="No se pudieron cargar tus scrapbooks.">
        <p className="max-w-sm text-sm font-semibold text-ink/60">{library.error}</p>
        <button type="button" onClick={() => void library.reload()} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-4 text-sm font-black shadow-hard-sm">
          <RotateCcw size={16} /> Reintentar
        </button>
      </StatusScreen>
    );
  }

  if (!scrapbook) {
    return (
      <StatusScreen mascot="17-buscar" title="No encontramos este scrapbook.">
        <p className="max-w-sm text-sm font-semibold text-ink/60">Puede que se haya borrado o que no tengas acceso.</p>
        <button type="button" onClick={() => setLocation("/")} className="min-h-11 rounded-xl border-2 border-ink bg-white/70 px-4 text-sm font-black">
          Ver mis scrapbooks
        </button>
      </StatusScreen>
    );
  }

  if (!composition) {
    return status === "error" ? (
      <StatusScreen mascot="24-offline-sin-wifi" title={`No se pudo abrir “${scrapbook.title}”.`}>
        <div className="flex gap-2">
          <button type="button" onClick={() => void ensureComposition(scrapbook.id, true)} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-4 text-sm font-black shadow-hard-sm">
            <RotateCcw size={16} /> Reintentar
          </button>
          <button type="button" onClick={backToPreview} className="min-h-11 rounded-xl border-2 border-ink bg-white/70 px-4 text-sm font-black">
            Volver
          </button>
        </div>
      </StatusScreen>
    ) : (
      <StatusScreen mascot="22-cargando-reloj" title={`Abriendo “${scrapbook.title}”…`} busy />
    );
  }

  return (
    <InfiniteCanvasEditor
      key={scrapbook.id}
      scrapbook={scrapbook}
      initialComposition={composition}
      onSave={(next) => library.saveComposition(scrapbook.id, next)}
      onClose={backToPreview}
    />
  );
}
