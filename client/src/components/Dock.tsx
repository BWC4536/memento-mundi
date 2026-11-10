import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useRef, type ReactNode } from "react";

export type DockItem = { icon: ReactNode; label: string; onClick: () => void; accent?: boolean };

type DockProps = { items: DockItem[]; panelHeight?: number; baseItemSize?: number; magnification?: number };

function DockIcon({ item, mouseX, baseItemSize, magnification }: { item: DockItem; mouseX: MotionValue<number>; baseItemSize: number; magnification: number }) {
  const ref = useRef<HTMLButtonElement>(null);
  const distance = useTransform(mouseX, (value) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds || value === Infinity) return 9999;
    return value - bounds.left - bounds.width / 2;
  });
  const targetWidth = useTransform(distance, [-150, -60, 0, 60, 150], [baseItemSize, baseItemSize + 10, magnification, baseItemSize + 10, baseItemSize]);
  const width = useSpring(targetWidth, { mass: 0.12, stiffness: 220, damping: 16 });
  const y = useTransform(distance, [-100, 0, 100], [0, -4, 0]);

  return (
    <motion.button ref={ref} type="button" aria-label={item.label} onClick={item.onClick} style={{ width, height: baseItemSize, y }} className={`dock-item group relative flex shrink-0 items-center justify-center rounded-2xl border-2 border-ink transition-colors ${item.accent ? "bg-orange" : "bg-cream"}`}>
      {item.icon}
      <span className="pointer-events-none absolute -top-10 rounded-full border-2 border-ink bg-ink px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cream opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{item.label}</span>
    </motion.button>
  );
}

export default function Dock({ items, panelHeight = 68, baseItemSize = 50, magnification = 70 }: DockProps) {
  const mouseX = useMotionValue(Infinity);
  return (
    <motion.nav aria-label="Navegación principal" onMouseMove={(event) => mouseX.set(event.clientX)} onMouseLeave={() => mouseX.set(Infinity)} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.35 }} style={{ height: panelHeight }} className="dock-panel flex max-w-full items-center gap-1.5 rounded-[24px] border-2 border-ink bg-white/90 px-2 shadow-hard backdrop-blur-md sm:gap-2 sm:rounded-[26px] sm:px-3">
      {items.map((item) => <DockIcon key={item.label} item={item} mouseX={mouseX} baseItemSize={baseItemSize} magnification={magnification} />)}
    </motion.nav>
  );
}
