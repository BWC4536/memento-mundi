import { useState } from "react";
import { ChevronRight, Cookie, Download, FileText, Loader2, LogOut, MonitorSmartphone, Scale, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import BrandDialog from "@/components/ui/BrandDialog";
import BrandSwitch from "@/components/ui/BrandSwitch";
import Mascot from "@/components/ui/Mascot";
import { setAppPreference, useAppPreferences } from "@/lib/app-preferences";
import { openCookiePreferences, useCookieConsent } from "@/lib/cookie-consent";
import { LEGAL_LIST } from "@/lib/legal";
import type { UserSettings } from "@/lib/profile";
import { ActionRow, Section } from "./ProfileUi";

const chevron = <ChevronRight size={18} className="shrink-0 text-ink/40" />;

/* ------------------------------------------------------------------ */
/* Privacidad                                                          */
/* ------------------------------------------------------------------ */

export function PrivacySection({
  isPrivate,
  settings,
  features,
  onPrivateChange,
  onSettingsChange,
}: {
  isPrivate: boolean;
  settings: UserSettings;
  features: { privacy: boolean; settings: boolean };
  onPrivateChange: (value: boolean) => Promise<boolean>;
  onSettingsChange: (settings: UserSettings) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState<"private" | "marketing" | null>(null);
  const unavailable = "Aún no disponible.";

  return (
    <Section id="privacidad" eyebrow="Privacidad" title="Tú decides qué se ve." description="Controla quién ve tu perfil y qué te enviamos.">
      <div className="divide-y-2 divide-ink/10">
        <BrandSwitch
          checked={isPrivate}
          disabled={!features.privacy || busy === "private"}
          onChange={async (value) => {
            setBusy("private");
            if (await onPrivateChange(value)) toast.success(value ? "Tu perfil ahora es privado." : "Tu perfil ahora es público.");
            setBusy(null);
          }}
          label="Perfil privado"
          description={features.privacy ? "Solo tú verás tu nombre, foto, biografía y redes. Tus scrapbooks mantienen su propia visibilidad." : unavailable}
        />
        <BrandSwitch
          checked={settings.marketingOptIn}
          disabled={!features.settings || busy === "marketing"}
          onChange={async (value) => {
            setBusy("marketing");
            const ok = await onSettingsChange({ marketingOptIn: value, marketingOptInAt: value ? new Date().toISOString() : null });
            if (ok) toast.success(value ? "Te escribiremos de vez en cuando." : "No te enviaremos novedades.");
            setBusy(null);
          }}
          label="Novedades por email"
          description={features.settings ? "Nuevos packs, funciones e ideas de viaje. Puedes darte de baja cuando quieras." : unavailable}
        />
      </div>
      <div className="mt-2 border-t-2 border-ink/10 pt-2">
        <ActionRow icon={<Cookie size={17} />} title="Cookies" description="Revisa o cambia tu elección." onClick={openCookiePreferences} trailing={chevron} />
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Cuenta y sesión                                                     */
/* ------------------------------------------------------------------ */

export function AccountSection({
  email,
  canSignOutEverywhere,
  onSignOut,
  onSignOutEverywhere,
  onExport,
  onDelete,
}: {
  email: string | null;
  canSignOutEverywhere: boolean;
  onSignOut: () => Promise<void>;
  onSignOutEverywhere: () => Promise<void>;
  onExport: () => void;
  onDelete: () => Promise<boolean>;
}) {
  const [dialog, setDialog] = useState<"everywhere" | "delete" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmed = confirmText.trim().toUpperCase() === "ELIMINAR";

  const close = () => {
    if (busy) return;
    setDialog(null);
    setConfirmText("");
  };

  return (
    <Section id="cuenta" eyebrow="Cuenta y sesión" title="Tu acceso.">
      <div className="rounded-2xl border-2 border-ink bg-cream/70 p-4">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-ink/55">Email de acceso</p>
        <p className="mt-1 break-all text-lg font-black">{email ?? "Sin email"}</p>
        <p className="mt-1 text-sm font-medium text-ink/55">Entras con un código que te enviamos aquí. No hay contraseña que recordar.</p>
      </div>

      <div className="mt-3 divide-y-2 divide-ink/10">
        <ActionRow icon={<LogOut size={17} />} title="Cerrar sesión" description="Solo en este dispositivo." onClick={() => void onSignOut()} trailing={chevron} />
        {canSignOutEverywhere ? <ActionRow icon={<MonitorSmartphone size={17} />} title="Cerrar sesión en todos los dispositivos" description="Útil si has perdido un móvil o usaste un ordenador ajeno." onClick={() => setDialog("everywhere")} trailing={chevron} /> : null}
        <ActionRow icon={<Download size={17} />} title="Descargar mis datos" description="Un archivo JSON con tu perfil, scrapbooks, pegatinas y solicitudes." onClick={onExport} trailing={chevron} />
        <ActionRow icon={<Trash2 size={17} />} tone="danger" title="Eliminar cuenta" description="Borra tu perfil, tus scrapbooks y tus fotos para siempre." onClick={() => setDialog("delete")} trailing={chevron} />
      </div>

      <BrandDialog open={dialog === "everywhere"} onClose={close} title="¿Cerrar todas las sesiones?" description="Tendrás que volver a entrar con un código en cada dispositivo, también en este." media={<Mascot name="02-adios-logout" size="sm" />}>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={close} className="min-h-12 rounded-xl border-2 border-ink bg-white/70 px-4 text-sm font-black">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSignOutEverywhere();
              setBusy(false);
              setDialog(null);
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-orange px-4 text-sm font-black shadow-hard-sm disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Cerrar todas
          </button>
        </div>
      </BrandDialog>

      <BrandDialog
        open={dialog === "delete"}
        onClose={close}
        title="¿Eliminar tu cuenta?"
        media={<Mascot name="35-borrar-papelera" size="sm" />}
        description="Se borrarán tu perfil, tus scrapbooks, tus fotos, tus pegatinas vinculadas y tus solicitudes de recompensa. No se puede deshacer."
      >
        <button type="button" onClick={onExport} className="mt-4 flex min-h-11 items-center gap-2 text-sm font-black underline underline-offset-2">
          <Download size={16} /> Descargar antes una copia
        </button>
        <label className="mt-4 block text-xs font-black uppercase tracking-wider">
          Escribe ELIMINAR para confirmar
          <input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-xl border-2 border-ink bg-white/80 px-4 py-3 text-[17px] font-black tracking-[.2em] outline-none focus:ring-4 focus:ring-orange/40"
          />
        </label>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={close} className="min-h-12 rounded-xl border-2 border-ink bg-white/70 px-4 text-sm font-black">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!confirmed || busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onDelete();
              setBusy(false);
              if (ok) {
                setDialog(null);
                setConfirmText("");
              }
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-[#b44728] px-4 text-sm font-black text-cream disabled:opacity-40"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Eliminar para siempre
          </button>
        </div>
      </BrandDialog>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Preferencias de la app                                              */
/* ------------------------------------------------------------------ */

export function AppSection() {
  const preferences = useAppPreferences();
  return (
    <Section id="app" eyebrow="Preferencias" title="La app, a tu manera." description="Se guardan en este dispositivo.">
      <div className="divide-y-2 divide-ink/10">
        <BrandSwitch checked={preferences.reduceMotion} onChange={(value) => setAppPreference("reduceMotion", value)} label="Reducir animaciones" description="Quita transiciones y efectos de movimiento." />
        <BrandSwitch checked locked onChange={() => undefined} label="Idioma: español" description="Por ahora, la app solo está en español." />
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Legal                                                               */
/* ------------------------------------------------------------------ */

const LEGAL_ICONS = { privacidad: ShieldCheck, terminos: Scale, cookies: FileText } as const;

export function LegalSection() {
  const decision = useCookieConsent();
  const cookieSummary = !decision ? "Aún no has elegido." : decision.analytics || decision.marketing ? "Has aceptado cookies opcionales." : "Solo las necesarias.";
  return (
    <Section id="legal" eyebrow="Legal" title="Lo importante, claro." description="Cómo tratamos tus datos y las reglas del juego.">
      <div className="divide-y-2 divide-ink/10">
        {LEGAL_LIST.map((doc) => {
          const Icon = LEGAL_ICONS[doc.slug];
          return <ActionRow key={doc.slug} icon={<Icon size={17} />} title={doc.title} description={doc.summary} href={doc.path} trailing={chevron} />;
        })}
        <ActionRow icon={<Cookie size={17} />} title="Configurar cookies" description={cookieSummary} onClick={openCookiePreferences} trailing={chevron} />
      </div>
    </Section>
  );
}
