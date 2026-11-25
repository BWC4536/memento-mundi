import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  ChevronDown,
  ChevronUp,
  Copy,
  Crop,
  Eye,
  EyeOff,
  Frame,
  ImagePlus,
  Italic,
  LayoutGrid,
  Loader2,
  Lock,
  LockOpen,
  Minus,
  Plus,
  Replace,
  RotateCcw,
  RotateCw,
  Shapes,
  Sparkles,
  Square,
  StickyNote,
  Trash2,
  Type,
  Wand2,
} from "lucide-react";
import {
  addElement,
  applyFrame,
  arrangePhotos,
  bringToFront,
  createDecorationElement,
  createFrameElement,
  createElementId,
  duplicateElement,
  FONT_FAMILIES,
  getFilterDefinition,
  getOuterSize,
  isNote,
  LIMITS,
  moveLayer,
  normalizeCrop,
  NOTE_COLORS,
  PHOTO_FILTERS,
  removeElement,
  sendToBack,
  setPhotoCropFormat,
  setPhotoFilter,
  sortByZ,
  updateCanvas,
  updateElement,
  updateText,
  DEFAULT_TEXT_STYLE,
  type CanvasElement,
  type CropFormat,
  type FrameId,
  type Point,
  type ScrapbookComposition,
} from "@/lib/composition";
import {
  applyDesignPreset,
  BACKGROUND_SWATCHES,
  DESIGN_PRESETS,
  ELEMENT_COLORS,
  FRAME_LABELS,
  getTextureStyle,
  PHOTO_FRAME_SAMPLES,
  setCanvasBackground,
  TEXT_COLORS,
  TEXTURES,
} from "@/lib/composition-presets";
import { ElementContent } from "@/components/scrapbook/CompositionCanvas";
import { DECORATION_GROUPS, DECORATION_SAMPLES, decorationLabel, getDecorationSample } from "@/components/scrapbook/decorations";
import Mascot from "@/components/ui/Mascot";

export type PanelId = "diseno" | "elementos" | "fotos" | "texto" | "filtros" | "capas" | "ajustes";

export const PANEL_LABELS: Record<PanelId, string> = {
  diseno: "Papel",
  elementos: "Decorar",
  fotos: "Fotos",
  texto: "Texto",
  filtros: "Filtros",
  capas: "Capas",
  ajustes: "Ajustes",
};

export type PhotoRequest = { kind: "add" } | { kind: "replace"; id: string } | { kind: "fill"; id: string };

export type EditorApi = {
  composition: ScrapbookComposition;
  selected: CanvasElement | undefined;
  location: string;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  apply: (update: (composition: ScrapbookComposition) => ScrapbookComposition, options?: { record?: boolean; select?: string | null }) => void;
  checkpoint: () => void;
  select: (id: string | null) => void;
  openPanel: (panel: PanelId) => void;
  addText: () => void;
  addNote: () => void;
  finishText: () => void;
  requestPhotos: (request: PhotoRequest) => void;
  uploading: boolean;
  uploadStatus: string;
  uploadError: string | null;
  cropMode: boolean;
  setCropMode: (value: boolean) => void;
  textFocusToken: number;
  placementCenter: () => Point;
};

/* ------------------------------------------------------------------------- */
/* Primitivas de UI                                                           */
/* ------------------------------------------------------------------------- */

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-b-2 border-cream/10 pb-5 pt-4 first:pt-0 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p role="heading" aria-level={3} className="editor-label !mb-0">{title}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border-2 border-dashed border-cream/20 px-3 py-2.5 text-[13px] font-semibold leading-snug text-cream/70">{children}</p>;
}

function ActionButton({ children, onClick, tone = "default", disabled, label, pressed }: { children: ReactNode; onClick: () => void; tone?: "default" | "primary" | "danger"; disabled?: boolean; label?: string; pressed?: boolean }) {
  const tones = {
    default: "border-cream/25 text-cream hover:border-orange hover:bg-orange/15",
    primary: "border-ink bg-orange text-ink shadow-[3px_3px_0_#EAE7DA] hover:-translate-y-0.5",
    danger: "border-[#f2c5a0]/40 text-[#f2c5a0] hover:border-[#f2c5a0] hover:bg-[#b44728]/25",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-[13px] font-black transition-[transform,background-color,border-color] disabled:pointer-events-none disabled:opacity-40 ${tones[tone]} ${pressed ? "!border-orange !bg-orange !text-ink" : ""}`}
    >
      {children}
    </button>
  );
}

function ChipButton({ active, onClick, children, label, style }: { active?: boolean; onClick: () => void; children: ReactNode; label?: string; style?: CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      style={style}
      className={`min-h-10 rounded-xl border-2 px-3 py-1.5 text-[13px] font-black transition-colors ${active ? "border-orange bg-orange text-ink" : "border-cream/20 text-cream/85 hover:border-orange"}`}
    >
      {children}
    </button>
  );
}

function Swatches({ colors, value, onChange, label }: { colors: readonly string[]; value?: string; onChange: (color: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={`${label} ${color}`}
          aria-pressed={value?.toUpperCase() === color.toUpperCase()}
          className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${value?.toUpperCase() === color.toUpperCase() ? "border-orange ring-2 ring-orange ring-offset-2 ring-offset-ink" : "border-cream/40"}`}
          style={{ background: color }}
        />
      ))}
      <label className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-cream/50 text-cream" title="Color personalizado">
        <Plus size={15} />
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value ?? "") ? value : "#FA9223"} onChange={(event) => onChange(event.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`${label} personalizado`} />
      </label>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onStart,
  onChange,
  onStep,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (value: number) => string;
  onStart: () => void;
  onChange: (value: number) => void;
  onStep?: (direction: -1 | 1) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12px] font-black text-cream/80">
        <span>{label}</span>
        <span className="tabular-nums text-orange">{format(value)}</span>
      </div>
      <div className="flex items-center gap-2">
        {onStep ? (
          <button type="button" onClick={() => onStep(-1)} aria-label={`${label}: menos`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-cream/25 text-cream hover:border-orange">
            <Minus size={16} />
          </button>
        ) : null}
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onPointerDown={onStart}
          onKeyDown={onStart}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mm-range min-w-0 flex-1"
        />
        {onStep ? (
          <button type="button" onClick={() => onStep(1)} aria-label={`${label}: más`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-cream/25 text-cream hover:border-orange">
            <Plus size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Miniatura de un elemento real (mismo renderer que el lienzo). */
function Mini({ element, box = 64 }: { element: CanvasElement; box?: number }) {
  const outer = getOuterSize(element);
  const unit = box / Math.max(outer.width, outer.height);
  return (
    <span className="relative inline-block" style={{ width: outer.width * unit, height: outer.height * unit, ["--mm-u" as string]: `${unit}px` } as CSSProperties}>
      <ElementContent element={element} />
    </span>
  );
}

export function elementLabel(element: CanvasElement) {
  if (isNote(element)) return element.content?.trim() ? `Nota “${element.content.trim().slice(0, 24)}”` : "Nota vacía";
  if (element.type === "text") return element.content?.trim() ? `“${element.content.trim().slice(0, 28)}”` : "Texto vacío";
  if (element.type === "photo") return `Foto · ${FRAME_LABELS[element.frameId ?? "none"]}`;
  if (element.type === "frame") return `Marco · ${FRAME_LABELS[element.frameId ?? "none"]}`;
  return decorationLabel(element);
}

const TYPE_ICON: Record<CanvasElement["type"], typeof Type> = {
  text: Type,
  photo: ImagePlus,
  frame: Frame,
  sticker: Sparkles,
  shape: Shapes,
  decoration: Wand2,
};

/* ------------------------------------------------------------------------- */
/* Diseño                                                                      */
/* ------------------------------------------------------------------------- */

function PresetPreview({ background, texture }: { background: string; texture: (typeof TEXTURES)[number]["id"] }) {
  const textureStyle = getTextureStyle(texture, background);
  return (
    <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg border-2 border-ink" style={{ background, ["--mm-u" as string]: "0.35px" } as CSSProperties}>
      {textureStyle ? <span className="absolute inset-0" style={textureStyle} /> : null}
    </span>
  );
}

export function DesignPanel({ api }: { api: EditorApi }) {
  const { canvas } = api.composition;
  const hasPhotos = api.composition.elements.some((element) => element.type === "photo" || element.type === "frame");
  return (
    <div>
      <Section title="Estilo del cuaderno">
        <div className="grid grid-cols-3 gap-2">
          {DESIGN_PRESETS.map((preset) => {
            const active = canvas.background.toUpperCase() === preset.background && (canvas.texture ?? "none") === preset.texture;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => api.apply((composition) => applyDesignPreset(composition, preset.id))}
                className={`rounded-xl border-2 p-1 text-left transition-colors ${active ? "border-orange bg-orange/15" : "border-cream/20 hover:border-orange"}`}
              >
                <PresetPreview background={preset.background} texture={preset.texture} />
                <span className="mt-1 block truncate px-0.5 text-[11px] font-black text-cream">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Color">
        <Swatches colors={BACKGROUND_SWATCHES.map((swatch) => swatch.value)} value={canvas.background} label="Color del papel" onChange={(color) => api.apply((composition) => setCanvasBackground(composition, color))} />
      </Section>

      <Section title="Patrón">
        <div className="flex flex-wrap gap-2">
          {TEXTURES.map((texture) => (
            <ChipButton key={texture.id} active={(canvas.texture ?? "none") === texture.id} onClick={() => api.apply((composition) => updateCanvas(composition, { texture: texture.id }))}>
              {texture.label}
            </ChipButton>
          ))}
        </div>
      </Section>

      {hasPhotos ? (
        <Section title="Ordenar fotos">
          <div className="grid grid-cols-1 gap-2">
            <ActionButton onClick={() => api.apply((composition) => arrangePhotos(composition, "collage"))}>
              <Sparkles size={16} /> Collage libre
            </ActionButton>
            <ActionButton onClick={() => api.apply((composition) => arrangePhotos(composition, "grid"))}>
              <LayoutGrid size={16} /> Cuadrícula
            </ActionButton>
            <ActionButton onClick={() => api.apply((composition) => arrangePhotos(composition, "straighten"))}>
              <Square size={16} /> Enderezar
            </ActionButton>
          </div>
        </Section>
      ) : null}

      <Section title="Moverte por el cuaderno">
        <ul className="space-y-1 text-[12px] font-semibold text-cream/60">
          <li>Arrastra el papel o usa dos dedos para moverte.</li>
          <li>Pellizca, o Ctrl + rueda, para acercar y alejar.</li>
          <li>Doble toque en el papel: nota nueva.</li>
        </ul>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Elementos                                                                   */
/* ------------------------------------------------------------------------- */

export function ElementsPanel({ api }: { api: EditorApi }) {
  const target = api.selected && (api.selected.type === "photo" || api.selected.type === "frame") ? api.selected : undefined;
  const addFrame = (frameId: FrameId, aspect: number) => {
    if (target) {
      api.apply((composition) => applyFrame(composition, target.id, frameId));
      return;
    }
    const element = createFrameElement(api.composition, frameId, aspect, api.placementCenter());
    api.apply((composition) => addElement(composition, element), { select: element.id });
  };

  return (
    <div>
      <Section title="Marcos">
        <p className="mb-3 text-[12px] font-semibold text-cream/60">
          {target ? "Pulsa un marco para aplicarlo a la foto seleccionada. La foto se conserva." : "Añadir marco: pulsa uno y luego toca dentro para poner una foto."}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PHOTO_FRAME_SAMPLES.map((sample) => {
            const preview: CanvasElement = {
              id: sample.id,
              type: target?.src ? "photo" : "frame",
              src: target?.src,
              x: 0,
              y: 0,
              width: sample.aspect >= 1 ? 300 : 300 * sample.aspect,
              height: sample.aspect >= 1 ? 300 / sample.aspect : 300,
              rotation: 0,
              scale: 1,
              z: 0,
              frameId: sample.frameId,
            };
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => addFrame(sample.frameId, sample.aspect)}
                aria-label={target ? `Aplicar ${sample.label}` : `Añadir ${sample.label}`}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 bg-cream/95 px-1 pb-1.5 pt-3 text-[11px] font-black text-ink transition-transform hover:-translate-y-0.5 ${target?.frameId === sample.frameId ? "border-orange ring-2 ring-orange" : "border-cream/30"}`}
              >
                <span className="flex h-16 items-center justify-center">
                  <Mini element={preview} box={56} />
                </span>
                {sample.label}
              </button>
            );
          })}
        </div>
      </Section>

      {DECORATION_GROUPS.map((group) => (
        <Section key={group.id} title={group.label}>
          <div className="grid grid-cols-4 gap-2">
            {DECORATION_SAMPLES.filter((sample) => sample.group === group.id).map((sample) => {
              const content = sample.id === "stamp-location" ? api.location : sample.text;
              const preview: CanvasElement = { id: sample.id, type: sample.type, sampleId: sample.id, color: sample.color, content, x: 0, y: 0, width: sample.width, height: sample.height, rotation: 0, scale: 1, z: 0 };
              return (
                <button
                  key={sample.id}
                  type="button"
                  aria-label={`Añadir decoración: ${sample.label}`}
                  title={sample.label}
                  onClick={() => {
                    const element = createDecorationElement(api.composition, { type: sample.type, sampleId: sample.id, width: sample.width, height: sample.height, color: sample.color, content, center: api.placementCenter() });
                    api.apply((composition) => addElement(composition, element), { select: element.id });
                  }}
                  className="flex aspect-square items-center justify-center rounded-xl border-2 border-cream/30 bg-cream/95 p-1.5 transition-transform hover:-translate-y-0.5 hover:border-orange"
                >
                  <Mini element={preview} box={48} />
                </button>
              );
            })}
          </div>
        </Section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Fotos                                                                       */
/* ------------------------------------------------------------------------- */

const CROP_FORMATS: Array<{ id: CropFormat; label: string }> = [
  { id: "original", label: "Original" },
  { id: "square", label: "Cuadrado" },
  { id: "vertical", label: "Vertical" },
  { id: "horizontal", label: "Horizontal" },
];

export function PhotosPanel({ api }: { api: EditorApi }) {
  const photos = sortByZ(api.composition.elements).filter((element) => element.type === "photo" || element.type === "frame").reverse();
  const selected = api.selected;
  const selectedPhoto = selected?.type === "photo" ? selected : undefined;
  const crop = normalizeCrop(selectedPhoto?.crop);
  const updateCrop = (patch: Partial<typeof crop>, record = true) => selectedPhoto && api.apply((composition) => updateElement(composition, selectedPhoto.id, { crop: { ...crop, ...patch } }), { record });

  return (
    <div>
      <Section title="Añadir foto">
        {api.uploading ? <Mascot name="32-subir-foto-nube" size="sm" className="mx-auto mb-3" decorative={false} alt="Subiendo fotos" /> : null}
        <div className="grid gap-2">
          {selected?.type === "frame" ? (
            <ActionButton tone="primary" onClick={() => api.requestPhotos({ kind: "fill", id: selected.id })}>
              <ImagePlus size={18} /> Añadir foto al marco
            </ActionButton>
          ) : null}
          <ActionButton tone={selected?.type === "frame" ? "default" : "primary"} onClick={() => api.requestPhotos({ kind: "add" })} disabled={api.uploading}>
            {api.uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />} {api.uploading ? api.uploadStatus : "Añadir foto"}
          </ActionButton>
        </div>
        <p className="mt-2 text-[11px] font-semibold text-cream/50">Puedes elegir varias. JPG, JPEG, PNG, WEBP, HEIC y HEIF. Las fotos HEIC del iPhone se convierten automáticamente.</p>
        {api.uploadError ? (
          <p role="alert" className="mt-2 rounded-xl border-2 border-[#f2c5a0]/60 bg-[#b44728]/25 px-3 py-2 text-[12px] font-bold text-[#fbe3cf]">
            {api.uploadError}
          </p>
        ) : null}
      </Section>

      {photos.length > 0 ? (
        <Section title="Fotos del lienzo">
          <div className="grid grid-cols-4 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => api.select(photo.id)}
                aria-label={`Seleccionar ${elementLabel(photo)}`}
                aria-pressed={selected?.id === photo.id}
                className={`flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 bg-cream/95 ${selected?.id === photo.id ? "border-orange ring-2 ring-orange" : "border-cream/30"}`}
              >
                {photo.src ? <img src={photo.src} alt="" className="h-full w-full object-cover" style={{ filter: getFilterDefinition(photo.filter).css }} /> : <Frame size={20} className="text-ink/50" />}
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      {selectedPhoto ? (
        <>
          <Section title="Foto seleccionada">
            <div className="grid grid-cols-2 gap-2">
              <ActionButton onClick={() => api.requestPhotos({ kind: "replace", id: selectedPhoto.id })}>
                <Replace size={16} /> Reemplazar
              </ActionButton>
              <ActionButton tone="danger" onClick={() => api.apply((composition) => removeElement(composition, selectedPhoto.id), { select: null })}>
                <Trash2 size={16} /> Eliminar foto
              </ActionButton>
            </div>
          </Section>
          <Section title="Marco de la foto">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FRAME_LABELS) as FrameId[]).map((frameId) => (
                <ChipButton key={frameId} active={(selectedPhoto.frameId ?? "none") === frameId} onClick={() => api.apply((composition) => applyFrame(composition, selectedPhoto.id, frameId))}>
                  {FRAME_LABELS[frameId]}
                </ChipButton>
              ))}
            </div>
          </Section>
          <Section title="Ajustar recorte">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <ChipButton active={crop.fit === "cover"} onClick={() => updateCrop({ fit: "cover" })}>
                  Cubrir marco
                </ChipButton>
                <ChipButton active={crop.fit === "contain"} onClick={() => updateCrop({ fit: "contain" })}>
                  Foto entera
                </ChipButton>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Formato del recorte">
                {CROP_FORMATS.map((format) => (
                  <ChipButton key={format.id} onClick={() => api.apply((composition) => setPhotoCropFormat(composition, selectedPhoto.id, format.id))}>
                    {format.label}
                  </ChipButton>
                ))}
              </div>
              <RangeField label="Zoom de la foto" value={Math.round(crop.zoom * 100)} min={100} max={LIMITS.cropZoom.max * 100} format={(value) => `${value}%`} onStart={api.checkpoint} onChange={(value) => updateCrop({ zoom: value / 100 }, false)} />
              <RangeField label="Posición horizontal" value={Math.round(crop.offsetX * 100)} min={-100} max={100} format={(value) => `${value}`} onStart={api.checkpoint} onChange={(value) => updateCrop({ offsetX: value / 100 }, false)} />
              <RangeField label="Posición vertical" value={Math.round(crop.offsetY * 100)} min={-100} max={100} format={(value) => `${value}`} onStart={api.checkpoint} onChange={(value) => updateCrop({ offsetY: value / 100 }, false)} />
              <div className="grid grid-cols-2 gap-2">
                <ActionButton pressed={api.cropMode} onClick={() => api.setCropMode(!api.cropMode)}>
                  <Crop size={16} /> {api.cropMode ? "Moviendo foto" : "Mover dentro"}
                </ActionButton>
                <ActionButton onClick={() => updateCrop({ zoom: 1, offsetX: 0, offsetY: 0, fit: "cover" })}>
                  <RotateCcw size={16} /> Restablecer
                </ActionButton>
              </div>
              {api.cropMode ? <Hint>Arrastra la foto en el lienzo para moverla dentro de su marco.</Hint> : null}
            </div>
          </Section>
        </>
      ) : photos.length > 0 ? (
        <Hint>Selecciona una foto para reemplazarla, cambiar su marco o ajustar el recorte.</Hint>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Texto                                                                       */
/* ------------------------------------------------------------------------- */

const TEXT_BACKGROUNDS = [
  { id: "transparent", label: "Sin fondo" },
  { id: "#EAE7DA", label: "Crema" },
  { id: "#FA9223", label: "Naranja" },
  { id: "#0B2130", label: "Navy" },
];

export function TextPanel({ api }: { api: EditorApi }) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const selected = api.selected?.type === "text" ? api.selected : undefined;
  const style = { ...DEFAULT_TEXT_STYLE, ...selected?.textStyle };
  const note = isNote(selected);

  useLayoutEffect(() => {
    if (!api.textFocusToken || !textRef.current) return;
    const node = textRef.current;
    node.focus({ preventScroll: true });
    node.setSelectionRange(node.value.length, node.value.length);
  }, [api.textFocusToken, selected?.id]);

  const setStyle = (patch: Partial<typeof style>, record = true) => selected && api.apply((composition) => updateElement(composition, selected.id, { textStyle: patch }), { record });

  return (
    <div>
      <Section title="Añadir">
        <div className="grid grid-cols-2 gap-2">
          <ActionButton tone={selected ? "default" : "primary"} onClick={api.addNote}>
            <StickyNote size={18} /> Nota
          </ActionButton>
          <ActionButton onClick={api.addText}>
            <Type size={18} /> Título
          </ActionButton>
        </div>
      </Section>

      {selected ? (
        <>
          <Section title={note ? "Escribe tu nota" : "Escribe tu texto"}>
            <textarea
              ref={textRef}
              aria-label="Texto de la capa"
              value={selected.content ?? ""}
              placeholder="Escribe aquí…"
              rows={3}
              enterKeyHint="done"
              onFocus={api.checkpoint}
              onChange={(event) => {
                const value = event.target.value;
                api.apply((composition) => updateText(composition, selected.id, value), { record: false });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  api.finishText();
                }
              }}
              className="w-full resize-none rounded-xl border-2 border-ink bg-cream px-3 py-2.5 text-[17px] font-bold leading-snug text-ink outline-none placeholder:text-ink/40 focus:ring-4 focus:ring-orange/50"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ActionButton tone="primary" onClick={api.finishText}>
                Listo
              </ActionButton>
              <ActionButton tone="danger" onClick={() => api.apply((composition) => removeElement(composition, selected.id), { select: null })}>
                <Trash2 size={16} /> Eliminar
              </ActionButton>
            </div>
          </Section>

          <Section title="Tipografía">
            <div className="flex flex-wrap gap-2">
              {FONT_FAMILIES.map((font) => (
                <ChipButton key={font.id} active={style.fontFamily === font.id} onClick={() => setStyle({ fontFamily: font.id })} style={{ fontFamily: font.css }}>
                  {font.label}
                </ChipButton>
              ))}
            </div>
          </Section>

          <Section title="Tamaño y estilo">
            <div className="space-y-4">
              <RangeField
                label="Tamaño de letra"
                value={style.fontSize}
                min={LIMITS.fontSize.min}
                max={LIMITS.fontSize.max}
                format={(value) => `${value}`}
                onStart={api.checkpoint}
                onChange={(value) => setStyle({ fontSize: value }, false)}
                onStep={(direction) => setStyle({ fontSize: style.fontSize + direction * 8 })}
              />
              <div className="flex flex-wrap gap-2">
                <div className="flex gap-1 rounded-xl border-2 border-cream/20 p-1" role="group" aria-label="Alineación">
                  {([
                    ["left", AlignLeft, "Alinear a la izquierda"],
                    ["center", AlignCenter, "Centrar texto"],
                    ["right", AlignRight, "Alinear a la derecha"],
                  ] as const).map(([align, Icon, label]) => (
                    <button key={align} type="button" aria-label={label} aria-pressed={style.align === align} onClick={() => setStyle({ align })} className={`flex h-9 w-10 items-center justify-center rounded-lg ${style.align === align ? "bg-orange text-ink" : "text-cream hover:bg-cream/10"}`}>
                      <Icon size={17} />
                    </button>
                  ))}
                </div>
                <button type="button" aria-label="Negrita" aria-pressed={style.fontWeight >= 700} onClick={() => setStyle({ fontWeight: style.fontWeight >= 700 ? 400 : 700 })} className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 ${style.fontWeight >= 700 ? "border-orange bg-orange text-ink" : "border-cream/20 text-cream"}`}>
                  <Bold size={17} />
                </button>
                <button type="button" aria-label="Cursiva" aria-pressed={style.italic} onClick={() => setStyle({ italic: !style.italic })} className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 ${style.italic ? "border-orange bg-orange text-ink" : "border-cream/20 text-cream"}`}>
                  <Italic size={17} />
                </button>
              </div>
            </div>
          </Section>

          <Section title="Color">
            <Swatches colors={TEXT_COLORS} value={style.color} label="Color del texto" onChange={(color) => setStyle({ color })} />
          </Section>

          {note ? (
            <Section title="Color de la nota">
              <Swatches colors={NOTE_COLORS.map((color) => color.value)} value={style.background} label="Color de la nota" onChange={(color) => setStyle({ background: color })} />
            </Section>
          ) : (
            <Section title="Fondo del texto">
              <div className="flex flex-wrap gap-2">
                {TEXT_BACKGROUNDS.map((background) => (
                  <ChipButton key={background.id} active={(style.background ?? "transparent") === background.id} onClick={() => setStyle({ background: background.id })}>
                    {background.label}
                  </ChipButton>
                ))}
              </div>
            </Section>
          )}
        </>
      ) : (
        <Hint>Toca una nota o un texto del cuaderno para editarlo.</Hint>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Filtros                                                                     */
/* ------------------------------------------------------------------------- */

export function FiltersPanel({ api }: { api: EditorApi }) {
  const photo = api.selected?.type === "photo" && api.selected.src ? api.selected : undefined;
  if (!photo) {
    const firstPhoto = sortByZ(api.composition.elements).reverse().find((element) => element.type === "photo" && element.src);
    return (
      <div className="space-y-3">
        <Hint>Selecciona una foto del lienzo para aplicarle un filtro. La foto original no se modifica.</Hint>
        {firstPhoto ? (
          <ActionButton onClick={() => api.select(firstPhoto.id)}>
            <ImagePlus size={16} /> Seleccionar la foto de arriba
          </ActionButton>
        ) : (
          <ActionButton onClick={() => api.requestPhotos({ kind: "add" })}>
            <ImagePlus size={16} /> Añadir foto
          </ActionButton>
        )}
      </div>
    );
  }
  return (
    <Section title="Filtros de la foto">
      <div className="grid grid-cols-3 gap-2">
        {PHOTO_FILTERS.map((filter) => {
          const active = (photo.filter ?? "original") === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={active}
              aria-label={`Filtro ${filter.label}`}
              onClick={() => api.apply((composition) => setPhotoFilter(composition, photo.id, filter.id))}
              className={`overflow-hidden rounded-xl border-2 text-left transition-transform hover:-translate-y-0.5 ${active ? "border-orange ring-2 ring-orange" : "border-cream/25"}`}
            >
              <span className="relative block aspect-square">
                <img src={photo.src} alt="" className="h-full w-full object-cover" style={{ filter: filter.css === "none" ? undefined : filter.css }} />
                {filter.overlay ? <span className="absolute inset-0" style={{ background: filter.overlay, mixBlendMode: filter.blend as CSSProperties["mixBlendMode"] }} /> : null}
              </span>
              <span className={`block px-1.5 py-1.5 text-[11px] font-black ${active ? "bg-orange text-ink" : "text-cream"}`}>{filter.label}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------------- */
/* Capas                                                                       */
/* ------------------------------------------------------------------------- */

function LayerActions({ api, element }: { api: EditorApi; element: CanvasElement }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ActionButton onClick={() => api.apply((composition) => bringToFront(composition, element.id))}>
        <ArrowUpToLine size={16} /> Traer al frente
      </ActionButton>
      <ActionButton onClick={() => api.apply((composition) => sendToBack(composition, element.id))}>
        <ArrowDownToLine size={16} /> Enviar al fondo
      </ActionButton>
      <ActionButton onClick={() => api.apply((composition) => moveLayer(composition, element.id, "up"))}>
        <ChevronUp size={16} /> Subir capa
      </ActionButton>
      <ActionButton onClick={() => api.apply((composition) => moveLayer(composition, element.id, "down"))}>
        <ChevronDown size={16} /> Bajar capa
      </ActionButton>
    </div>
  );
}

export function LayersPanel({ api }: { api: EditorApi }) {
  const ordered = sortByZ(api.composition.elements).reverse();
  const selected = api.selected;
  return (
    <div>
      {selected ? (
        <Section title="Orden del elemento">
          <LayerActions api={api} element={selected} />
          <div className="mt-2">
            <ActionButton tone="danger" onClick={() => api.apply((composition) => removeElement(composition, selected.id), { select: null })}>
              <Trash2 size={16} /> Eliminar elemento
            </ActionButton>
          </div>
        </Section>
      ) : null}
      <Section title={`Capas · ${ordered.length}`}>
        {ordered.length === 0 ? <Hint>El cuaderno está vacío. Añade fotos, notas o decoración.</Hint> : null}
        <ol className="space-y-1.5" aria-label="Orden de las capas, de delante hacia atrás">
          {ordered.map((element, index) => {
            const Icon = isNote(element) ? StickyNote : TYPE_ICON[element.type];
            const isSelected = selected?.id === element.id;
            return (
              <li key={element.id} className={`flex items-center gap-1 rounded-xl border-2 ${isSelected ? "border-orange bg-orange/15" : "border-cream/15"} ${element.visible === false ? "opacity-50" : ""}`}>
                <button type="button" onClick={() => api.select(element.id)} aria-current={isSelected} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2.5 text-left text-[13px] font-black text-cream">
                  <span className="w-5 shrink-0 text-center text-[10px] tabular-nums text-cream/45">{ordered.length - index}</span>
                  <Icon size={15} className="shrink-0 text-orange" />
                  <span className="truncate">{elementLabel(element)}</span>
                </button>
                <button
                  type="button"
                  aria-label={element.visible === false ? "Mostrar capa" : "Ocultar capa"}
                  onClick={() => api.apply((composition) => updateElement(composition, element.id, { visible: element.visible === false }))}
                  className="flex h-10 w-9 items-center justify-center text-cream/70 hover:text-orange"
                >
                  {element.visible === false ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  type="button"
                  aria-label={element.locked ? "Desbloquear capa" : "Bloquear capa"}
                  onClick={() => api.apply((composition) => updateElement(composition, element.id, { locked: !element.locked }))}
                  className="mr-1 flex h-10 w-9 items-center justify-center text-cream/70 hover:text-orange"
                >
                  {element.locked ? <Lock size={15} /> : <LockOpen size={15} />}
                </button>
              </li>
            );
          })}
        </ol>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Ajustes del elemento seleccionado                                            */
/* ------------------------------------------------------------------------- */

export function AdjustPanel({ api }: { api: EditorApi }) {
  const element = api.selected;
  if (!element) {
    return (
      <div className="space-y-3">
        <Hint>Toca algo del cuaderno para moverlo, girarlo o cambiar su tamaño.</Hint>
        <p className="text-[12px] font-semibold text-cream/50">{api.composition.elements.length} elementos</p>
      </div>
    );
  }
  const sample = getDecorationSample(element.sampleId);
  const colorable = sample?.colorable || element.type === "frame" || element.type === "photo";
  const note = isNote(element);
  const id = element.id;
  const set = (patch: Partial<CanvasElement>, record = true) => api.apply((composition) => updateElement(composition, id, patch), { record });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-xl border-2 border-orange/50 bg-orange/10 px-3 py-2">
        <span className="text-[10px] font-black uppercase tracking-[.16em] text-orange">Seleccionado</span>
        <span className="truncate text-[13px] font-black text-cream">{elementLabel(element)}</span>
      </div>

      {element.type === "text" ? (
        <div className="mb-4">
          <ActionButton tone="primary" onClick={() => api.openPanel("texto")}>
            {isNote(element) ? <StickyNote size={16} /> : <Type size={16} />} {isNote(element) ? "Editar nota" : "Editar texto y estilo"}
          </ActionButton>
        </div>
      ) : null}
      {element.type === "photo" ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <ActionButton onClick={() => api.openPanel("filtros")}>
            <Wand2 size={16} /> Filtros
          </ActionButton>
          <ActionButton onClick={() => api.openPanel("fotos")}>
            <Crop size={16} /> Recorte
          </ActionButton>
        </div>
      ) : null}
      {element.type === "frame" ? (
        <div className="mb-4">
          <ActionButton tone="primary" onClick={() => api.requestPhotos({ kind: "fill", id })}>
            <ImagePlus size={16} /> Añadir foto al marco
          </ActionButton>
        </div>
      ) : null}

      <Section title="Cambiar tamaño" action={<button type="button" onClick={() => set({ scale: 1 })} className="text-[11px] font-black text-orange underline">Restablecer</button>}>
        <RangeField
          label="Escala"
          value={Math.round(element.scale * 100)}
          min={LIMITS.elementScale.min * 100}
          max={LIMITS.elementScale.max * 100}
          format={(value) => `${value}%`}
          onStart={api.checkpoint}
          onChange={(value) => set({ scale: value / 100 }, false)}
          onStep={(direction) => set({ scale: element.scale + direction * 0.1 })}
        />
      </Section>

      <Section title="Rotar" action={<button type="button" onClick={() => set({ rotation: 0 })} className="text-[11px] font-black text-orange underline">Restablecer</button>}>
        <RangeField
          label="Rotación"
          value={Math.round(element.rotation)}
          min={LIMITS.rotation.min}
          max={LIMITS.rotation.max}
          format={(value) => `${value}°`}
          onStart={api.checkpoint}
          onChange={(value) => set({ rotation: value }, false)}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ActionButton onClick={() => set({ rotation: element.rotation - 15 })}>
            <RotateCcw size={16} /> −15°
          </ActionButton>
          <ActionButton onClick={() => set({ rotation: element.rotation + 15 })}>
            <RotateCw size={16} /> +15°
          </ActionButton>
        </div>
      </Section>

      {note ? (
        <Section title="Color de la nota">
          <Swatches colors={NOTE_COLORS.map((color) => color.value)} value={element.textStyle?.background} label="Color de la nota" onChange={(color) => set({ textStyle: { background: color } })} />
        </Section>
      ) : null}

      {colorable ? (
        <Section title={element.type === "photo" || element.type === "frame" ? "Color del marco" : "Color"}>
          <Swatches colors={ELEMENT_COLORS} value={element.color ?? sample?.color} label="Color del elemento" onChange={(color) => set({ color })} />
        </Section>
      ) : null}

      {sample?.text !== undefined ? (
        <Section title="Texto del elemento">
          <input
            aria-label="Texto del elemento"
            value={element.content ?? ""}
            onFocus={api.checkpoint}
            onChange={(event) => set({ content: event.target.value }, false)}
            className="w-full rounded-xl border-2 border-ink bg-cream px-3 py-2.5 text-[16px] font-bold text-ink outline-none focus:ring-4 focus:ring-orange/50"
          />
        </Section>
      ) : null}

      <Section title="Opacidad">
        <RangeField label="Opacidad" value={Math.round((element.opacity ?? 1) * 100)} min={10} max={100} format={(value) => `${value}%`} onStart={api.checkpoint} onChange={(value) => set({ opacity: value / 100 }, false)} />
      </Section>

      <Section title="Capas">
        <LayerActions api={api} element={element} />
      </Section>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <ActionButton
          onClick={() => {
            const copyId = createElementId("copy");
            api.apply((composition) => duplicateElement(composition, id, copyId), { select: copyId });
          }}
        >
          <Copy size={16} /> Duplicar
        </ActionButton>
        <ActionButton pressed={element.locked} onClick={() => set({ locked: !element.locked })}>
          {element.locked ? <Lock size={16} /> : <LockOpen size={16} />} {element.locked ? "Bloqueado" : "Bloquear"}
        </ActionButton>
        <div className="col-span-2">
          <ActionButton tone="danger" onClick={() => api.apply((composition) => removeElement(composition, id), { select: null })}>
            <Trash2 size={16} /> Eliminar elemento
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export function PanelContent({ panel, api }: { panel: PanelId; api: EditorApi }) {
  switch (panel) {
    case "diseno":
      return <DesignPanel api={api} />;
    case "elementos":
      return <ElementsPanel api={api} />;
    case "fotos":
      return <PhotosPanel api={api} />;
    case "texto":
      return <TextPanel api={api} />;
    case "filtros":
      return <FiltersPanel api={api} />;
    case "capas":
      return <LayersPanel api={api} />;
    case "ajustes":
      return <AdjustPanel api={api} />;
  }
}
