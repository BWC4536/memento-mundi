import { useEffect, useState } from "react";

export default function BrandCorner() {
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      // Solo se muestra cuando estás arriba del todo (menos de 30px de scroll)
      setIsAtTop(window.scrollY < 30);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <aside
      aria-label="Logo Memento Mundi"
      className={`fixed left-3 top-3 z-[80] flex items-center gap-2.5 transition-all duration-300 sm:left-6 sm:top-5 ${
        isAtTop
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 -translate-y-4 pointer-events-none"
      }`}
    >
      <img
        src="/MEMENTO_LOGO.svg"
        alt="Logo Memento"
        className="h-9 w-9 sm:h-12 sm:w-12 object-contain drop-shadow-sm select-none"
      />
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5">
          <img
            src="/MEMENTO_FRASE.svg"
            alt="Memento"
            className="h-5 sm:h-7 w-auto object-contain select-none"
          />
          <span className="font-brand text-base sm:text-xl font-black text-orange leading-none">
            mundi
          </span>
        </div>
        <span className="font-mono text-[7px] sm:text-[8px] font-black uppercase tracking-[0.16em] text-ink/70">
          viaja. guarda. vuelve.
        </span>
      </div>
    </aside>
  );
}
