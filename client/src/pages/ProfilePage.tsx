import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, LogIn, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import ProfileForm, { type ProfileFormHandle } from "@/components/profile/ProfileForm";
import ProfileIdentity from "@/components/profile/ProfileIdentity";
import RewardsSection from "@/components/profile/RewardsSection";
import { AccountSection, AppSection, LegalSection, PrivacySection } from "@/components/profile/SettingsSections";
import StickersSection from "@/components/profile/StickersSection";
import EmptyState from "@/components/ui/EmptyState";
import Mascot from "@/components/ui/Mascot";
import { useSharedScrapbookLibrary } from "@/contexts/ScrapbookLibraryContext";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useProfile } from "@/hooks/useProfile";
import { preferencesStore } from "@/lib/app-preferences";
import { consent } from "@/lib/cookie-consent";
import { buildDataExport, clearLocalUserData, downloadJson } from "@/lib/data-export";

type NavItem = { id: string; label: string };

const SIGNED_IN_NAV: NavItem[] = [
  { id: "perfil", label: "Perfil" },
  { id: "recompensas", label: "Recompensas" },
  { id: "pegatinas", label: "Pegatinas" },
  { id: "privacidad", label: "Privacidad" },
  { id: "cuenta", label: "Cuenta" },
  { id: "app", label: "Preferencias" },
  { id: "legal", label: "Legal" },
];
const GUEST_NAV: NavItem[] = [
  { id: "app", label: "Preferencias" },
  { id: "legal", label: "Legal" },
];

const prefersReducedMotion = () => preferencesStore.get().reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  window.history.replaceState(null, "", `#${id}`);
}

/** Resalta en la navegación la sección visible. */
function useActiveSection(ids: string[], ready: boolean) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (!ready || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [ids, ready]);
  return active;
}

function SectionNav({ items, active, onSelect }: { items: NavItem[]; active: string; onSelect: (id: string) => void }) {
  return (
    <nav aria-label="Secciones del perfil" className="sticky top-0 z-30 -mx-4 border-b-2 border-ink/10 bg-[#EAE7DA]/92 px-4 py-2 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-8 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-1 lg:overflow-visible">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "true" : undefined}
              onClick={(event) => {
                event.preventDefault();
                onSelect(item.id);
              }}
              className={`flex min-h-10 items-center rounded-full border-2 px-4 text-xs font-black transition-colors lg:min-h-11 lg:rounded-xl lg:text-sm ${active === item.id ? "border-ink bg-ink text-cream" : "border-ink/15 bg-white/50 hover:border-ink lg:border-transparent lg:bg-transparent"}`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function ProfilePage() {
  const auth = useAppAuth();
  const [, setLocation] = useLocation();
  const library = useSharedScrapbookLibrary();
  const controller = useProfile(auth.isAuthenticated ? auth.user : null, auth.provider);
  const { bundle } = controller;
  const formRef = useRef<ProfileFormHandle>(null);
  // La edición de datos empieza plegada: solo se despliega con su botón o con "Editar perfil".
  const [editOpen, setEditOpen] = useState(false);

  const signedIn = auth.isAuthenticated && !!auth.user;
  const navItems = signedIn ? SIGNED_IN_NAV : GUEST_NAV;
  const ids = useMemo(() => navItems.map((item) => item.id), [navItems]);
  const ready = !auth.loading && (!signedIn || !!bundle);
  const active = useActiveSection(ids, ready);

  useEffect(() => {
    document.title = "Perfil · Memento Mundi";
  }, []);

  // Enlaces directos (p. ej. /perfil#legal desde las páginas legales).
  useEffect(() => {
    if (!ready) return;
    const hash = window.location.hash.slice(1);
    if (hash === "perfil") setEditOpen(true);
    if (hash && ids.includes(hash)) window.requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
  }, [ids, ready]);

  const exportData = useCallback(() => {
    if (!bundle || !auth.user) return;
    const data = buildDataExport({
      user: auth.user,
      provider: auth.provider,
      bundle,
      scrapbooks: library.scrapbooks,
      cookieConsent: consent.get(),
      preferences: preferencesStore.get(),
    });
    downloadJson(data, `memento-mundi-mis-datos-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success("Descarga preparada.");
  }, [auth.provider, auth.user, bundle, library.scrapbooks]);

  const signOut = async (scope: "local" | "global" = "local") => {
    await auth.signOut(scope);
    setLocation("/");
    toast.success(scope === "global" ? "Sesión cerrada en todos los dispositivos." : "Sesión cerrada.");
  };

  const deleteAccount = async () => {
    const result = await controller.deleteAccount();
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    clearLocalUserData();
    await auth.signOut();
    setLocation("/");
    toast.success("Tu cuenta se ha eliminado. Gracias por viajar con nosotros.");
    return true;
  };

  const editProfile = () => {
    setEditOpen(true);
    scrollToSection("perfil");
    window.setTimeout(() => formRef.current?.focus(), prefersReducedMotion() ? 0 : 450);
  };

  const shell = (content: React.ReactNode) => (
    <main className="min-h-screen overflow-x-clip bg-[#EAE7DA] px-4 pb-36 pt-24 sm:px-8 sm:pt-28 lg:px-12">
      <div className="mx-auto max-w-6xl">{content}</div>
    </main>
  );

  // Sin perfil y sin error todavía = cargando (evita un parpadeo de error al terminar la sesión de cargar).
  if (auth.loading || (signedIn && !bundle && (controller.loading || !controller.error))) {
    return shell(
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm font-black uppercase tracking-[.16em] text-ink/55" aria-busy="true">
        <Loader2 className="animate-spin" size={24} /> Cargando tu perfil…
      </div>,
    );
  }

  const settingsColumn = (sections: React.ReactNode) => (
    // En móvil es un bloque (la barra sticky recorre todas las secciones); en escritorio, rejilla con índice lateral.
    <div className="mt-6 lg:mt-8 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
      <SectionNav items={navItems} active={active} onSelect={(id) => (id === "perfil" ? editProfile() : scrollToSection(id))} />
      <div className="mt-4 min-w-0 space-y-6 lg:mt-0">{sections}</div>
    </div>
  );

  if (!signedIn) {
    return shell(
      <>
        <section className="flex flex-col items-center rounded-[1.75rem] border-2 border-ink bg-white/70 p-6 text-center shadow-hard sm:rounded-[2rem] sm:p-10">
          <Mascot name="03b-perfil-usuario" size="md" mobileSize="sm" priority />
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-orange">Tu pasaporte digital</p>
          <h1 className="mt-2 !text-[clamp(2.3rem,7vw,4.5rem)]">Entra para ver tu perfil.</h1>
          <p className="mt-4 max-w-md text-base font-medium leading-relaxed text-ink/65">Edita tus datos, consulta tus pegatinas y consigue recompensas por compartir tus viajes.</p>
          <button type="button" onClick={auth.openLogin} className="mt-6 flex min-h-12 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-6 text-sm font-black shadow-hard-sm transition-transform hover:-translate-y-0.5">
            <LogIn size={17} /> Iniciar sesión
          </button>
        </section>
        {settingsColumn(
          <>
            <AppSection />
            <LegalSection />
          </>,
        )}
      </>,
    );
  }

  if (!bundle) {
    return shell(
      <>
        <EmptyState
          mascot="24-offline-sin-wifi"
          mascotAlt="Sin conexión"
          title="No pudimos cargar tu perfil."
          description={controller.error ?? "Revisa tu conexión e inténtalo de nuevo."}
          action={{ label: "Reintentar", onClick: () => void controller.reload(), icon: <RotateCcw size={16} /> }}
          secondaryAction={{ label: "Cerrar sesión", onClick: () => void signOut() }}
        />
        {settingsColumn(<LegalSection />)}
      </>,
    );
  }

  const { profile } = bundle;

  return shell(
    <>
      <ProfileIdentity
        profile={profile}
        email={auth.user?.email ?? null}
        onEdit={editProfile}
        stats={[
          { label: "Scrapbooks", value: library.scrapbooks.length },
          { label: "Pegatinas", value: bundle.stickers.length },
          { label: "Puntos", value: profile.ugcPoints },
        ]}
      />
      {settingsColumn(
        <>
          <ProfileForm ref={formRef} profile={profile} controller={controller} open={editOpen} onToggle={() => setEditOpen((value) => !value)} />
          <RewardsSection points={profile.ugcPoints} claims={bundle.claims} controller={controller} />
          <StickersSection stickers={bundle.stickers} />
          <PrivacySection
            isPrivate={profile.isPrivate}
            settings={bundle.settings}
            features={bundle.features}
            onPrivateChange={async (isPrivate) => {
              const result = await controller.saveProfile({ isPrivate });
              if (!result.ok) toast.error(result.message);
              return result.ok;
            }}
            onSettingsChange={async (settings) => {
              const result = await controller.saveSettings(settings);
              if (!result.ok) toast.error(result.message);
              return result.ok;
            }}
          />
          <AccountSection
            email={auth.user?.email ?? null}
            canSignOutEverywhere={auth.provider === "supabase"}
            onSignOut={() => signOut("local")}
            onSignOutEverywhere={() => signOut("global")}
            onExport={exportData}
            onDelete={deleteAccount}
          />
          <AppSection />
          <LegalSection />
        </>,
      )}
    </>,
  );
}
