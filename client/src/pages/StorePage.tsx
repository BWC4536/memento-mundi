import { useMemo, useState } from "react";
import { ArrowRight, Instagram, Package, ShoppingBag, UserRound, X } from "lucide-react";
import { useLocation } from "wouter";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import StickerScrollHero from "@/components/StickerScrollHero";
import NavigationDock from "@/components/NavigationDock";
import CharacterGuide from "@/components/CharacterGuide";

type ProductKind = "sticker" | "keyring" | "magnet" | "ornament" | "wall";
type Pack = { id: string; name: string; kicker: string; description: string; price: string; badge?: string; color: string; image: string; items: string[]; featured?: boolean };

const products: Record<ProductKind, { label: string; icon: string }> = {
  sticker: { label: "Pegatina NFC + QR", icon: "✦" },
  keyring: { label: "Llavero de destino", icon: "⌁" },
  magnet: { label: "Imán de nevera", icon: "✺" },
  ornament: { label: "Bola de Navidad", icon: "✧" },
  wall: { label: "Cuadro pieza de ciudad", icon: "▦" },
};

const packs: Pack[] = [
  { id: "sticker", name: "Pack Pegatinas", kicker: "El punto de partida", description: "Una pegatina NFC + QR para desbloquear tu scrapbook al instante.", price: "12 €", badge: "Más fácil", color: "bg-[#d8e2dc]", image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1000&q=85", items: ["sticker"] },
  { id: "duo", name: "Pack Viaje", kicker: "Para llevar contigo", description: "Pegatina + llavero para que tu destino vaya siempre en tu mochila.", price: "24 €", color: "bg-[#e7d8c2]", image: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1000&q=85", items: ["sticker", "keyring"] },
  { id: "home", name: "Pack Vuelta a casa", kicker: "Tu recuerdo diario", description: "Pegatina + imán para convertir la nevera en tu pequeño atlas.", price: "26 €", color: "bg-[#f2c5a0]", image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1000&q=85", items: ["sticker", "magnet"] },
  { id: "festive", name: "Pack Celebración", kicker: "Para regalar", description: "Pegatina + bola de Navidad: un viaje que vuelve cada diciembre.", price: "30 €", color: "bg-[#d9d1bd]", image: "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1000&q=85", items: ["sticker", "ornament"] },
  { id: "wall", name: "Pack Pieza de ciudad", kicker: "El recuerdo que se queda", description: "Pegatina + imán + cuadro de pared con una pieza de la ciudad que fue.", price: "58 €", badge: "Nuevo", color: "bg-[#cbd8d1]", image: "https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1000&q=85", items: ["sticker", "magnet", "wall"], featured: true },
  { id: "mundi", name: "Pack Memento Mundi", kicker: "Todo el ritual", description: "La colección completa: pegatina, llavero, imán, bola y cuadro de ciudad.", price: "84 €", badge: "Completo", color: "bg-[#fa9223]", image: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1000&q=85", items: ["sticker", "keyring", "magnet", "ornament", "wall"], featured: true },
];

function StoreHeader({ onLogin, loggedIn }: { onLogin: () => void; loggedIn: boolean }) {
  return (
    <header className="flex items-center justify-end">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => document.getElementById("packs")?.scrollIntoView({ behavior: "smooth" })}
          className="hidden sm:block rounded-full border-2 border-ink bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-wider hover:bg-orange transition-colors"
        >
          Packs
        </button>
        <button
          type="button"
          onClick={onLogin}
          className="flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-3.5 py-2 text-xs font-black uppercase tracking-wider text-cream hover:bg-orange hover:text-ink transition-colors shadow-hard-sm"
        >
          <span className="hidden sm:inline">{loggedIn ? "Mis scrapbooks" : "Entrar"}</span>
          <UserRound size={16} />
        </button>
      </div>
    </header>
  );
}

function PackCard({ pack, onAdd }: { pack: Pack; onAdd: (pack: Pack) => void }) {
  return (
    <article className={`group relative flex flex-col justify-between overflow-hidden rounded-[1.7rem] border-2 border-ink ${pack.color} p-3.5 shadow-hard transition-transform duration-200 hover:-translate-y-1`}>
      <div>
        <div className="relative aspect-[1.25/1] overflow-hidden rounded-[1.2rem] border-2 border-ink bg-ink">
          <img src={pack.image} alt={pack.name} className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="rounded-full border-2 border-ink bg-cream px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">{pack.kicker}</span>
            {pack.badge && <span className="rounded-full border-2 border-ink bg-orange px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">{pack.badge}</span>}
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-cream">
            <div>
              <p className="font-display text-2xl font-black leading-none">{pack.name}</p>
              <p className="mt-1 text-xs font-bold text-cream/70">{pack.price} · envío incluido</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink bg-orange text-ink"><Package size={18} /></span>
          </div>
        </div>
        <div className="px-1 pb-1 pt-4">
          <p className="min-h-12 text-sm font-medium leading-relaxed text-ink/70">{pack.description}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {pack.items.map((item) => (
              <span key={item} className="rounded-full border-2 border-ink/60 bg-white/45 px-2 py-1 text-[10px] font-black uppercase tracking-wider">
                {products[item as ProductKind].icon} {products[item as ProductKind].label.replace("NFC + QR", "")}
              </span>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAdd(pack)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-ink px-4 py-3 text-sm font-black text-cream shadow-hard-sm transition-transform hover:-translate-y-0.5 hover:bg-orange hover:text-ink"
      >
        <ShoppingBag size={16} /> Añadir al kit <ArrowRight size={16} />
      </button>
    </article>
  );
}

export default function StorePage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [cart, setCart] = useState<Pack[]>([]);
  const [showCart, setShowCart] = useState(false);
  const total = useMemo(() => cart.reduce((sum, item) => sum + Number(item.price.replace(" €", "")), 0), [cart]);

  const handleLogin = () => isAuthenticated ? setLocation("/") : startLogin();
  const addPack = (pack: Pack) => { setCart((current) => [...current, pack]); setShowCart(true); };

  return (
    <main className="min-h-screen pb-32 bg-[#EAE7DA] relative overflow-x-hidden">
      {/* Cabecera superior accesible */}
      <div className="absolute top-0 left-0 right-0 z-30 mx-auto max-w-7xl px-4 pt-4 sm:px-8 sm:pt-6 pointer-events-auto">
        <StoreHeader onLogin={handleLogin} loggedIn={isAuthenticated} />
      </div>

      {/* Hero Interactivo Reversible a Pantalla Completa (Estilo Organimo) */}
      <StickerScrollHero />

      {/* Contenido principal de la tienda */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-8 lg:px-12 pt-6">
        
        {/* Pasos de uso */}
        <section className="grid gap-4 sm:grid-cols-3" id="how">
          <div className="rounded-[1.4rem] border-2 border-ink bg-orange p-5 shadow-hard-sm">
            <span className="font-mono text-3xl">01</span>
            <h2 className="mt-6 font-display text-2xl font-black">Pega</h2>
            <p className="mt-2 text-sm font-medium text-ink/75">Coloca tu pegatina en una postal, mochila o cuaderno de viaje.</p>
          </div>
          <div className="rounded-[1.4rem] border-2 border-ink bg-white/60 p-5 shadow-hard-sm">
            <span className="font-mono text-3xl">02</span>
            <h2 className="mt-6 font-display text-2xl font-black">Escanea</h2>
            <p className="mt-2 text-sm font-medium text-ink/75">Abre Memento Mundi y desbloquea el scrapbook de esa coordenada.</p>
          </div>
          <div className="rounded-[1.4rem] border-2 border-ink bg-[#d8e2dc] p-5 shadow-hard-sm">
            <span className="font-mono text-3xl">03</span>
            <h2 className="mt-6 font-display text-2xl font-black">Vuelve</h2>
            <p className="mt-2 text-sm font-medium text-ink/75">Añade fotos, invita a tu gente y revive el viaje cuando quieras.</p>
          </div>
        </section>

        {/* Sección de packs con Miriam acompañando el encabezado */}
        <section className="mt-20" id="packs">
          <div className="flex flex-col justify-between gap-6 border-b-2 border-ink/15 pb-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange">Colección física</p>
              <h1 className="mt-2 font-display text-4xl sm:text-6xl font-black leading-none tracking-[-.05em] break-words">
                Elige cómo<br /><span className="text-orange">quieres volver.</span>
              </h1>
              <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-ink/65">
                Todos los packs incluyen al menos una pegatina NFC + QR. Combina objetos según tu tipo de viaje.
              </p>
            </div>
            
            {/* Miriam acompañando el texto grande */}
            <div className="lg:max-w-md">
              <CharacterGuide
                character="miriam"
                speech="Nosotros siempre llevamos el Pack Pegatinas en la mochila para cuando encontramos un rincón especial."
                subtext="El chip NFC abre tu cuaderno digital al apoyar el móvil."
              />
            </div>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((pack) => <PackCard key={pack.id} pack={pack} onAdd={addPack} />)}
          </div>
        </section>

        {/* Sección "La pieza que fue" con Arturo acompañando el texto */}
        <section className="mt-20 overflow-hidden rounded-[2rem] border-2 border-ink bg-[#d8e2dc] p-6 shadow-hard sm:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange">La pieza que fue</p>
              <h2 className="mt-3 max-w-xl font-display text-4xl sm:text-5xl font-black leading-[.94] tracking-[-.05em] break-words">
                Una ciudad también puede vivir en tu pared.
              </h2>
              <p className="mt-4 max-w-lg text-sm sm:text-base font-medium leading-relaxed text-ink/70">
                El cuadro de pared convierte la pieza de la ciudad que visitaste en un objeto tangible con historia. Lisboa, Kyoto, Algarve o tu próxima parada.
              </p>

              {/* Arturo acompañando la sección */}
              <div className="mt-6">
                <CharacterGuide
                  character="arturo"
                  speech="El cuadro con la pieza de la ciudad que fue es mi rincón favorito de casa."
                  subtext="Un recordatorio diario de los lugares donde fuiste feliz."
                />
              </div>

              <button
                type="button"
                onClick={() => addPack(packs.find((pack) => pack.id === "wall")!)}
                className="mt-7 flex items-center gap-2 rounded-xl border-2 border-ink bg-orange px-5 py-3.5 text-sm font-black shadow-hard-sm transition-transform hover:-translate-y-0.5 active:scale-95"
              >
                Descubrir el pack <ArrowRight size={17} />
              </button>
            </div>

            <div className="relative mx-auto w-full max-w-sm rotate-[3deg] sm:rotate-[4deg] rounded-2xl border-2 border-ink bg-cream p-3 shadow-hard">
              <img
                src="https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=85"
                alt="Paisaje de destino"
                className="aspect-[4/3] w-full rounded-xl border-2 border-ink object-cover"
              />
              <div className="absolute -bottom-3 -left-3 rotate-[-7deg] rounded-lg border-2 border-ink bg-orange px-3 py-1.5 font-mono text-[11px] font-black shadow-hard-sm">
                LA CIUDAD QUE FUE
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-16 flex flex-col justify-between gap-4 border-t-2 border-ink/15 pt-6 text-xs font-bold text-ink/60 sm:flex-row pb-6">
          <span>memento mundi · objetos para recordar mejor</span>
          <span className="flex items-center gap-3"><Instagram size={15} /> Hecho para volver</span>
        </footer>
      </div>

      {/* Dock universal responsive con 5 botones */}
      <NavigationDock accent="store" />

      {/* Modal flotante del carrito */}
      {showCart && (
        <div className="fixed bottom-24 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-[1.5rem] border-2 border-ink bg-cream p-4 shadow-hard sm:right-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-orange">Tu kit</p>
              <h2 className="font-display text-2xl font-black">{cart.length} pack{cart.length === 1 ? "" : "s"}</h2>
            </div>
            <button type="button" onClick={() => setShowCart(false)} aria-label="Cerrar kit" className="rounded-full border-2 border-ink bg-white/60 p-2"><X size={16} /></button>
          </div>
          <div className="mt-3 max-h-32 space-y-2 overflow-auto">
            {cart.map((item, index) => (
              <div key={`${item.id}-${index}`} className="flex items-center justify-between border-b border-ink/15 pb-2 text-sm font-bold">
                <span>{item.name}</span>
                <span>{item.price}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t-2 border-ink pt-3 font-black">
            <span>Total orientativo</span>
            <span>{total} €</span>
          </div>
          <button type="button" onClick={handleLogin} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-orange px-4 py-3 text-sm font-black shadow-hard-sm">
            {isAuthenticated ? "Continuar" : "Entrar para comprar"} <ArrowRight size={16} />
          </button>
        </div>
      )}
    </main>
  );
}
