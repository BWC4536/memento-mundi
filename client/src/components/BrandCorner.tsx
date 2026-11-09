export default function BrandCorner() {
  return <div className="pointer-events-none fixed left-4 top-4 z-[80] w-32 sm:left-6 sm:top-5 sm:w-44">
    <img
      src="/manus-storage/MEMENTO_FRASE_CROPPED_7d1f737d.png"
      alt="Memento"
      className="h-auto w-full"
    />
    <div className="-mt-1 text-center">
      <p className="font-display text-base leading-none text-orange sm:text-lg">mundi</p>
      <p className="mt-1 font-mono text-[7px] font-black uppercase tracking-[.16em] text-ink/60 sm:text-[8px]">viaja. guarda. vuelve.</p>
    </div>
  </div>;
}
