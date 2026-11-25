import { Home } from "lucide-react";
import { useLocation } from "wouter";
import Mascot from "@/components/ui/Mascot";
import PaisajePhoto from "@/components/home/PaisajePhoto";
import { PAISAJES } from "@/lib/paisajes";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 pb-32 pt-24">
      {/* Cielo de tormenta de Praga: el sitio donde uno se pierde */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <PaisajePhoto photo={PAISAJES.pragaTyn} sizes="100vw" decorative priority />
        <div className="absolute inset-0 bg-ink/45" />
      </div>
      <section className="w-full max-w-lg rounded-[2rem] border-2 border-ink bg-cream p-6 text-center shadow-hard sm:p-10">
        <Mascot name="21-error-404-perdido" size="lg" mobileSize="md" className="mx-auto" decorative={false} alt="La mascota de Memento Mundi, perdida con un mapa" priority />
        <p className="mt-4 text-[10px] font-black uppercase tracking-[.2em] text-orange">Error 404</p>
        <h1 className="mt-2 font-display !text-5xl sm:!text-6xl">Esta página se ha perdido.</h1>
        <p className="mx-auto mt-4 max-w-sm text-base font-medium leading-relaxed text-ink/65">
          No encontramos lo que buscas. Puede que se haya movido o que el enlace no sea correcto.
        </p>
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="sticker-button mx-auto mt-8 flex min-h-12 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-6 text-sm font-black shadow-hard-sm transition-transform hover:-translate-y-0.5"
        >
          <Home size={17} /> Volver a casa
        </button>
      </section>
    </main>
  );
}
