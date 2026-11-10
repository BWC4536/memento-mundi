import { ArrowLeft, Compass, Map, ShoppingBag, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import ExplorePage from "@/pages/ExplorePage";
import CharacterGuide from "@/components/CharacterGuide";

type Section = "Tienda" | "Explorar" | "Perfil";

const content: Record<Section, { eyebrow: string; title: string; body: string; icon: typeof ShoppingBag; action: string }> = {
  Tienda: { eyebrow: "Objetos para llevar", title: "Recuerdos que empiezan en tus manos.", body: "Descubre pegatinas, parches y pequeñas piezas NFC para que cada ruta tenga un punto de partida físico.", icon: ShoppingBag, action: "Ver colección" },
  Explorar: { eyebrow: "Atlas compartido", title: "Elige una coordenada y déjate llevar.", body: "Explora destinos, rutas y scrapbooks que esperan una nueva mirada. La siguiente historia puede estar a la vuelta.", icon: Compass, action: "Abrir mapa" },
  Perfil: { eyebrow: "Tu pasaporte digital", title: "Todo lo que has guardado, contigo.", body: "Gestiona tus datos, tus destinos desbloqueados y la forma en que quieres aparecer en tu atlas personal.", icon: UserRound, action: "Editar perfil" },
};

export default function SectionPage({ section }: { section: Section }) {
  if (section === "Explorar") return <ExplorePage />;
  return <InfoSection section={section} />;
}

function InfoSection({ section }: { section: Section }) {
  const [, setLocation] = useLocation();
  const item = content[section];
  const Icon = item.icon;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#EAE7DA] px-4 pb-32 pt-24 sm:px-10 sm:pt-28 lg:px-16">
      <header className="flex items-center justify-end">
        <button type="button" onClick={() => setLocation("/")} className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
          <ArrowLeft size={16} /> Volver a casa
        </button>
      </header>

      <section className="mx-auto flex min-h-[60vh] max-w-4xl items-center pt-6 sm:pt-8">
        <div className="w-full rounded-[2rem] border-2 border-ink bg-white/70 p-5 shadow-hard sm:p-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink bg-orange shadow-hard-sm sm:h-16 sm:w-16">
              <Icon size={26} />
            </div>
            {/* Arturo acompañando el texto grande */}
            <CharacterGuide
              character="arturo"
              speech="Aquí tienes tu pasaporte digital con todos tus destinos y momentos guardados."
            />
          </div>

          <p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-orange">{item.eyebrow}</p>
          <h1 className="mt-2 max-w-2xl break-words font-display text-4xl font-black leading-[.94] tracking-[-.05em] sm:text-6xl">
            {item.title}
          </h1>
          <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-ink/65 sm:text-lg">
            {item.body}
          </p>

          <button type="button" className="mt-8 rounded-xl border-2 border-ink bg-ink px-5 py-3 text-sm font-black text-cream shadow-hard-sm transition-colors hover:bg-orange hover:text-ink">
            {item.action}
          </button>

          <div className="mt-14 flex items-center gap-3 border-t-2 border-ink/15 pt-5 text-xs font-bold text-ink/60">
            <Map size={16} className="shrink-0" /> Esta vista crecerá con tu próxima expedición.
          </div>
        </div>
      </section>
    </main>
  );
}
