import { UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useProfileSummary } from "@/hooks/useProfile";

/**
 * Cabecera global (se pinta una vez en App, en todas las páginas).
 * Va en `absolute`, así forma parte del flujo: se ve arriba y se va con el scroll.
 * Usa el mismo contenedor que las páginas (max-w-7xl + padding) para que el
 * logo (izquierda) y el usuario (derecha) se alineen con el contenido, no con el borde.
 * Cerrar sesión vive en Perfil › Ajustes.
 */
export default function SiteHeader() {
  const auth = useAppAuth();
  const [, setLocation] = useLocation();
  const profile = useProfileSummary(auth.isAuthenticated ? auth.user : null, auth.provider);
  const firstName = auth.user?.name?.split(" ")[0];
  const label = profile?.username ? `@${profile.username}` : firstName ?? "Perfil";
  const avatarUrl = profile?.avatarUrl ?? null;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-[80]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 pt-3 sm:px-8 sm:pt-5 lg:px-12">
        <Link href="/" aria-label="Memento Mundi, ir a inicio" className="pointer-events-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <img src="/MEMENTO_LOGO.svg" alt="" className="h-10 w-10 shrink-0 select-none object-contain drop-shadow-sm sm:h-14 sm:w-14" draggable={false} />
          <span className="hidden min-w-0 items-end gap-1.5 min-[380px]:flex">
            <img src="/MEMENTO_FRASE.svg" alt="Memento" className="h-5 w-auto min-w-0 select-none object-contain sm:h-7" draggable={false} />
            <img src="/Mundi_bola.svg" alt="Mundi" className="h-5 w-auto min-w-0 select-none object-contain sm:h-7" draggable={false} />
          </span>
        </Link>

        <div className="pointer-events-auto flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => (auth.isAuthenticated ? setLocation("/perfil") : auth.openLogin())}
            aria-label={auth.isAuthenticated ? "Ir a tu perfil" : "Entrar"}
            className="flex items-center gap-2 rounded-full border-2 border-ink bg-white/60 px-2 py-1.5 text-xs font-black uppercase tracking-[0.1em] transition-transform hover:-translate-y-0.5 active:scale-[.97] sm:px-3 sm:py-2"
          >
            <span className={`hidden max-w-[12rem] truncate sm:inline ${auth.isAuthenticated && profile?.username ? "normal-case tracking-normal" : ""}`}>{auth.isAuthenticated ? label : "Entrar"}</span>
            {auth.isAuthenticated && avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" draggable={false} />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-cream">
                <UserRound size={15} />
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
