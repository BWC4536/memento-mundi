import { useLocation } from "wouter";
import PillNav, { type PillNavLink } from "@/components/home/PillNav";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useIsImmersive } from "@/lib/immersive";

/**
 * Barra superior de móvil y tablet en todas las rutas (en escritorio no se pinta: allí siguen
 * el lockup de la esquina y las cabeceras de cada página).
 * La intro de la tienda (z-90, pantalla completa) la tapa mientras dura; al terminar, vuelve a verse.
 * El editor y la vista a pantalla completa la ocultan, igual que el dock.
 */
export default function MobileNav() {
  const [, setLocation] = useLocation();
  const immersive = useIsImmersive();
  const auth = useAppAuth();
  if (immersive) return null;

  const links: PillNavLink[] = [
    { label: "Inicio", href: "/" },
    { label: "Tienda", href: "/store" },
    { label: "Explorar", href: "/explore" },
  ];
  if (auth.isAuthenticated) links.push({ label: "Perfil", href: "/perfil" });

  return (
    <PillNav
      links={links}
      cta={auth.isAuthenticated ? { label: "Mis scrapbooks", onClick: () => setLocation("/") } : { label: "Ir a la tienda", onClick: () => setLocation("/store") }}
      accountLabel={auth.isAuthenticated ? "Mi perfil" : "Iniciar sesión"}
      onAccount={() => (auth.isAuthenticated ? setLocation("/perfil") : auth.openLogin())}
      onSignOut={auth.isAuthenticated ? () => void auth.signOut() : undefined}
    />
  );
}
