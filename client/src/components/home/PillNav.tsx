import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Globe, LogOut, Menu, UserRound, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { BrandLockup } from "@/components/BrandCorner";

export type PillNavLink = { label: string; href?: string; onClick?: () => void };

type Props = {
  links: PillNavLink[];
  /** Botón de acción (coral con sombra dura): aparece al hacer scroll. */
  cta: { label: string; onClick: () => void };
  accountLabel: string;
  onAccount: () => void;
  onSignOut?: () => void;
};

const TEAL = "text-[#0A7186]";
/** Píxeles de scroll a partir de los cuales la barra cambia de variante. */
const SCROLLED_AT = 48;

/**
 * Barra "píldora" fija arriba (Neo Pill Nav), solo en móvil y tablet (lg:hidden): fondo blanco,
 * lockup de Memento Mundi a la izquierda, enlaces al centro (tablet) y cuenta a la derecha.
 * Al bajar cambia de variante: se estrecha, coge borde y sombra dura y aparece el botón coral.
 * En móvil los enlaces pasan a un menú desplegable.
 */
export default function PillNav({ links, cta, accountLabel, onAccount, onSignOut }: Props) {
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > SCROLLED_AT);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const run = (link: PillNavLink) => {
    setOpen(false);
    link.onClick?.();
  };

  const linkClass = `rounded-full px-2.5 py-2 font-brand text-[15px] leading-none ${TEAL} transition-colors hover:bg-orange/20`;

  const renderLink = (link: PillNavLink, className: string) =>
    link.href ? (
      <Link key={link.label} href={link.href} onClick={() => setOpen(false)} aria-current={location === link.href ? "page" : undefined} className={`${className} ${location === link.href ? "bg-orange/25" : ""}`}>{link.label}</Link>
    ) : (
      <button key={link.label} type="button" onClick={() => run(link)} className={className}>{link.label}</button>
    );

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-3 sm:top-4 sm:px-4 lg:hidden">
      <nav
        aria-label="Principal"
        className={`pointer-events-auto relative flex h-14 w-full items-center justify-between gap-2 rounded-full border-2 bg-white pl-3 pr-2 transition-[max-width,box-shadow,border-color] duration-300 ease-out sm:h-16 sm:pl-4 sm:pr-3 ${scrolled ? "max-w-[760px] border-ink shadow-[4px_4px_0_#222222]" : "max-w-[1098px] border-transparent shadow-[0_6px_24px_rgba(11,33,48,.08)]"}`}
      >
        <Link href="/" aria-label="Memento Mundi, ir a inicio" className="flex shrink-0 items-center gap-2">
          <BrandLockup compact />
        </Link>

        <div className="hidden items-center gap-0.5 md:flex">
          {links.map((link) => renderLink(link, linkClass))}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <AnimatePresence initial={false}>
            {scrolled ? (
              <motion.button
                key="cta"
                type="button"
                onClick={cta.onClick}
                initial={{ opacity: 0, scale: 0.85, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: "auto" }}
                exit={{ opacity: 0, scale: 0.85, width: 0 }}
                className="hidden items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border-2 border-ink bg-[#FFB4AD] px-4 py-2.5 text-xs font-black shadow-[3px_3px_0_#222222] transition-transform hover:-translate-y-0.5 active:scale-95 min-[420px]:flex md:hidden"
              >
                {cta.label} <ArrowUpRight size={14} />
              </motion.button>
            ) : null}
          </AnimatePresence>

          {onSignOut ? (
            <button type="button" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión" className="flex h-10 w-10 items-center justify-center rounded-full text-[#1d3fa6] transition-colors hover:bg-orange/20">
              <LogOut size={18} />
            </button>
          ) : null}

          <button type="button" onClick={onAccount} aria-label={accountLabel} title={accountLabel} className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#1d3fa6] transition-colors hover:bg-orange/20 sm:h-11 sm:w-11">
            <Globe size={26} strokeWidth={2.2} />
            <span className="absolute right-0.5 top-0.5 flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-[#1d3fa6] bg-white"><UserRound size={9} strokeWidth={3} /></span>
          </button>

          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Cerrar menú" : "Abrir menú"} className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-cream md:hidden">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              className="absolute inset-x-0 top-[calc(100%+10px)] flex flex-col gap-1 rounded-[1.75rem] border-2 border-ink bg-white p-3 shadow-[4px_4px_0_#222222] md:hidden"
            >
              {links.map((link) => renderLink(link, `rounded-2xl px-4 py-3 text-left font-brand text-xl ${TEAL} hover:bg-orange/20`))}
              <button type="button" onClick={() => { setOpen(false); cta.onClick(); }} className="mt-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-[#FFB4AD] px-4 py-3 text-sm font-black shadow-[3px_3px_0_#222222]">
                {cta.label} <ArrowUpRight size={16} />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </nav>
    </div>
  );
}
