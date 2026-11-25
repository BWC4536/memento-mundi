import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ChevronRight, ShoppingBag } from "lucide-react";
import CharacterGuide from "@/components/CharacterGuide";
import Mascot, { type MascotName } from "@/components/ui/Mascot";
import PaisajePhoto, { PhotoTag } from "@/components/home/PaisajePhoto";
import PhotoCarousel3D from "@/components/home/PhotoCarousel3D";
import PhotoMosaic from "@/components/home/PhotoMosaic";
import { CAROUSEL_PAISAJES, PAISAJES, type Paisaje } from "@/lib/paisajes";

type Props = {
  header: ReactNode;
  onStore: () => void;
  onLogin: () => void;
};

const STEPS: { n: string; title: string; desc: string; photo: Paisaje; mascot: MascotName }[] = [
  { n: "01", title: "Escanea", desc: "Acerca el móvil a la pegatina NFC o lee su QR.", photo: PAISAJES.pragaPuente, mascot: "13-escanear-qr" },
  { n: "02", title: "Crea", desc: "Fotos, marcos y notas en un cuaderno sin límites.", photo: PAISAJES.collage, mascot: "12-scrapbook-album" },
  { n: "03", title: "Comparte", desc: "Invita a quien viajó contigo y llenad la página juntos.", photo: PAISAJES.pragaTyn, mascot: "14-compartir" },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, delay },
});

/** Página de inicio para quien aún no ha iniciado sesión. */
export default function Landing({ header, onStore, onLogin }: Props) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#EAE7DA] pb-32">
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-8 lg:px-12">
        {header}

        {/* Hero: titular + carrusel 3D de fotos reales */}
        <section className="mt-12 grid items-center gap-10 sm:mt-14 lg:mt-10 lg:grid-cols-[1fr_1.05fr] lg:gap-6">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] shadow-hard-sm">
              <span className="h-2 w-2 rounded-full bg-orange" /> Memento Mundi
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-5 font-display text-[clamp(3.25rem,13vw,7.5rem)] leading-[.86] tracking-[-.04em]">
              Viaja.<br />Guarda.<br /><span className="text-orange">Vuelve.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }} className="mt-6 max-w-md text-base font-medium leading-relaxed text-ink/70 sm:text-lg">
              Una pegatina, tus fotos y tu gente. Tu viaje, convertido en un scrapbook que se abre con el móvil.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }} className="mt-8 flex w-full flex-col gap-3 min-[420px]:w-auto min-[420px]:flex-row">
              <button type="button" onClick={onStore} className="flex min-h-12 items-center justify-center gap-3 rounded-2xl border-2 border-ink bg-orange px-7 py-4 text-sm font-black shadow-hard transition-transform hover:-translate-y-1 active:scale-[.97]">
                <ShoppingBag size={19} /> Ir a la tienda <ArrowUpRight size={18} />
              </button>
              <button type="button" onClick={onLogin} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-white/70 px-6 py-4 text-sm font-black transition-transform hover:-translate-y-0.5">
                Iniciar sesión <ChevronRight size={16} />
              </button>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.6 }} className="relative isolate">
            <PhotoCarousel3D photos={CAROUSEL_PAISAJES} priority />
            {/* La mascota despega la pegatina junto a las fotos (isolate: sus capas nunca superan a un diálogo) */}
            <div className="pointer-events-none absolute -bottom-6 -left-2 z-[120] hidden sm:block lg:-left-6">
              <Mascot name="28-pegatina-despegar" size="sm" tilt={-8} />
            </div>
          </motion.div>
        </section>
      </div>

      {/* Banda de foto: el nombre de la marca, explicado en una línea */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:mt-24 sm:px-8 lg:px-12">
        <motion.div {...fadeUp()} className="relative isolate overflow-hidden rounded-[2rem] border-2 border-ink bg-ink shadow-hard">
          <div className="absolute inset-0 -z-10">
            <PaisajePhoto photo={PAISAJES.budapest} sizes="(min-width: 1280px) 1200px, 100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/10 sm:bg-gradient-to-r sm:from-ink/90 sm:via-ink/45 sm:to-transparent" />
          </div>
          <div className="flex min-h-[420px] flex-col justify-end p-6 text-cream sm:min-h-[460px] sm:p-10 lg:min-h-[520px] lg:p-14">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange">Memento mundi · recuerda el mundo</p>
            <h2 className="mt-3 max-w-xl font-display text-[clamp(2.4rem,7vw,4.75rem)] leading-[.9] tracking-[-.03em]">
              Cada ciudad deja huella. Guárdala.
            </h2>
            <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-cream/80 sm:text-base">
              Lo que viviste, en una página que puedes volver a abrir.
            </p>
            <PhotoTag photo={PAISAJES.budapest} className="mt-6 self-start" />
          </div>
        </motion.div>
      </section>

      {/* Cómo funciona: tres pasos, cada uno con su foto */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:mt-24 sm:px-8 lg:px-12">
        <motion.div {...fadeUp()} className="flex flex-col items-center text-center">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange">Cómo funciona</p>
          <h2 className="mt-3 font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[.92] tracking-[-.03em]">Tres pasos. Ningún recuerdo perdido.</h2>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3 lg:gap-7">
          {STEPS.map((step, index) => (
            <motion.article key={step.title} {...fadeUp(index * 0.08)} className="group relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-[1.75rem] border-2 border-ink bg-ink p-5 text-cream shadow-hard sm:aspect-[3/4] lg:p-6">
              <div className="absolute inset-0 -z-10">
                <PaisajePhoto photo={step.photo} sizes="(min-width: 640px) 33vw, 100vw" decorative className="transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
              </div>
              <span className="absolute left-4 top-4 rounded-full border-2 border-ink bg-orange px-3 py-1 font-mono text-xs font-black text-ink">{step.n}</span>
              <div className="absolute right-2 top-2 w-20 sm:w-24">
                <Mascot name={step.mascot} size="sm" tilt={index % 2 ? 6 : -6} className="drop-shadow-[0_4px_10px_rgba(11,33,48,.45)]" />
              </div>
              <h3 className="font-display text-4xl leading-none tracking-[-.02em] lg:text-5xl">{step.title}</h3>
              <p className="mt-2 max-w-[24ch] text-sm font-semibold leading-snug text-cream/85">{step.desc}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-10 flex justify-center px-2">
          <CharacterGuide character="miriam" speech="Pega la pegatina donde quieras: una postal, tu libreta o la maleta." />
        </div>
      </section>

      {/* Muro de fotos decorativo */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:mt-24 sm:px-8 lg:px-12">
        <motion.div {...fadeUp()} className="mb-8 flex flex-col items-center text-center sm:mb-10">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange">Postales del mundo</p>
          <h2 className="mt-3 font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[.92] tracking-[-.03em]">Lugares que se quedan.</h2>
        </motion.div>
        <PhotoMosaic />
      </section>

      {/* Cierre: llamada a la tienda con foto */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:mt-24 sm:px-8 lg:px-12">
        <motion.div {...fadeUp()} className="grid overflow-hidden rounded-[2rem] border-2 border-ink bg-ink text-cream shadow-hard md:grid-cols-[1.15fr_1fr]">
          <div className="order-2 flex flex-col justify-center gap-5 p-6 sm:p-10 md:order-1 lg:p-14">
            <Mascot name="37-pegatina-avion" size="sm" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange">Tu primera historia</p>
              <h2 className="mt-3 font-display text-[clamp(2.25rem,5.5vw,3.75rem)] leading-[.92] tracking-[-.03em]">Todo empieza con una pegatina.</h2>
            </div>
            <button type="button" onClick={onStore} className="flex w-fit items-center gap-2 rounded-xl border-2 border-cream bg-orange px-5 py-3.5 text-sm font-black text-ink shadow-[3px_3px_0_#EAE7DA] transition-transform hover:-translate-y-0.5 active:scale-[.97]">
              <ShoppingBag size={17} /> Ver packs <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="relative order-1 aspect-[16/11] border-b-2 border-ink md:order-2 md:aspect-auto md:min-h-[420px] md:border-b-0 md:border-l-2">
            <PaisajePhoto photo={PAISAJES.viena} sizes="(min-width: 768px) 45vw, 100vw" />
            <PhotoTag photo={PAISAJES.viena} className="absolute bottom-4 left-4" />
          </div>
        </motion.div>
      </section>
    </main>
  );
}
