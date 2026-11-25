import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpToLine,
  Check,
  Copy,
  Crop,
  ImagePlus,
  Layers3,
  Loader2,
  Magnet,
  Maximize,
  Minus,
  Palette,
  PanelLeftClose,
  Plus,
  Redo2,
  Save,
  Shapes,
  SlidersHorizontal,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  addElement,
  bringToFront,
  clamp,
  createElementId,
  createNoteElement,
  createPhotoElement,
  createTextElement,
  duplicateElement,
  findElement,
  isNote,
  placePhotoInFrame,
  prepareCompositionForSave,
  removeElement,
  replacePhoto,
  updateElement,
  type CanvasElement,
  type Point,
  type ScrapbookComposition,
} from "@/lib/composition";
import { clampZoom, DEFAULT_CAMERA, type Camera } from "@/lib/camera";
import { createEditorState, editorReducer } from "@/lib/editor-history";
import { IMAGE_INPUT_ACCEPT, ImageUploadError, prepareImageForCanvas, type PreparedImage } from "@/lib/image-upload";
import { useImmersiveMode } from "@/lib/immersive";
import type { Scrapbook } from "@/lib/scrapbooks";
import { useKeyboardInset, useMediaQuery } from "@/hooks/useMediaQuery";
import EditorStage, { type StageApi } from "@/components/editor/EditorStage";
import { PANEL_LABELS, PanelContent, type EditorApi, type PanelId, type PhotoRequest } from "@/components/editor/EditorPanels";
import Mascot from "@/components/ui/Mascot";

export { CANVAS_IMAGE_ACCEPT } from "@/lib/image-upload";
export type { CanvasElement, ScrapbookComposition } from "@/lib/composition";

/** Respuesta del padre al guardar. `composition` es la versión guardada (p. ej. con las fotos ya subidas a Storage). */
export type SaveFeedback = { persisted: boolean; message?: string; composition?: ScrapbookComposition };

export type InfiniteCanvasEditorProps = {
  scrapbook: Scrapbook;
  initialComposition: ScrapbookComposition;
  /** Devuelve la composición al padre. Puede informar si la copia local falló. */
  onSave: (composition: ScrapbookComposition) => SaveFeedback | void | Promise<SaveFeedback | void>;
  onClose: () => void;
};

/** Herramientas: las que abren un panel y "nota", que crea una nota directamente. */
type ToolId = Exclude<PanelId, "ajustes" | "filtros"> | "nota";

const TOOLS: Array<{ id: ToolId; label: string; icon: typeof Palette }> = [
  { id: "fotos", label: PANEL_LABELS.fotos, icon: ImagePlus },
  { id: "nota", label: "Nota", icon: StickyNote },
  { id: "texto", label: PANEL_LABELS.texto, icon: Type },
  { id: "elementos", label: PANEL_LABELS.elementos, icon: Shapes },
  { id: "capas", label: PANEL_LABELS.capas, icon: Layers3 },
  { id: "diseno", label: PANEL_LABELS.diseno, icon: Palette },
];

/** Una línea, solo en escritorio: en móvil el título del panel basta. */
const PANEL_HINTS: Record<PanelId, string> = {
  diseno: "Color y patrón del cuaderno.",
  elementos: "Marcos, cintas, pegatinas y sellos.",
  fotos: "Añade, reemplaza y recorta.",
  texto: "Títulos y notas.",
  filtros: "No modifican la foto original.",
  capas: "Ordena, oculta y bloquea.",
  ajustes: "Tamaño, giro y color.",
};

function IconButton({ label, onClick, children, disabled, active, className = "" }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean; active?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-colors disabled:pointer-events-none disabled:opacity-35 ${active ? "border-orange bg-orange text-ink" : "border-cream/25 text-cream hover:border-orange hover:bg-orange/15"} ${className}`}
    >
      {children}
    </button>
  );
}

function EmptyCanvasState({ onPhoto, onNote, onElements }: { onPhoto: () => void; onNote: () => void; onElements: () => void }) {
  return (
    <div data-stage-ui className="pointer-events-auto max-w-[min(92%,22rem)] rounded-2xl border-2 border-ink bg-cream p-3 text-center text-ink shadow-hard sm:p-5">
      <div className="hidden sm:block">
        <Mascot name="12-scrapbook-album" size="sm" className="mx-auto" />
      </div>
      <p className="font-display text-xl sm:text-3xl">Tu cuaderno está en blanco</p>
      <p className="mt-1 text-[12px] font-bold text-ink/60 sm:text-sm">Sin bordes: arrastra para moverte y pellizca para acercarte.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onPhoto} className="flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-ink bg-orange px-3 text-xs font-black shadow-hard-sm">
          <ImagePlus size={15} /> Fotos
        </button>
        <button type="button" onClick={onNote} className="flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-ink bg-white px-3 text-xs font-black">
          <StickyNote size={15} /> Nota
        </button>
        <button type="button" onClick={onElements} className="flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-ink bg-white px-3 text-xs font-black">
          <Shapes size={15} /> Decorar
        </button>
      </div>
    </div>
  );
}

/**
 * Editor visual de scrapbooks: pizarra libre con pan/zoom, selección, capas y
 * paneles. El estado de edición es local, pero la composición guardada SIEMPRE
 * se devuelve al padre con `onSave`; cerrar el editor no pierde nada guardado.
 */
export default function InfiniteCanvasEditor({ scrapbook, initialComposition, onSave, onClose }: InfiniteCanvasEditorProps) {
  useImmersiveMode(true);
  const [state, dispatch] = useReducer(editorReducer, initialComposition, (composition) => createEditorState(composition));
  const savedRef = useRef<ScrapbookComposition>(state.present);
  const [savedVersion, setSavedVersion] = useState(0);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  // null hasta que el lienzo mide el visor y encuadra el contenido.
  const [camera, setCamera] = useState<Camera | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const keyboardInset = useKeyboardInset();
  const [activePanel, setActivePanel] = useState<PanelId>("fotos");
  const [sheetOpen, setSheetOpen] = useState(false);
  // En escritorio el panel izquierdo se pliega para dejar todo el cuaderno a la vista.
  const [desktopPanelOpen, setDesktopPanelOpen] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [textFocusToken, setTextFocusToken] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("Preparando fotos…");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRequest = useRef<PhotoRequest>({ kind: "add" });
  const stageApi = useRef<StageApi | null>(null);

  const composition = state.present;
  const selected = findElement(composition, state.selectedId);
  const dirty = composition !== savedRef.current;
  const latest = useRef({ composition, selected, isDesktop });
  latest.current = { composition, selected, isDesktop };

  useEffect(() => setCropMode(false), [state.selectedId]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const apply = useCallback<EditorApi["apply"]>((update, options) => dispatch({ type: "apply", update, record: options?.record, select: options?.select }), []);
  const select = useCallback((id: string | null) => dispatch({ type: "select", id }), []);
  const checkpoint = useCallback(() => dispatch({ type: "checkpoint" }), []);
  const onCameraChange = useCallback((updater: (camera: Camera) => Camera) => {
    setCamera((current) => {
      const next = updater(current ?? DEFAULT_CAMERA);
      return { ...next, zoom: clampZoom(next.zoom) };
    });
  }, []);

  const openPanel = useCallback((panel: PanelId) => {
    // En escritorio los ajustes del elemento ya están siempre a la derecha.
    if (latest.current.isDesktop && panel === "ajustes") return;
    setActivePanel(panel);
    if (latest.current.isDesktop) setDesktopPanelOpen(true);
    else setSheetOpen(true);
  }, []);

  /** Dónde aparece lo nuevo: en el centro de lo que estás viendo, en cascada para no apilarlo todo. */
  const placementCenter = useCallback((): Point => {
    const { composition: current } = latest.current;
    const center = stageApi.current?.visibleCenter() ?? { x: current.canvas.width / 2, y: current.canvas.height / 2 };
    const visible = stageApi.current?.visibleRect();
    const step = (current.elements.length % 5) * Math.min(60, (visible?.width ?? 1200) * 0.03);
    return { x: center.x + step, y: center.y + step };
  }, []);

  /** Tamaño de una foto nueva según el zoom: siempre cómoda de ver, sin pasarse. */
  const photoLongSide = useCallback(() => {
    const visible = stageApi.current?.visibleRect();
    if (!visible) return undefined;
    return Math.round(clamp(Math.min(visible.width, visible.height) * 0.42, 220, 900));
  }, []);

  const focusText = useCallback((id: string) => {
    openPanel("texto");
    setTextFocusToken((token) => token + 1);
    if (!latest.current.isDesktop) {
      window.setTimeout(() => stageApi.current?.revealElement(id, -Math.round(window.innerHeight * 0.2)), 60);
    }
  }, [openPanel]);

  const addText = useCallback(() => {
    const element = createTextElement(latest.current.composition, { center: placementCenter() });
    dispatch({ type: "apply", update: (current) => addElement(current, element), select: element.id });
    focusText(element.id);
  }, [focusText, placementCenter]);

  const addNote = useCallback(
    (center?: Point) => {
      const element = createNoteElement(latest.current.composition, { center: center ?? placementCenter() });
      dispatch({ type: "apply", update: (current) => addElement(current, element), select: element.id });
      focusText(element.id);
    },
    [focusText, placementCenter],
  );

  const finishText = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const current = latest.current.selected;
    if (current?.type === "text" && !(current.content ?? "").trim()) {
      dispatch({ type: "apply", update: (composition) => removeElement(composition, current.id), select: null });
    }
    if (!latest.current.isDesktop) setSheetOpen(false);
  }, []);

  const requestPhotos = useCallback((request: PhotoRequest) => {
    photoRequest.current = request;
    setUploadError(null);
    const input = fileRef.current;
    if (!input) return;
    input.value = "";
    input.multiple = request.kind === "add";
    input.click();
  }, []);

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const request = photoRequest.current;
    setUploading(true);
    setUploadStatus("Preparando fotos…");
    setUploadError(null);
    const prepared: PreparedImage[] = [];
    const errors: string[] = [];
    for (const file of files) {
      try {
        prepared.push(await prepareImageForCanvas(file, { onConverting: () => setUploadStatus("Convirtiendo foto HEIC…") }));
      } catch (error) {
        errors.push(error instanceof ImageUploadError ? error.message : `No se pudo leer “${file.name}”.`);
      }
    }
    setUploading(false);
    if (errors.length) {
      setUploadError(errors.join(" "));
      toast.error(errors[0]);
    }
    if (prepared.length === 0) return;

    const toPhoto = (image: PreparedImage) => ({
      src: image.src,
      naturalWidth: image.width,
      naturalHeight: image.height,
      asset: {
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        originalName: image.originalName,
        originalMimeType: image.originalMimeType,
        convertedFromHeic: image.convertedFromHeic || undefined,
        inline: true,
      },
    });

    if (request.kind === "replace") {
      dispatch({ type: "apply", update: (current) => replacePhoto(current, request.id, toPhoto(prepared[0])), select: request.id });
      return;
    }
    let images = prepared;
    const target = latest.current.selected;
    const frameId = request.kind === "fill" ? request.id : target?.type === "frame" && !target.src ? target.id : null;
    if (frameId) {
      const [first, ...rest] = images;
      dispatch({ type: "apply", update: (current) => placePhotoInFrame(current, frameId, toPhoto(first)), select: frameId });
      images = rest;
    }
    if (images.length === 0) return;
    const base = placementCenter();
    const longSide = photoLongSide();
    const { composition: snapshot } = latest.current;
    const spread = (longSide ?? 450) * 0.18;
    const created: CanvasElement[] = images.map((image, index) =>
      createPhotoElement(snapshot, {
        ...toPhoto(image),
        longSide,
        center: { x: base.x + index * spread, y: base.y + index * spread * 0.75 },
        rotation: images.length > 1 ? (index % 2 ? 3 : -3) : 0,
      }),
    );
    dispatch({ type: "apply", update: (current) => created.reduce((acc, element) => addElement(acc, element), current), select: created[created.length - 1].id });
  }, [photoLongSide, placementCenter]);

  const save = useCallback(async () => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    const prepared = prepareCompositionForSave(latest.current.composition);
    // El editor muestra ya la versión normalizada mientras se guarda.
    dispatch({ type: "apply", update: () => prepared, record: false });
    try {
      const feedback = await onSave(prepared);
      const stored = feedback?.composition ?? prepared;
      // Si no se ha tocado nada mientras guardábamos, adoptamos la versión guardada (fotos ya en Storage).
      if (latest.current.composition === prepared) dispatch({ type: "apply", update: () => stored, record: false });
      savedRef.current = latest.current.composition === prepared ? stored : prepared;
      setSavedVersion((version) => version + 1);
      setNotice(feedback && !feedback.persisted ? { tone: "warn", text: feedback.message ?? "Guardado solo en este dispositivo" } : { tone: "ok", text: "Cambios guardados" });
      return feedback ? feedback.persisted : true;
    } catch {
      setNotice({ tone: "warn", text: "No se pudo guardar. Inténtalo de nuevo." });
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [onSave]);

  const requestClose = useCallback(() => {
    if (latest.current.composition !== savedRef.current) setConfirmClose(true);
    else onClose();
  }, [onClose]);

  // Atajos de teclado (desktop).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
        return;
      }
      if (typing) {
        if (event.key === "Escape") target?.blur();
        return;
      }
      const current = latest.current.selected;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      } else if (mod && event.key.toLowerCase() === "d" && current) {
        event.preventDefault();
        const copyId = createElementId("copy");
        dispatch({ type: "apply", update: (composition) => duplicateElement(composition, current.id, copyId), select: copyId });
      } else if ((event.key === "Delete" || event.key === "Backspace") && current) {
        event.preventDefault();
        dispatch({ type: "apply", update: (composition) => removeElement(composition, current.id), select: null });
      } else if (!mod && (event.key === "+" || event.key === "=")) {
        stageApi.current?.zoomBy(1.25);
      } else if (!mod && (event.key === "-" || event.key === "_")) {
        stageApi.current?.zoomBy(1 / 1.25);
      } else if (!mod && event.key === "0") {
        stageApi.current?.fitToContent();
      } else if (!mod && event.key.toLowerCase() === "n") {
        event.preventDefault();
        addNote();
      } else if (event.key === "Escape") {
        if (current) dispatch({ type: "select", id: null });
        else requestClose();
      } else if (current && !current.locked && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 20 : 4;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        dispatch({ type: "apply", update: (composition) => updateElement(composition, current.id, { x: current.x + dx, y: current.y + dy }) });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addNote, requestClose, save]);

  const api: EditorApi = useMemo(
    () => ({
      composition,
      selected,
      location: scrapbook.location,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      apply,
      checkpoint,
      select,
      openPanel,
      addText,
      addNote: () => addNote(),
      finishText,
      requestPhotos,
      uploading,
      uploadStatus,
      uploadError,
      cropMode,
      setCropMode,
      textFocusToken,
      placementCenter,
    }),
    [addNote, addText, apply, checkpoint, composition, cropMode, finishText, openPanel, placementCenter, requestPhotos, scrapbook.location, select, selected, state.future.length, state.past.length, textFocusToken, uploadError, uploadStatus, uploading],
  );

  const onToolPress = (tool: ToolId) => {
    if (tool === "nota") {
      addNote();
      return;
    }
    if (tool === "texto" && !(selected?.type === "text")) {
      addText();
      return;
    }
    if (tool === "texto" && selected) {
      focusText(selected.id);
      return;
    }
    if (isDesktop && desktopPanelOpen && activePanel === tool) {
      setDesktopPanelOpen(false);
      return;
    }
    if (!isDesktop && sheetOpen && activePanel === tool) {
      setSheetOpen(false);
      return;
    }
    openPanel(tool);
  };

  const isToolActive = (tool: ToolId) => tool !== "nota" && activePanel === tool && (isDesktop ? desktopPanelOpen : sheetOpen);
  const zoom = camera?.zoom ?? 1;
  const statusText = saving ? "Guardando…" : dirty ? "Cambios sin guardar" : savedVersion > 0 ? "Cambios guardados" : "Sin cambios";
  const zoomButton = "flex h-9 w-9 items-center justify-center rounded-lg text-cream hover:bg-orange hover:text-ink";
  const zoomControls = (
    <div className="flex items-center gap-0.5 rounded-xl border-2 border-cream/25 bg-ink/90 p-0.5 shadow-[3px_3px_0_rgba(11,33,48,.35)]" data-stage-ui>
      <button type="button" aria-label="Alejar" title="Alejar (−)" onClick={() => stageApi.current?.zoomBy(1 / 1.25)} className={zoomButton}>
        <Minus size={16} />
      </button>
      <button type="button" aria-label="Zoom al 100%" title="Zoom al 100%" onClick={() => stageApi.current?.resetZoom()} className="h-9 min-w-12 rounded-lg px-1 text-center text-[11px] font-black tabular-nums text-cream hover:bg-cream/10">
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" aria-label="Acercar" title="Acercar (+)" onClick={() => stageApi.current?.zoomBy(1.25)} className={zoomButton}>
        <Plus size={16} />
      </button>
      <button type="button" aria-label="Ver todo el cuaderno" title="Ver todo (0)" onClick={() => stageApi.current?.fitToContent()} className={zoomButton}>
        <Maximize size={15} />
      </button>
      <button type="button" aria-label="Guías de alineación" aria-pressed={snapEnabled} title="Guías de alineación" onClick={() => setSnapEnabled((value) => !value)} className={`flex h-9 w-9 items-center justify-center rounded-lg ${snapEnabled ? "bg-orange text-ink" : "text-cream hover:bg-cream/10"}`}>
        <Magnet size={15} />
      </button>
    </div>
  );

  const quickActions = selected ? (
    <div data-stage-ui className="flex gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none]">
      {[
        { key: "ajustes", label: "Ajustes", icon: SlidersHorizontal, onClick: () => openPanel("ajustes") },
        ...(selected.type === "text" ? [{ key: "texto", label: "Escribir", icon: isNote(selected) ? StickyNote : Type, onClick: () => focusText(selected.id) }] : []),
        ...(selected.type === "photo"
          ? [
              { key: "filtros", label: "Filtros", icon: Wand2, onClick: () => openPanel("filtros") },
              { key: "recorte", label: "Recorte", icon: Crop, onClick: () => openPanel("fotos") },
            ]
          : []),
        ...(selected.type === "frame" ? [{ key: "foto", label: "Foto", icon: ImagePlus, onClick: () => requestPhotos({ kind: "fill", id: selected.id }) }] : []),
        {
          key: "duplicar",
          label: "Duplicar",
          icon: Copy,
          onClick: () => {
            const copyId = createElementId("copy");
            apply((current) => duplicateElement(current, selected.id, copyId), { select: copyId });
          },
        },
        { key: "frente", label: "Al frente", icon: ArrowUpToLine, onClick: () => apply((current) => bringToFront(current, selected.id)) },
        { key: "eliminar", label: "Eliminar", icon: Trash2, onClick: () => apply((current) => removeElement(current, selected.id), { select: null }) },
      ].map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border-2 border-ink px-3 text-[13px] font-black shadow-[2px_2px_0_#0B2130] ${action.key === "eliminar" ? "bg-[#f2c5a0] text-ink" : action.key === "ajustes" ? "bg-orange text-ink" : "bg-cream text-ink"}`}
        >
          <action.icon size={16} /> {action.label}
        </button>
      ))}
    </div>
  ) : null;

  const leftPanel: PanelId = activePanel === "ajustes" ? "capas" : activePanel;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Editor de ${scrapbook.title}`} className="fixed inset-0 z-[90] flex h-[100dvh] flex-col overflow-hidden bg-ink text-cream">
      {/* Barra superior */}
      <header className="flex shrink-0 items-center gap-2 border-b-2 border-cream/15 bg-ink px-2 pb-2 pt-[max(.5rem,env(safe-area-inset-top))] sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <IconButton label="Deshacer" onClick={() => dispatch({ type: "undo" })} disabled={state.past.length === 0}>
            <Undo2 size={18} />
          </IconButton>
          <IconButton label="Rehacer" onClick={() => dispatch({ type: "redo" })} disabled={state.future.length === 0}>
            <Redo2 size={18} />
          </IconButton>
          <p className="ml-1 hidden min-w-0 truncate font-display text-base text-cream sm:block">{scrapbook.title}</p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <span role="status" aria-live="polite" className={`hidden text-[11px] font-black md:inline ${dirty ? "text-orange" : "text-cream/55"}`}>
            {statusText}
          </span>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            aria-busy={saving}
            className="relative flex h-11 items-center gap-2 rounded-xl border-2 border-cream bg-orange px-3 text-sm font-black text-ink shadow-[3px_3px_0_#EAE7DA] transition-transform active:translate-y-0.5 active:shadow-none sm:px-4"
          >
            {dirty ? <span className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 rounded-full border-2 border-ink bg-cream" aria-hidden="true" /> : null}
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} <span>{saving ? "Guardando" : "Guardar"}</span>
          </button>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar editor"
            title="Cerrar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-cream text-ink shadow-[3px_3px_0_#FA9223] transition-transform hover:rotate-90"
          >
            <X size={20} strokeWidth={2.6} />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {isDesktop ? (
          <>
            <nav aria-label="Herramientas" className="flex w-[76px] shrink-0 flex-col gap-1.5 border-r-2 border-cream/15 bg-ink px-2 py-3">
              {TOOLS.map((tool) => (
                <button key={tool.id} type="button" onClick={() => onToolPress(tool.id)} aria-pressed={isToolActive(tool.id)} title={tool.id === "nota" ? "Nota nueva (N)" : tool.label} className={`editor-tool ${isToolActive(tool.id) ? "active" : ""}`}>
                  <tool.icon size={20} />
                  <span>{tool.label}</span>
                </button>
              ))}
            </nav>
            {desktopPanelOpen ? (
              <aside aria-label={`Panel ${PANEL_LABELS[leftPanel]}`} className="w-[300px] shrink-0 overflow-y-auto border-r-2 border-cream/15 bg-ink px-4 pb-8 pt-4 xl:w-[320px]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="!text-3xl text-cream">{PANEL_LABELS[leftPanel]}</h2>
                    <p className="mb-4 mt-1 text-[12px] font-semibold text-cream/55">{PANEL_HINTS[leftPanel]}</p>
                  </div>
                  <button type="button" onClick={() => setDesktopPanelOpen(false)} aria-label="Plegar panel" title="Plegar panel" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-cream/70 hover:bg-cream/10 hover:text-cream">
                    <PanelLeftClose size={18} />
                  </button>
                </div>
                <PanelContent panel={leftPanel} api={api} />
              </aside>
            ) : null}
          </>
        ) : null}

        <main className="relative min-w-0 flex-1">
          <EditorStage
            composition={composition}
            selectedId={state.selectedId}
            camera={camera}
            onCameraChange={onCameraChange}
            onSelect={select}
            onBeginChange={checkpoint}
            onChange={(update) => apply(update, { record: false })}
            onEditText={focusText}
            onFillFrame={(id) => requestPhotos({ kind: "fill", id })}
            onCreateNote={addNote}
            cropMode={cropMode}
            snapEnabled={snapEnabled}
            apiRef={stageApi}
            bottomInset={isDesktop ? 0 : 56}
            emptyState={<EmptyCanvasState onPhoto={() => requestPhotos({ kind: "add" })} onNote={() => addNote()} onElements={() => openPanel("elementos")} />}
          />
          <div className={`pointer-events-none absolute [&>*]:pointer-events-auto ${isDesktop ? "bottom-4 right-4" : "left-2 top-2"}`}>{zoomControls}</div>
          {!isDesktop && !sheetOpen && keyboardInset === 0 ? <div className="absolute inset-x-0 bottom-2">{quickActions}</div> : null}
          {cropMode ? (
            <div data-stage-ui className="absolute left-1/2 top-14 -translate-x-1/2 rounded-full border-2 border-ink bg-orange px-3 py-1.5 text-[12px] font-black text-ink lg:top-3">
              Arrastra para mover la foto dentro del marco
            </div>
          ) : null}
        </main>

        {isDesktop && selected ? (
          <aside aria-label="Ajustes del elemento" className="w-[290px] shrink-0 overflow-y-auto border-l-2 border-cream/15 bg-ink px-4 pb-8 pt-4 xl:w-[310px]">
            <h2 className="!text-3xl text-cream">{PANEL_LABELS.ajustes}</h2>
            <p className="mb-4 mt-1 text-[12px] font-semibold text-cream/55">{PANEL_HINTS.ajustes}</p>
            <PanelContent panel="ajustes" api={api} />
          </aside>
        ) : null}
      </div>

      {/* Bottom sheet móvil */}
      {!isDesktop ? (
        <AnimatePresence>
          {sheetOpen ? (
            <motion.section
              key="sheet"
              aria-label={`Panel ${PANEL_LABELS[activePanel]}`}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0, pointerEvents: "none" }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="fixed inset-x-0 z-[3] flex flex-col rounded-t-[1.6rem] border-2 border-b-0 border-cream/25 bg-ink shadow-[0_-8px_0_rgba(250,146,35,.35)]"
              style={{
                bottom: keyboardInset > 0 ? keyboardInset : "calc(68px + env(safe-area-inset-bottom))",
                maxHeight: keyboardInset > 0 ? `calc(100dvh - ${keyboardInset}px - 170px)` : "min(52dvh, 30rem)",
              }}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-3">
                <h2 className="!text-2xl text-cream">{PANEL_LABELS[activePanel]}</h2>
                <button type="button" onClick={() => setSheetOpen(false)} aria-label="Cerrar panel" className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl border-2 border-cream/25 px-2 text-[12px] font-black text-cream">
                  <Check size={16} /> Hecho
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5">
                <PanelContent panel={activePanel} api={api} />
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      ) : null}

      {/* Barra de herramientas inferior (móvil, al alcance del pulgar) */}
      {!isDesktop && keyboardInset === 0 ? (
        <nav aria-label="Herramientas" className="relative z-[4] grid shrink-0 grid-cols-6 gap-1 border-t-2 border-cream/15 bg-ink px-1.5 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-1.5">
          {TOOLS.map((tool) => {
            const active = isToolActive(tool.id);
            return (
              <button key={tool.id} type="button" onClick={() => onToolPress(tool.id)} aria-pressed={active} className={`flex h-[54px] flex-col items-center justify-center gap-1 rounded-xl border-2 text-[10px] font-black uppercase tracking-[.04em] transition-colors ${active ? "border-cream bg-orange text-ink" : "border-transparent text-cream/80"}`}>
                <tool.icon size={20} />
                {tool.label}
              </button>
            );
          })}
        </nav>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_INPUT_ACCEPT}
        multiple
        className="hidden"
        data-testid="editor-photo-input"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          void handleFiles(files);
        }}
      />

      <AnimatePresence>
        {notice ? (
          <motion.div
            key="notice"
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className={`pointer-events-none fixed left-1/2 top-[calc(4.5rem+env(safe-area-inset-top))] z-[6] flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-ink px-4 py-2 text-sm font-black text-ink shadow-hard-sm ${notice.tone === "ok" ? "bg-orange" : "bg-[#f2c5a0]"}`}
          >
            <Check size={16} /> {notice.text}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {confirmClose ? (
          <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[7] flex items-end justify-center bg-ink/70 p-4 backdrop-blur-sm sm:items-center">
            <motion.div role="alertdialog" aria-modal="true" aria-labelledby="close-title" initial={{ y: 16 }} animate={{ y: 0 }} exit={{ y: 16 }} className="w-full max-w-sm rounded-[1.6rem] border-2 border-ink bg-cream p-5 text-ink shadow-hard">
              <h2 id="close-title" className="!text-3xl">¿Cerrar sin guardar?</h2>
              <p className="mt-2 text-sm font-semibold text-ink/65">Tienes cambios sin guardar en este scrapbook.</p>
              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    const ok = await save();
                    setConfirmClose(false);
                    if (ok) onClose();
                  }}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-orange text-sm font-black shadow-hard-sm"
                >
                  <Save size={16} /> Guardar y cerrar
                </button>
                <button type="button" onClick={onClose} className="min-h-12 rounded-xl border-2 border-ink bg-white text-sm font-black">
                  Cerrar sin guardar
                </button>
                <button type="button" onClick={() => setConfirmClose(false)} className="min-h-11 text-sm font-black underline">
                  Seguir editando
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
