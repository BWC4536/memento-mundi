"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import IntroVideoHero from "@/components/IntroVideoHero";

const PACKS = [
  { id: "1", title: "Pack Pegatinas", price: "12 €", tag: "El punto de partida" },
  { id: "2", title: "Pack Viaje", price: "24 €", tag: "Para llevar contigo" },
  { id: "3", title: "Pack Vuelta a Casa", price: "26 €", tag: "Tu recuerdo diario" },
];

export default function HomePage() {
  const [isIntroFinished, setIsIntroFinished] = useState(false);

  return (
    <>
      {/* 1. Intro en Pantalla Completa con bloqueo de scroll */}
      <IntroVideoHero
        src="/memento_sticker.mp4"
        isFinished={isIntroFinished}
        onFinished={() => setIsIntroFinished(true)}
      />

      {/* 2. Contenedor de la Tienda (Fade-in fluido estilo Organimo) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isIntroFinished ? 1 : 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`min-h-screen bg-[#EAE7DA] text-[#0B2130] ${
          !isIntroFinished ? "pointer-events-none select-none opacity-0" : ""
        }`}
      >
        <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8">
          <div className="font-brand text-2xl font-black tracking-tight">
            Memento <span className="text-[#FA9223]">mundi</span>
          </div>
          <button className="rounded-full border-2 border-[#0B2130] bg-white/60 px-4 py-2 text-xs font-black uppercase tracking-wider transition hover:-translate-y-0.5">
            Cuenta
          </button>
        </header>

        <main className="mx-auto max-w-7xl px-6 pb-32 pt-10">
          <section className="mb-16">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FA9223]">
              Colección Física
            </span>
            <h1 className="mt-3 font-brand text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
              Elige cómo <br />
              <span className="text-[#FA9223]">quieres volver.</span>
            </h1>
            <p className="mt-6 max-w-md text-sm font-medium leading-relaxed text-[#0B2130]/70">
              Todos los packs incluyen al menos una pegatina NFC + QR. Combina objetos según el viaje.
            </p>
          </section>

          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PACKS.map((pack) => (
              <article
                key={pack.id}
                className="group relative flex flex-col justify-between rounded-[2rem] border-2 border-[#0B2130] bg-[#FFFDF6] p-5 shadow-[4px_4px_0_#0B2130] transition hover:-translate-y-1"
              >
                <div>
                  <span className="inline-block rounded-full border border-[#0B2130] bg-[#EAE7DA] px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                    {pack.tag}
                  </span>
                  <div className="my-6 aspect-[4/3] rounded-2xl border-2 border-[#0B2130] bg-[#D6DFD8] flex items-center justify-center text-xs font-bold text-[#0B2130]/40">
                    Vista previa
                  </div>
                  <h3 className="font-brand text-2xl font-black">{pack.title}</h3>
                  <p className="mt-1 text-sm font-bold text-[#FA9223]">{pack.price}</p>
                </div>

                <button
                  type="button"
                  className="mt-6 w-full rounded-xl border-2 border-[#0B2130] bg-[#0B2130] py-3 text-xs font-black uppercase tracking-wider text-[#EAE7DA] transition hover:bg-[#FA9223] hover:text-[#0B2130]"
                >
                  Añadir al kit
                </button>
              </article>
            ))}
          </section>
        </main>

        <nav className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4">
          <div className="flex items-center gap-4 rounded-full border-2 border-[#0B2130] bg-[#FFFDF6]/95 px-6 py-3 shadow-[4px_4px_0_#0B2130] backdrop-blur-md">
            <span className="text-xs font-black uppercase tracking-widest text-[#0B2130]">Inicio</span>
            <span className="h-4 w-[2px] bg-[#0B2130]/20" />
            <span className="text-xs font-black uppercase tracking-widest text-[#FA9223]">Tienda</span>
            <span className="h-4 w-[2px] bg-[#0B2130]/20" />
            <span className="text-xs font-black uppercase tracking-widest text-[#0B2130]">Perfil</span>
          </div>
        </nav>
      </motion.div>
    </>
  );
}
