import { Link } from "wouter";

/** Logo + "Memento mundi" + lema. `compact` es la versión que cabe dentro de la barra móvil. */
export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <img
        src="/MEMENTO_LOGO.svg"
        alt=""
        className={`shrink-0 select-none object-contain drop-shadow-sm ${compact ? "h-9 w-9" : "h-10 w-10 sm:h-14 sm:w-14"}`}
        draggable={false}
      />
      <span className="flex min-w-0 flex-col">
        <span className="flex items-end gap-1.5">
          <img
            src="/MEMENTO_FRASE.svg"
            alt="Memento"
            className={`w-auto min-w-0 select-none object-contain ${compact ? "h-[18px]" : "h-5 sm:h-7"}`}
            draggable={false}
          />
          <span className={`font-brand font-black leading-none text-orange ${compact ? "text-base" : "text-lg sm:text-2xl"}`}>mundi</span>
        </span>
        <span className={`mt-1 font-mono font-black uppercase tracking-[0.16em] text-ink/70 ${compact ? "text-[6.5px]" : "text-[7px] sm:text-[8px]"}`}>
          viaja. guarda. vuelve.
        </span>
      </span>
    </>
  );
}

/**
 * Lockup de marca arriba a la izquierda en escritorio (en móvil y tablet va dentro de la barra MobileNav).
 * Va en `absolute` (sin ancestro posicionado), así forma parte del flujo de la página:
 * se ve arriba del todo y se va con el scroll en vez de quedarse fijo.
 */
export default function BrandCorner() {
  return (
    <Link
      href="/"
      aria-label="Memento Mundi, ir a inicio"
      className="absolute left-6 top-5 z-[80] hidden max-w-[calc(100vw-6rem)] items-center gap-3 lg:flex"
    >
      <BrandLockup />
    </Link>
  );
}
