import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Film, ImagePlus, Loader2, MapPin, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { describeSocialError, getSocialRepository } from "@/hooks/useSocial";
import { IMAGE_INPUT_ACCEPT, prepareImageForCanvas } from "@/lib/image-upload";
import { emitSocial } from "@/lib/social/sync";
import type { NewPostMedia, SocialPlace } from "@/lib/social/types";
import Sheet from "./Sheet";

export const MAX_POST_ITEMS = 10;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 90;
const CAPTION_LIMIT = 2200;
const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";

type Draft = { id: string; name: string; kind: "photo" | "video"; preview: string | null; status: "processing" | "ready" | "error"; error?: string; media?: NewPostMedia };

const isVideoFile = (file: File) => file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);

function readVideoMetadata(file: File) {
  return new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    video.src = url;
  });
}

async function prepareFile(file: File): Promise<{ media: NewPostMedia; preview: string }> {
  if (isVideoFile(file)) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error(`“${file.name}” pesa más de 50 MB.`);
    let meta;
    try {
      meta = await readVideoMetadata(file);
    } catch {
      throw new Error(`No se puede leer “${file.name}” en este navegador. Prueba con un MP4.`);
    }
    if (Number.isFinite(meta.duration) && meta.duration > MAX_VIDEO_SECONDS) throw new Error(`“${file.name}” dura más de ${MAX_VIDEO_SECONDS} segundos.`);
    const mimeType = file.type || (/\.mov$/i.test(file.name) ? "video/quicktime" : /\.webm$/i.test(file.name) ? "video/webm" : "video/mp4");
    return {
      media: { kind: "video", blob: file, mimeType, width: meta.width || null, height: meta.height || null, duration: Number.isFinite(meta.duration) ? Math.round(meta.duration * 10) / 10 : null },
      preview: URL.createObjectURL(file),
    };
  }
  // Fotos: se reducen y comprimen en el navegador (HEIC incluido) antes de subir.
  const prepared = await prepareImageForCanvas(file, { maxSide: 2048, quality: 0.86 });
  const blob = await (await fetch(prepared.src)).blob();
  return { media: { kind: "photo", blob, mimeType: prepared.mimeType, width: prepared.width, height: prepared.height, duration: null }, preview: prepared.src };
}

type Props = { places: SocialPlace[]; defaultPlaceId?: string | null; onClose: () => void; onPublished?: (postId: string) => void };

export default function ComposerSheet({ places, defaultPlaceId = null, onClose, onPublished }: Props) {
  const repo = getSocialRepository();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [caption, setCaption] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(defaultPlaceId);
  const [placeQuery, setPlaceQuery] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const selectedPlace = places.find((place) => place.id === placeId) ?? null;
  const filteredPlaces = useMemo(() => {
    const query = placeQuery.trim().toLowerCase();
    const list = query ? places.filter((place) => `${place.name} ${place.country}`.toLowerCase().includes(query)) : places;
    return list.filter((place) => place.id !== placeId).slice(0, 10);
  }, [placeId, placeQuery, places]);

  const ready = drafts.filter((draft) => draft.status === "ready" && draft.media);
  const processing = drafts.some((draft) => draft.status === "processing");
  const publishing = progress !== null;

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_POST_ITEMS - drafts.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) toast.message(`Máximo ${MAX_POST_ITEMS} fotos o vídeos por publicación.`);
    const created: Draft[] = picked.map((file, index) => ({ id: `${Date.now()}-${index}-${file.name}`, name: file.name, kind: isVideoFile(file) ? "video" : "photo", preview: null, status: "processing" }));
    setDrafts((current) => [...current, ...created]);
    picked.forEach((file, index) => {
      const id = created[index]!.id;
      prepareFile(file)
        .then(({ media, preview }) => {
          if (preview.startsWith("blob:")) objectUrls.current.push(preview);
          setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, status: "ready", media, preview } : draft)));
        })
        .catch((error: unknown) => {
          const message = error instanceof Error && error.message ? error.message : `No se pudo leer “${file.name}”.`;
          setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, status: "error", error: message } : draft)));
          toast.error(message);
        });
    });
  };

  const publish = async () => {
    if (!repo || ready.length === 0 || processing || publishing) return;
    setProgress({ done: 0, total: ready.length });
    try {
      const post = await repo.createPost({ caption, placeId, media: ready.map((draft) => draft.media!) }, (done, total) => setProgress({ done, total }));
      if (post) {
        emitSocial({ type: "post-created", post });
        onPublished?.(post.id);
      }
      toast.success(selectedPlace ? `Publicado en ${selectedPlace.name}.` : "¡Publicado!");
      onClose();
    } catch (error) {
      toast.error(describeSocialError(error));
      setProgress(null);
    }
  };

  return (
    <Sheet label="Nueva publicación" onClose={() => !publishing && onClose()} width="lg" layer="top">
      <div className="pr-10">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange">Comunidad</p>
        <h2 className="mt-1 font-display text-4xl font-black tracking-[-.01em]">Nueva publicación</h2>
      </div>

      <input ref={inputRef} type="file" multiple accept={`${IMAGE_INPUT_ACCEPT},${VIDEO_ACCEPT}`} className="hidden" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />

      {drafts.length === 0 ? (
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 flex w-full flex-col items-center justify-center gap-3 rounded-[1.5rem] border-2 border-dashed border-ink/40 bg-white/50 px-6 py-12 text-center transition-colors hover:border-ink hover:bg-white/80">
          <span className="flex gap-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink bg-orange shadow-hard-sm"><ImagePlus size={24} /></span>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink bg-[#CBD8D2] shadow-hard-sm"><Film size={24} /></span>
          </span>
          <span className="font-display text-2xl font-black">Elige fotos o vídeos</span>
          <span className="max-w-sm text-sm font-semibold text-ink/55">Hasta {MAX_POST_ITEMS} por publicación. Vídeos de hasta {MAX_VIDEO_SECONDS} s y 50 MB.</span>
        </button>
      ) : (
        <div className="mt-5 flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
          <AnimatePresence initial={false}>
            {drafts.map((draft, index) => (
              <motion.div key={draft.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative h-36 w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-ink bg-ink/10">
                {draft.status === "processing" ? (
                  <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-ink/50" size={20} aria-label="Preparando" /></div>
                ) : draft.status === "error" ? (
                  <div className="flex h-full items-center justify-center bg-[#f2c5a0] p-2 text-center text-[10px] font-black leading-tight">{draft.error}</div>
                ) : draft.kind === "video" ? (
                  <video src={draft.preview ?? undefined} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  <img src={draft.preview ?? undefined} alt="" className="h-full w-full object-cover" />
                )}
                {index === 0 && draft.status === "ready" ? <span className="absolute left-1.5 top-1.5 rounded-full border-2 border-ink bg-orange px-1.5 text-[9px] font-black uppercase">Portada</span> : null}
                {draft.kind === "video" && draft.status === "ready" ? <Film size={14} className="absolute bottom-2 left-2 text-cream drop-shadow" aria-hidden /> : null}
                <button type="button" disabled={publishing} onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))} aria-label={`Quitar ${draft.name}`} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-cream">
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {drafts.length < MAX_POST_ITEMS ? (
            <button type="button" disabled={publishing} onClick={() => inputRef.current?.click()} className="flex h-36 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-ink/40 text-xs font-black text-ink/60 hover:border-ink hover:text-ink">
              <ImagePlus size={20} /> Añadir
            </button>
          ) : null}
        </div>
      )}

      <label className="mt-5 block">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/55">Pie de foto</span>
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value.slice(0, CAPTION_LIMIT))}
          rows={3}
          placeholder="¿Qué pasó aquí? Usa #etiquetas y @menciones…"
          className="mt-1.5 w-full resize-none rounded-2xl border-2 border-ink bg-white/70 p-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-orange/40"
        />
        <span className="block text-right text-[10px] font-bold text-ink/40">{caption.length}/{CAPTION_LIMIT}</span>
      </label>

      <div className="mt-2">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/55">Lugar · aparecerá en su chincheta del mapa</span>
        {selectedPlace ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-orange px-3 py-1.5 text-xs font-black shadow-hard-sm">
              <MapPin size={13} /> {selectedPlace.name}, {selectedPlace.country}
            </span>
            <button type="button" onClick={() => setPlaceId(null)} className="text-xs font-black text-ink/55 underline-offset-2 hover:underline">Quitar</button>
          </div>
        ) : null}
        <div className="relative mt-2">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45" />
          <input value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="Busca una ciudad o un país" aria-label="Buscar lugar" className="min-h-10 w-full rounded-full border-2 border-ink bg-white/70 pl-9 pr-4 text-sm font-semibold outline-none focus:ring-4 focus:ring-orange/40" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {filteredPlaces.map((place) => (
            <button key={place.id} type="button" onClick={() => { setPlaceId(place.id); setPlaceQuery(""); }} className="rounded-full border-2 border-ink bg-cream px-3 py-1 text-xs font-black transition-colors hover:bg-orange">
              {place.name}
            </button>
          ))}
          {filteredPlaces.length === 0 ? <span className="text-xs font-semibold text-ink/50">No hay lugares con ese nombre todavía.</span> : null}
        </div>
      </div>

      <p className="mt-5 flex items-start gap-2 rounded-2xl border-2 border-dashed border-ink/25 p-3 text-xs font-semibold leading-relaxed text-ink/60">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-orange" aria-hidden /> Los vídeos solo se publican en la comunidad y en el mapa; los scrapbooks se quedan con las fotos.
      </p>

      <div className="sticky bottom-0 -mx-4 mt-5 border-t-2 border-ink/10 bg-cream px-4 pb-1 pt-4 sm:-mx-6 sm:px-6">
        <button
          type="button"
          disabled={ready.length === 0 || processing || publishing}
          onClick={() => void publish()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-ink px-5 text-sm font-black text-cream shadow-hard-sm transition-colors hover:bg-orange hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
        >
          {publishing ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Subiendo {Math.min(progress!.done + 1, progress!.total)} de {progress!.total}…
            </>
          ) : processing ? (
            "Preparando archivos…"
          ) : (
            `Publicar${ready.length > 1 ? ` ${ready.length} archivos` : ""}`
          )}
        </button>
      </div>
    </Sheet>
  );
}
