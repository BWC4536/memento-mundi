import { Link } from "wouter";

/**
 * Lockup de marca arriba a la izquierda.
 * Va en `absolute` (sin ancestro posicionado), así forma parte del flujo de la página:
 * se ve arriba del todo y se va con el scroll en vez de quedarse fijo.
 */
export default function BrandCorner() {
  return (
    <Link
      href="/"
      aria-label="Memento Mundi, ir a inicio"
      className="absolute left-3 top-3 z-[80] flex max-w-[calc(100vw-6rem)] items-center gap-2 sm:left-6 sm:top-5 sm:gap-3"
    >
      <img
        src="/MEMENTO_LOGO.svg"
        alt=""
        className="h-10 w-10 shrink-0 select-none object-contain drop-shadow-sm sm:h-14 sm:w-14"
        draggable={false}
      />
      <span className="flex min-w-0 flex-col">
        <span className="flex items-end gap-1.5">
          <img
            src="/MEMENTO_FRASE.svg"
            alt="Memento"
            className="h-5 w-auto min-w-0 select-none object-contain sm:h-7"
            draggable={false}
          />
          <span className="font-brand text-lg font-black leading-none text-orange sm:text-2xl">mundi</span>
        </span>
        <span className="mt-1 font-mono text-[7px] font-black uppercase tracking-[0.16em] text-ink/70 sm:text-[8px]">
          viaja. guarda. vuelve.
        </span>
      </span>
    </Link>
  );
}
