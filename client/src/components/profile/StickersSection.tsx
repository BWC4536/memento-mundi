import { ArrowUpRight, QrCode, ShoppingBag } from "lucide-react";
import { useLocation } from "wouter";
import EmptyState from "@/components/ui/EmptyState";
import type { LinkedSticker } from "@/lib/profile";
import { Section } from "./ProfileUi";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

/** Pegatinas NFC/QR vinculadas a la cuenta y el scrapbook que abre cada una. */
export default function StickersSection({ stickers }: { stickers: LinkedSticker[] }) {
  const [, setLocation] = useLocation();
  const scan = () => setLocation("/?scan=1");

  return (
    <Section
      id="pegatinas"
      eyebrow="Pegatinas vinculadas"
      title="Tus llaves físicas."
      description="Cada pegatina abre el scrapbook al que está vinculada al acercar el móvil o escanear su QR."
      action={
        stickers.length > 0 ? (
          <button type="button" onClick={scan} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-cream px-4 text-sm font-black">
            <QrCode size={16} /> Vincular otra
          </button>
        ) : undefined
      }
    >
      {stickers.length === 0 ? (
        <EmptyState
          mascot="28-pegatina-despegar"
          mascotSize="sm"
          title="Aún no hay pegatinas."
          description="Escanea la pegatina de tu pack para vincularla a un scrapbook."
          action={{ label: "Escanear pegatina", onClick: scan, icon: <QrCode size={17} /> }}
          secondaryAction={{ label: "Ver packs", onClick: () => setLocation("/store"), icon: <ShoppingBag size={16} /> }}
        />
      ) : (
        <ul className="grid gap-3 min-[520px]:grid-cols-2 xl:grid-cols-3">
          {stickers.map((sticker) => (
            <li key={sticker.id} className="flex flex-col rounded-2xl border-2 border-ink bg-cream/70 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-ink bg-orange">
                  {sticker.imageUrl ? <img src={sticker.imageUrl} alt="" className="h-full w-full object-cover" /> : <QrCode size={22} />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-black">{sticker.title}</p>
                  <p className="text-xs font-bold text-ink/55">{sticker.unlockedAt ? `Activada el ${formatDate(sticker.unlockedAt)}` : "Sin activar"}</p>
                </div>
              </div>
              {sticker.scrapbookId ? (
                <button
                  type="button"
                  onClick={() => setLocation(`/?scrapbook=${encodeURIComponent(sticker.scrapbookId!)}`)}
                  className="mt-4 flex min-h-11 items-center justify-between gap-2 rounded-xl border-2 border-ink bg-white/80 px-3 text-left text-sm font-black transition-colors hover:bg-orange"
                >
                  <span className="truncate">{sticker.scrapbookTitle ?? "Abrir scrapbook"}</span>
                  <ArrowUpRight size={16} className="shrink-0" />
                </button>
              ) : (
                <p className="mt-4 rounded-xl border-2 border-dashed border-ink/30 px-3 py-2.5 text-sm font-bold text-ink/55">Sin scrapbook vinculado</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
