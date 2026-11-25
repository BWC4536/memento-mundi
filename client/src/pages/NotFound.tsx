import { Home } from "lucide-react";
import { useLocation } from "wouter";
import Mascot from "@/components/ui/Mascot";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 pb-32 pt-24">
      <section className="w-full max-w-lg rounded-[2rem] border-2 border-ink bg-white/70 p-6 text-center shadow-hard sm:p-10">
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
