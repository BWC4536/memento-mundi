import { useState } from "react";
import { ExternalLink, Instagram, Loader2, Music2, Send } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import Mascot from "@/components/ui/Mascot";
import type { ProfileController } from "@/hooks/useProfile";
import { rewardLabel, STATUS_LABELS, validateProofUrl, type UgcClaim, type UgcPlatform, type UgcStatus } from "@/lib/profile";
import { Field, Section } from "./ProfileUi";

const STATUS_STYLES: Record<UgcStatus, string> = {
  pending: "bg-cream",
  approved: "bg-[#cbd8d1]",
  rejected: "bg-[#f2c5a0]",
};

const PLATFORMS: Array<{ id: UgcPlatform; label: string; icon: typeof Instagram }> = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "tiktok", label: "TikTok", icon: Music2 },
];

const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "");
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

const STEPS = [
  { title: "Publica", text: "Sube a tu cuenta pública un post o vídeo con tu scrapbook o tu pegatina." },
  { title: "Envía el enlace", text: "Pégalo aquí. Lo revisamos a mano." },
  { title: "Recibe tu imán", text: "Si se aprueba, te lo enviamos y sumas puntos." },
];

/** Recompensas por contenido generado por el usuario (UGC). */
export default function RewardsSection({ points, claims, controller }: { points: number; claims: UgcClaim[]; controller: ProfileController }) {
  const [platform, setPlatform] = useState<UgcPlatform>("instagram");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const checked = validateProofUrl(url, platform);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    if (claims.some((claim) => claim.proofUrl === checked.url)) {
      setError("Ya enviaste este enlace.");
      return;
    }
    setSending(true);
    const result = await controller.submitClaim(platform, checked.url);
    setSending(false);
    if (result.ok) {
      setUrl("");
      setError(undefined);
      toast.success("¡Recibido! Te avisaremos cuando lo revisemos.");
    } else setError(result.message);
  };

  return (
    <Section
      id="recompensas"
      eyebrow="Recompensas UGC"
      title="Comparte y gana."
      description="Enséñanos tus viajes en redes y te regalamos un imán por cada publicación aprobada."
      action={<Mascot name="29-regalo" size="sm" className="hidden sm:block" />}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,14rem)_1fr]">
        <div className="flex items-center gap-4 rounded-2xl border-2 border-ink bg-ink p-5 text-cream lg:flex-col lg:items-start lg:justify-between">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-orange">Tus puntos</p>
          <p className="ml-auto font-display text-6xl leading-none lg:ml-0">{points}</p>
          <p className="hidden text-sm font-medium text-cream/70 lg:block">Se suman con cada publicación aprobada.</p>
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border-2 border-ink bg-cream/70 p-4">
              <span className="font-mono text-2xl text-orange">{String(index + 1).padStart(2, "0")}</span>
              <p className="mt-1 text-base font-black">{step.title}</p>
              <p className="mt-1 text-sm font-medium leading-snug text-ink/60">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <form
        noValidate
        className="mt-6 rounded-2xl border-2 border-ink bg-white/70 p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div role="radiogroup" aria-label="Red social" className="grid grid-cols-2 gap-2 sm:w-fit">
          {PLATFORMS.map((item) => {
            const Icon = item.icon;
            const active = platform === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setPlatform(item.id);
                  setError(undefined);
                }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-ink px-4 text-sm font-black ${active ? "bg-ink text-cream" : "bg-cream"}`}
              >
                <Icon size={16} /> {item.label}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <Field
              id="ugc-url"
              label="Enlace de la publicación"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              value={url}
              onChange={(value) => {
                setUrl(value);
                setError(undefined);
              }}
              error={error}
              placeholder={platform === "instagram" ? "instagram.com/p/…" : "tiktok.com/@usuario/video/…"}
            />
          </div>
          <button type="submit" disabled={sending} className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-orange px-5 text-sm font-black shadow-hard-sm disabled:opacity-60 sm:mt-6">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar
          </button>
        </div>
        <p className="mt-3 text-xs font-medium text-ink/55">
          Una recompensa por publicación. Consulta las{" "}
          <Link href="/terminos" className="font-black text-ink underline underline-offset-2">
            condiciones
          </Link>
          .
        </p>
      </form>

      <div className="mt-6">
        <h3 className="!text-xl">Tus solicitudes</h3>
        {claims.length === 0 ? (
          <p className="mt-2 text-sm font-medium text-ink/55">Aún no has enviado ninguna publicación.</p>
        ) : (
          <ul className="mt-3 divide-y-2 divide-ink/10 rounded-2xl border-2 border-ink bg-white/60">
            {claims.map((claim) => (
              <li key={claim.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-cream">
                    {claim.platform === "instagram" ? <Instagram size={15} /> : <Music2 size={15} />}
                  </span>
                  <div className="min-w-0">
                    <a href={claim.proofUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 text-sm font-black hover:underline">
                      <span className="truncate">{shortUrl(claim.proofUrl)}</span>
                      <ExternalLink size={13} className="shrink-0" />
                    </a>
                    <p className="text-xs font-medium text-ink/55">
                      {formatDate(claim.createdAt)} · {rewardLabel(claim.reward)}
                    </p>
                  </div>
                </div>
                <span className={`w-fit rounded-full border-2 border-ink px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] ${STATUS_STYLES[claim.status]}`}>{STATUS_LABELS[claim.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
