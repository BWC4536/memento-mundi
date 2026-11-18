import { useEffect, useSyncExternalStore } from "react";

/**
 * Modo inmersivo global: mientras el editor o el visor a pantalla completa
 * están abiertos, el Dock de navegación se oculta y el scroll del body se
 * bloquea para que no tape los controles.
 */
let activeCount = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useImmersiveMode(active: boolean) {
  useEffect(() => {
    if (!active) return;
    activeCount += 1;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    emit();
    return () => {
      activeCount = Math.max(0, activeCount - 1);
      if (activeCount === 0) root.style.overflow = previous === "hidden" ? "" : previous;
      emit();
    };
  }, [active]);
}

export function useIsImmersive() {
  return useSyncExternalStore(subscribe, () => activeCount > 0, () => false);
}
