import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ScrapbookComposition } from "@/lib/composition";

type Props = {
  composition: ScrapbookComposition;
  title: string;
  className?: string;
  /** Solo icono (para barras estrechas). */
  compact?: boolean;
};

/** Descarga el cuaderno como imagen JPEG. El generador se carga solo al pulsar. */
export default function DownloadImageButton({ composition, title, className = "", compact = false }: Props) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { downloadCompositionJpeg } = await import("@/lib/export-composition");
      const { missingImages } = await downloadCompositionJpeg(composition, title);
      if (missingImages > 0) toast.warning(`Imagen descargada, pero ${missingImages} ${missingImages === 1 ? "foto no se pudo" : "fotos no se pudieron"} incluir.`);
      else toast.success("Imagen descargada.");
    } catch {
      toast.error("No se pudo crear la imagen. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={() => void download()} disabled={busy} aria-busy={busy} aria-label="Descargar como imagen JPEG" title="Descargar como imagen (JPEG)" className={className}>
      {busy ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
      {compact ? null : <span>{busy ? "Creando…" : "Descargar"}</span>}
    </button>
  );
}
