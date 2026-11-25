import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cookie } from "lucide-react";
import { Link } from "wouter";
import BrandDialog from "@/components/ui/BrandDialog";
import BrandSwitch from "@/components/ui/BrandSwitch";
import {
  closeCookiePreferences,
  consent,
  COOKIE_CATEGORIES,
  openCookiePreferences,
  useCookieConsent,
  useCookiePreferencesOpen,
  type ConsentChoice,
} from "@/lib/cookie-consent";
import { useIsImmersive } from "@/lib/immersive";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

/** Aviso de cookies (primera visita) y panel de preferencias (se abre desde cualquier sitio). */
export default function CookieConsent() {
  const decision = useCookieConsent();
  const open = useCookiePreferencesOpen();
  const immersive = useIsImmersive();
  const [choice, setChoice] = useState<ConsentChoice>({ analytics: false, marketing: false });

  // Al abrir el panel partimos de la decisión guardada.
  useEffect(() => {
    if (open) setChoice({ analytics: decision?.analytics ?? false, marketing: decision?.marketing ?? false });
  }, [open, decision]);

  const save = (next: ConsentChoice) => {
    consent.decide(next);
    closeCookiePreferences();
  };

  const showBanner = !decision && !open && !immersive;

  return (
    <>
      <AnimatePresence>
        {showBanner ? (
          <motion.section
            key="cookie-banner"
            role="region"
            aria-label="Aviso de cookies"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.25rem)] z-[85] mx-auto max-w-xl rounded-[1.5rem] border-2 border-ink bg-cream p-4 text-ink shadow-hard sm:bottom-28 sm:p-5"
          >
            <div className="flex items-start gap-3">
              <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-orange min-[400px]:flex">
                <Cookie size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-base font-black leading-tight">Solo usamos lo necesario.</p>
                <p className="mt-1 text-sm font-medium leading-snug text-ink/65">
                  Guardamos tu sesión y tus borradores en este navegador. No usamos analítica ni publicidad; si algún día lo hacemos, será solo con tu permiso.{" "}
                  <Link href="/cookies" className="font-black underline underline-offset-2">
                    Política de cookies
                  </Link>
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
              <button type="button" onClick={openCookiePreferences} className="col-span-2 min-h-11 rounded-xl px-3 text-sm font-black underline underline-offset-2 sm:col-span-1 sm:mr-auto">
                Configurar
              </button>
              <button type="button" onClick={consent.rejectAll} className="min-h-11 rounded-xl border-2 border-ink bg-white/70 px-4 text-sm font-black">
                Rechazar
              </button>
              <button type="button" onClick={consent.acceptAll} className="min-h-11 rounded-xl border-2 border-ink bg-white/70 px-4 text-sm font-black">
                Aceptar
              </button>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <BrandDialog
        open={open}
        onClose={closeCookiePreferences}
        size="lg"
        title="Preferencias de cookies"
        description={
          <>
            Elige qué permites. Puedes cambiarlo cuando quieras desde Perfil › Legal.{" "}
            <Link href="/cookies" onClick={closeCookiePreferences} className="font-black text-ink underline underline-offset-2">
              Ver política
            </Link>
          </>
        }
      >
        <div className="mt-4 divide-y-2 divide-ink/10 border-y-2 border-ink/10">
          {COOKIE_CATEGORIES.map((category) =>
            category.required ? (
              <BrandSwitch key={category.id} checked locked onChange={() => undefined} label={category.title} description={category.description} />
            ) : (
              <BrandSwitch
                key={category.id}
                checked={choice[category.id as keyof ConsentChoice]}
                onChange={(value) => setChoice((current) => ({ ...current, [category.id]: value }))}
                label={category.title}
                description={category.description}
              />
            ),
          )}
        </div>
        {decision ? <p className="mt-3 text-xs font-bold text-ink/50">Última elección: {formatDate(decision.decidedAt)}.</p> : null}
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => save({ analytics: false, marketing: false })} className="min-h-12 rounded-xl border-2 border-ink bg-white/70 px-4 text-sm font-black">
            Rechazar todas
          </button>
          <button type="button" onClick={() => save({ analytics: true, marketing: true })} className="min-h-12 rounded-xl border-2 border-ink bg-white/70 px-4 text-sm font-black">
            Aceptar todas
          </button>
          <button type="button" onClick={() => save(choice)} className="min-h-12 rounded-xl border-2 border-ink bg-orange px-4 text-sm font-black shadow-hard-sm">
            Guardar elección
          </button>
        </div>
      </BrandDialog>
    </>
  );
}
