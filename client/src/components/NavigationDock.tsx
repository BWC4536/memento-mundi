import { useEffect, useMemo, useState } from "react";
import { Globe, Home, QrCode, ShoppingBag, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import Dock, { type DockItem } from "@/components/Dock";

/** Evento global: Home abre el escáner QR cuando lo recibe. */
export const SCAN_EVENT = "memento:scan";
/** Evento global: Home vuelve a la lista de scrapbooks cuando lo recibe. */
export const HOME_EVENT = "memento:home";

type Accent = "home" | "store" | "explore" | "profile";

const accentForPath = (path: string): Accent | undefined => {
  if (path === "/") return "home";
  if (path.startsWith("/store")) return "store";
  if (path.startsWith("/explore")) return "explore";
  if (path.startsWith("/profile")) return "profile";
  return undefined;
};

const useCompactDock = () => {
  const query = "(max-width: 479px)";
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return compact;
};

/** Dock único de la app: casa, tienda, QR, globo y perfil en todas las rutas. */
export default function NavigationDock() {
  const [location, setLocation] = useLocation();
  const accent = accentForPath(location);
  const compact = useCompactDock();
  const iconSize = compact ? 18 : 20;

  const items: DockItem[] = useMemo(() => [
    {
      icon: <Home size={iconSize} strokeWidth={2.6} />,
      label: "Casa",
      accent: accent === "home",
      onClick: () => {
        if (location === "/") window.dispatchEvent(new Event(HOME_EVENT));
        else setLocation("/");
      },
    },
    {
      icon: <ShoppingBag size={iconSize} strokeWidth={2.6} />,
      label: "Tienda",
      accent: accent === "store",
      onClick: () => setLocation("/store"),
    },
    {
      icon: <QrCode size={compact ? 22 : 25} strokeWidth={2.4} />,
      label: "Escanear",
      accent: true,
      onClick: () => {
        if (location === "/") window.dispatchEvent(new Event(SCAN_EVENT));
        else setLocation("/?scan=1");
      },
    },
    {
      icon: <Globe size={iconSize} strokeWidth={2.6} />,
      label: "Explorar",
      accent: accent === "explore",
      onClick: () => setLocation("/explore"),
    },
    {
      icon: <UserRound size={iconSize} strokeWidth={2.6} />,
      label: "Perfil",
      accent: accent === "profile",
      onClick: () => setLocation("/profile"),
    },
  ], [accent, compact, iconSize, location, setLocation]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-2 sm:bottom-5">
      <div className="pointer-events-auto max-w-full">
        <Dock
          items={items}
          panelHeight={compact ? 56 : 62}
          baseItemSize={compact ? 42 : 46}
          magnification={compact ? 42 : 64}
        />
      </div>
    </div>
  );
}
