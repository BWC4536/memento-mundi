import { ArrowLeft, Compass, Map, ShoppingBag, UserRound } from "lucide-react";
import { useLocation } from "wouter";

type Section = "Tienda" | "Explorar" | "Perfil";

const content: Record<Section, { eyebrow: string; title: string; body: string; icon: typeof ShoppingBag; action: string }> = {
  Tienda: { eyebrow: "Objetos para llevar", title: "Recuerdos que empiezan en tus manos.", body: "Descubre pegatinas, parches y pequeñas piezas NFC para que cada ruta tenga un punto de partida físico.", icon: ShoppingBag, action: "Ver colección" },
  Explorar: { eyebrow: "Atlas compartido", title: "Elige una coordenada y déjate llevar.", body: "Explora destinos, rutas y scrapbooks que esperan una nueva mirada. La siguiente historia puede estar a la vuelta.", icon: Compass, action: "Abrir mapa" },
  Perfil: { eyebrow: "Tu pasaporte digital", title: "Todo lo que has guardado, contigo.", body: "Gestiona tus datos, tus destinos desbloqueados y la forma en que quieres aparecer en tu atlas personal.", icon: UserRound, action: "Editar perfil" },
};

export default function SectionPage({ section }: { section: Section }) {
  const [, setLocation] = useLocation();
  const item = content[section];
  const Icon = item.icon;
  return <main className="min-h-screen px-5 pb-24 pt-6 sm:px-10 lg:px-16"><header className="flex items-center justify-between"><button type="button" onClick={() => setLocation("/")} className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]"><ArrowLeft size={16} /> Volver al atlas</button><div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-ink bg-orange shadow-hard-sm"><span className="font-black">M</span></div></header><section className="mx-auto flex min-h-[70vh] max-w-4xl items-center"><div className="w-full rounded-[2rem] border-2 border-ink bg-white/60 p-7 shadow-hard sm:p-12"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-ink bg-orange shadow-hard-sm"><Icon size={28} /></div><p className="mt-10 text-[10px] font-black uppercase tracking-[0.2em] text-orange">{item.eyebrow}</p><h1 className="mt-3 max-w-2xl font-display text-5xl font-black leading-[.94] tracking-[-.06em] sm:text-7xl">{item.title}</h1><p className="mt-7 max-w-xl text-lg font-medium leading-relaxed text-ink/65">{item.body}</p><button type="button" className="mt-8 rounded-xl border-2 border-ink bg-ink px-5 py-3 text-sm font-black text-cream shadow-hard-sm">{item.action}</button><div className="mt-16 flex items-center gap-3 border-t-2 border-ink/15 pt-5 text-xs font-bold text-ink/60"><Map size={16} /> Esta vista crecerá con tu próxima expedición.</div></div></section></main>;
}
