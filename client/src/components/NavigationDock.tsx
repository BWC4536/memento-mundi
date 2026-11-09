import { useMemo } from "react";
import { Home, ShoppingBag, QrCode, Globe, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import Dock, { type DockItem } from "@/components/Dock";

interface NavigationDockProps {
  onScan?: () => void;
  accent?: "home" | "store" | "scan" | "explore" | "profile";
}

export default function NavigationDock({ onScan, accent }: NavigationDockProps) {
  const [location, setLocation] = useLocation();

  const currentAccent = accent || (
    location === "/" ? "home" :
    location === "/store" ? "store" :
    location === "/explore" ? "explore" :
    location === "/profile" ? "profile" : undefined
  );

  const items: DockItem[] = useMemo(() => [
    {
      icon: <Home size={20} strokeWidth={2.6} />,
      label: "Casa",
      accent: currentAccent === "home",
      onClick: () => setLocation("/"),
    },
    {
      icon: <ShoppingBag size={20} strokeWidth={2.6} />,
      label: "Tienda",
      accent: currentAccent === "store",
      onClick: () => setLocation("/store"),
    },
    {
      icon: <QrCode size={25} strokeWidth={2.4} />,
      label: "Escanear",
      accent: true, // El QR siempre lleva el acento naranja destacado en el centro
      onClick: () => {
        if (onScan) {
          onScan();
        } else {
          setLocation("/#scan");
        }
      },
    },
    {
      icon: <Globe size={20} strokeWidth={2.6} />,
      label: "Explorar",
      accent: currentAccent === "explore",
      onClick: () => setLocation("/explore"),
    },
    {
      icon: <UserRound size={20} strokeWidth={2.6} />,
      label: "Perfil",
      accent: currentAccent === "profile",
      onClick: () => setLocation("/profile"),
    },
  ], [currentAccent, location, setLocation, onScan]);

  return (
    <div className="fixed bottom-3 sm:bottom-5 left-0 z-40 flex w-full justify-center px-2 pointer-events-none">
      <div className="pointer-events-auto max-w-full">
        <Dock items={items} panelHeight={62} baseItemSize={46} magnification={64} />
      </div>
    </div>
  );
}

