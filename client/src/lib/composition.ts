/**
 * Modelo de composición de un scrapbook.
 *
 * Es la única fuente de verdad para lo que se ve en el editor, en la
 * previsualización y en la vista a pantalla completa. Todas las operaciones son
 * funciones puras que devuelven una composición nueva, para que el editor pueda
 * deshacer/rehacer y para poder testearlas sin navegador.
 *
 * Coordenadas: unidades lógicas del lienzo (canvas.width × canvas.height).
 * `x`/`y` son la esquina superior izquierda de la caja exterior del elemento
 * (incluido su marco). `width`/`height` son el tamaño de la ventana de foto (o
 * de la caja del elemento si no tiene marco). La escala y la rotación se
 * aplican alrededor del centro.
 */

export type PhotoFilter =
  | "original"
  | "noir"
  | "vivid"
  | "contrast"
  | "vintage"
  | "warm"
  | "cool"
  | "fade"
  | "sepia";

export type CanvasElementType = "photo" | "text" | "frame" | "sticker" | "shape" | "decoration";
export type TextAlign = "left" | "center" | "right";
export type FrameId = "none" | "classic" | "navy" | "orange" | "polaroid" | "rounded" | "postcard";
export type PhotoFit = "cover" | "contain";
export type CanvasTexture = "none" | "paper" | "grid" | "dots" | "lines" | "kraft";
export type CanvasFrame = "none" | "thin" | "bold" | "stamp" | "polaroid";

export type TextStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: TextAlign;
  /** Fondo tipo etiqueta detrás del texto. "transparent" = sin fondo. */
  background?: string;
  italic?: boolean;
};

/** Ajuste de la foto dentro de su marco. offsetX/offsetY van de -1 a 1. */
export type PhotoCrop = {
  fit: PhotoFit;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

/** Referencia al archivo. Nunca contiene bytes: solo URL, clave y metadatos. */
export type AssetRef = {
  storagePath?: string;
  publicUrl?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  originalName?: string;
  originalMimeType?: string;
  /** true si el original era HEIC/HEIF y se convirtió a JPEG en el navegador. */
  convertedFromHeic?: boolean;
  /** true cuando `src` es una data URL comprimida de prototipo (solo localStorage). */
  inline?: boolean;
};

export type CanvasElement = {
  id: string;
  type: CanvasElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  z: number;
  locked?: boolean;
  visible?: boolean;
  content?: string;
  src?: string;
  frameId?: FrameId;
  filter?: PhotoFilter;
  textStyle?: TextStyle;
  /** Color principal de stickers, formas y decoraciones. */
  color?: string;
  opacity?: number;
  /** Identificador del sample de la galería Elementos. */
  sampleId?: string;
  crop?: PhotoCrop;
  asset?: AssetRef;
  metadata?: Record<string, unknown>;
};

export type CanvasSettings = {
  width: number;
  height: number;
  background: string;
  backgroundImage?: string;
  texture?: CanvasTexture;
  frame?: CanvasFrame;
  zoom?: number;
  formatId?: string;
};

export type ScrapbookComposition = {
  version: 1;
  canvas: CanvasSettings;
  elements: CanvasElement[];
  updatedAt: string;
};

/* ------------------------------------------------------------------------- */
/* Límites                                                                    */
/* ------------------------------------------------------------------------- */

export const LIMITS = {
  canvasZoom: { min: 0.5, max: 2.5 },
  elementScale: { min: 0.25, max: 3 },
  rotation: { min: -180, max: 180 },
  fontSize: { min: 12, max: 240 },
  cropZoom: { min: 1, max: 3 },
  canvasSide: { min: 320, max: 4000 },
  elementSide: { min: 8, max: 6000 },
} as const;

export function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

const round = (value: number, digits = 3) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const clampCanvasZoom = (value: number) => round(clamp(value, LIMITS.canvasZoom.min, LIMITS.canvasZoom.max));
export const clampElementScale = (value: number) => round(clamp(value, LIMITS.elementScale.min, LIMITS.elementScale.max));
/** Limita la rotación al rango del slider (-180..180). */
export const clampRotation = (value: number) => round(clamp(value, LIMITS.rotation.min, LIMITS.rotation.max), 2);
/** Envuelve cualquier ángulo al rango -180..180 (para gestos que dan varias vueltas). */
export function normalizeRotation(value: number) {
  if (!Number.isFinite(value)) return 0;
  const wrapped = ((((value + 180) % 360) + 360) % 360) - 180;
  return round(wrapped === -180 && value > 0 ? 180 : wrapped, 2);
}
export const clampFontSize = (value: number) => Math.round(clamp(value, LIMITS.fontSize.min, LIMITS.fontSize.max));
export const clampCropZoom = (value: number) => round(clamp(value, LIMITS.cropZoom.min, LIMITS.cropZoom.max));

/* ------------------------------------------------------------------------- */
/* Filtros                                                                    */
/* ------------------------------------------------------------------------- */

export type FilterDefinition = { id: PhotoFilter; label: string; css: string; overlay?: string; blend?: string };

export const PHOTO_FILTERS: FilterDefinition[] = [
  { id: "original", label: "Original", css: "none" },
  { id: "noir", label: "Blanco y negro", css: "grayscale(1) contrast(1.12)" },
  { id: "vivid", label: "Más color", css: "saturate(1.6) contrast(1.05)" },
  { id: "contrast", label: "Contraste", css: "contrast(1.38) saturate(1.08)" },
  { id: "vintage", label: "Vintage", css: "sepia(.38) saturate(.85) contrast(1.06) brightness(1.04)", overlay: "rgba(250,146,35,.10)", blend: "multiply" },
  { id: "warm", label: "Cálido", css: "saturate(1.2) brightness(1.03)", overlay: "rgba(250,146,35,.18)", blend: "soft-light" },
  { id: "cool", label: "Frío", css: "saturate(.92) brightness(1.03)", overlay: "rgba(70,130,210,.20)", blend: "soft-light" },
  { id: "fade", label: "Fade", css: "contrast(.82) brightness(1.1) saturate(.78)", overlay: "rgba(234,231,218,.22)", blend: "normal" },
  { id: "sepia", label: "Sepia", css: "sepia(.92) contrast(1.04)" },
];

const FILTER_IDS = new Set<PhotoFilter>(PHOTO_FILTERS.map((item) => item.id));

export function isPhotoFilter(value: unknown): value is PhotoFilter {
  return typeof value === "string" && FILTER_IDS.has(value as PhotoFilter);
}

export function getFilterDefinition(filter: PhotoFilter | undefined): FilterDefinition {
  return PHOTO_FILTERS.find((item) => item.id === filter) ?? PHOTO_FILTERS[0];
}

/* ------------------------------------------------------------------------- */
/* Marcos de foto                                                              */
/* ------------------------------------------------------------------------- */

export type FramePadding = { top: number; right: number; bottom: number; left: number };

/** Padding de cada marco como fracción del lado corto de la foto, para que nunca quede desproporcionado. */
const FRAME_RATIOS: Record<FrameId, FramePadding> = {
  none: { top: 0, right: 0, bottom: 0, left: 0 },
  classic: { top: 0.055, right: 0.055, bottom: 0.055, left: 0.055 },
  navy: { top: 0.045, right: 0.045, bottom: 0.045, left: 0.045 },
  orange: { top: 0.045, right: 0.045, bottom: 0.045, left: 0.045 },
  polaroid: { top: 0.06, right: 0.06, bottom: 0.24, left: 0.06 },
  rounded: { top: 0.04, right: 0.04, bottom: 0.04, left: 0.04 },
  postcard: { top: 0.06, right: 0.06, bottom: 0.13, left: 0.06 },
};

export const FRAME_IDS = Object.keys(FRAME_RATIOS) as FrameId[];

export function isFrameId(value: unknown): value is FrameId {
  return typeof value === "string" && value in FRAME_RATIOS;
}

export function getFramePadding(frameId: FrameId | undefined, width: number, height: number): FramePadding {
  const ratios = FRAME_RATIOS[frameId ?? "none"] ?? FRAME_RATIOS.none;
  const side = Math.min(Math.abs(width), Math.abs(height));
  return {
    top: round(ratios.top * side, 2),
    right: round(ratios.right * side, 2),
    bottom: round(ratios.bottom * side, 2),
    left: round(ratios.left * side, 2),
  };
}

const hasFrame = (element: CanvasElement) => element.type === "photo" || element.type === "frame";

/** Caja exterior (con marco) en unidades del lienzo, sin escala ni rotación. */
export function getOuterSize(element: CanvasElement) {
  if (!hasFrame(element)) return { width: element.width, height: element.height };
  const pad = getFramePadding(element.frameId, element.width, element.height);
  return { width: element.width + pad.left + pad.right, height: element.height + pad.top + pad.bottom };
}

/** Caja visual aproximada (con escala, sin rotación) usada para guías y alineado. */
export function getVisualBox(element: CanvasElement) {
  const outer = getOuterSize(element);
  const cx = element.x + outer.width / 2;
  const cy = element.y + outer.height / 2;
  const w = outer.width * element.scale;
  const h = outer.height * element.scale;
  return { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2, cx, cy, width: w, height: h };
}

export function getCenter(element: CanvasElement) {
  const outer = getOuterSize(element);
  return { x: element.x + outer.width / 2, y: element.y + outer.height / 2 };
}

/** Ajusta la caja (ancho/alto) a la proporción de la foto conservando el lado largo. */
export function fitSizeToAspect(longSide: number, aspect: number) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 4 / 3;
  if (safeAspect >= 1) return { width: round(longSide, 2), height: round(longSide / safeAspect, 2) };
  return { width: round(longSide * safeAspect, 2), height: round(longSide, 2) };
}

/** Estilo CSS de la foto dentro de su ventana: object-fit + desplazamiento + zoom. */
export function getPhotoImageStyle(crop: PhotoCrop | undefined) {
  const safe = normalizeCrop(crop);
  const posX = round(50 + safe.offsetX * 50, 2);
  const posY = round(50 + safe.offsetY * 50, 2);
  return {
    objectFit: safe.fit,
    objectPosition: `${posX}% ${posY}%`,
    transform: safe.zoom === 1 ? undefined : `scale(${safe.zoom})`,
    transformOrigin: `${posX}% ${posY}%`,
  } as const;
}

export const DEFAULT_CROP: PhotoCrop = { fit: "cover", zoom: 1, offsetX: 0, offsetY: 0 };

export function normalizeCrop(crop: Partial<PhotoCrop> | undefined): PhotoCrop {
  return {
    fit: crop?.fit === "contain" ? "contain" : "cover",
    zoom: clampCropZoom(crop?.zoom ?? 1),
    offsetX: round(clamp(crop?.offsetX ?? 0, -1, 1)),
    offsetY: round(clamp(crop?.offsetY ?? 0, -1, 1)),
  };
}

/* ------------------------------------------------------------------------- */
/* Tipografías                                                                 */
/* ------------------------------------------------------------------------- */

export const FONT_FAMILIES = [
  { id: "brand", label: "Brasika", css: '"Brasika Display - Trial", "Briska", "Cormorant Garamond", Georgia, serif' },
  { id: "serif", label: "Cormorant", css: '"Cormorant Garamond", Georgia, serif' },
  { id: "hand", label: "Manuscrita", css: '"Caveat", "Segoe Print", "Bradley Hand", cursive' },
  { id: "mono", label: "Máquina", css: '"Space Mono", "Courier New", monospace' },
  { id: "classic", label: "Clásica", css: 'Georgia, "Times New Roman", serif' },
] as const;

export function getFontCss(fontFamily: string | undefined) {
  return FONT_FAMILIES.find((font) => font.id === fontFamily)?.css ?? fontFamily ?? FONT_FAMILIES[0].css;
}

export const DEFAULT_TEXT_STYLE: Required<Omit<TextStyle, "italic">> & { italic: boolean } = {
  fontFamily: "brand",
  fontSize: 64,
  fontWeight: 400,
  color: "#0B2130",
  align: "center",
  background: "transparent",
  italic: false,
};

/** Alto estimado de un bloque de texto (para guías y para colocarlo). */
export function estimateTextHeight(content: string, style: TextStyle | undefined, width: number) {
  const fontSize = style?.fontSize ?? DEFAULT_TEXT_STYLE.fontSize;
  const charsPerLine = Math.max(4, Math.floor(width / (fontSize * 0.52)));
  const lines = (content || " ").split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  const padding = style?.background && style.background !== "transparent" ? fontSize * 0.6 : 0;
  return round(lines * fontSize * 1.15 + padding, 2);
}

/* ------------------------------------------------------------------------- */
/* Fábricas                                                                    */
/* ------------------------------------------------------------------------- */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID_PATTERN.test(value);

function randomUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** Ids uuid: coinciden con la clave primaria de scrapbook_elements en Supabase. */
export function createElementId(_prefix?: string) {
  return randomUuid();
}

/** Sustituye ids antiguos (no uuid) por uuids, p. ej. antes de sincronizar una composición local. */
export function ensureUuidIds(composition: ScrapbookComposition): ScrapbookComposition {
  if (composition.elements.every((element) => isUuid(element.id))) return composition;
  return {
    ...composition,
    elements: composition.elements.map((element) =>
      isUuid(element.id) ? element : { ...element, id: randomUuid(), metadata: { ...element.metadata, legacyId: element.id } },
    ),
  };
}

export function maxZ(elements: CanvasElement[]) {
  return elements.reduce((max, element) => Math.max(max, element.z), 0);
}

export type Point = { x: number; y: number };

const canvasCenter = (composition: ScrapbookComposition): Point => ({ x: composition.canvas.width / 2, y: composition.canvas.height / 2 });

/** Coloca un elemento centrado en `center` (por defecto el centro del lienzo). */
function centeredAt(element: CanvasElement, center: Point): CanvasElement {
  const outer = getOuterSize(element);
  return { ...element, x: round(center.x - outer.width / 2, 2), y: round(center.y - outer.height / 2, 2) };
}

export type TextInit = { content?: string; center?: Point; textStyle?: TextStyle; width?: number };

export function createTextElement(composition: ScrapbookComposition, init: TextInit = {}): CanvasElement {
  const width = init.width ?? Math.round(composition.canvas.width * 0.5);
  const textStyle = { ...DEFAULT_TEXT_STYLE, ...init.textStyle };
  const content = init.content ?? "";
  const element: CanvasElement = {
    id: createElementId("text"),
    type: "text",
    x: 0,
    y: 0,
    width,
    height: estimateTextHeight(content, textStyle, width),
    rotation: 0,
    scale: 1,
    z: maxZ(composition.elements) + 1,
    visible: true,
    content,
    textStyle,
  };
  return centeredAt(element, init.center ?? canvasCenter(composition));
}

export type PhotoInit = {
  src: string;
  naturalWidth?: number;
  naturalHeight?: number;
  center?: Point;
  frameId?: FrameId;
  asset?: AssetRef;
  rotation?: number;
};

export function defaultPhotoLongSide(composition: ScrapbookComposition) {
  return Math.round(Math.min(composition.canvas.width, composition.canvas.height) * 0.5);
}

export function createPhotoElement(composition: ScrapbookComposition, init: PhotoInit): CanvasElement {
  const aspect = init.naturalWidth && init.naturalHeight ? init.naturalWidth / init.naturalHeight : 4 / 3;
  const size = fitSizeToAspect(defaultPhotoLongSide(composition), aspect);
  const element: CanvasElement = {
    id: createElementId("photo"),
    type: "photo",
    x: 0,
    y: 0,
    ...size,
    rotation: init.rotation ?? 0,
    scale: 1,
    z: maxZ(composition.elements) + 1,
    visible: true,
    src: init.src,
    frameId: init.frameId ?? "classic",
    filter: "original",
    crop: { ...DEFAULT_CROP },
    asset: init.asset ?? (init.naturalWidth && init.naturalHeight ? { width: init.naturalWidth, height: init.naturalHeight } : undefined),
  };
  return centeredAt(element, init.center ?? canvasCenter(composition));
}

export function createFrameElement(composition: ScrapbookComposition, frameId: FrameId, aspect: number, center?: Point): CanvasElement {
  const size = fitSizeToAspect(Math.round(defaultPhotoLongSide(composition) * 0.9), aspect);
  const element: CanvasElement = {
    id: createElementId("frame"),
    type: "frame",
    x: 0,
    y: 0,
    ...size,
    rotation: 0,
    scale: 1,
    z: maxZ(composition.elements) + 1,
    visible: true,
    frameId,
  };
  return centeredAt(element, center ?? canvasCenter(composition));
}

export type DecorationInit = {
  type: Extract<CanvasElementType, "sticker" | "shape" | "decoration">;
  sampleId: string;
  width: number;
  height: number;
  color?: string;
  content?: string;
  rotation?: number;
  center?: Point;
};

export function createDecorationElement(composition: ScrapbookComposition, init: DecorationInit): CanvasElement {
  const element: CanvasElement = {
    id: createElementId(init.type),
    type: init.type,
    x: 0,
    y: 0,
    width: init.width,
    height: init.height,
    rotation: init.rotation ?? 0,
    scale: 1,
    z: maxZ(composition.elements) + 1,
    visible: true,
    sampleId: init.sampleId,
    color: init.color,
    content: init.content,
  };
  return centeredAt(element, init.center ?? canvasCenter(composition));
}

/* ------------------------------------------------------------------------- */
/* Operaciones puras                                                           */
/* ------------------------------------------------------------------------- */

const withElements = (composition: ScrapbookComposition, elements: CanvasElement[]): ScrapbookComposition => ({ ...composition, elements });

export function findElement(composition: ScrapbookComposition, id: string | null | undefined) {
  if (!id) return undefined;
  return composition.elements.find((element) => element.id === id);
}

export function addElement(composition: ScrapbookComposition, element: CanvasElement): ScrapbookComposition {
  return withElements(composition, normalizeZ([...composition.elements, { ...element, z: maxZ(composition.elements) + 1 }]));
}

/** Aplica un parche con los valores siempre dentro de sus límites. */
export function sanitizePatch(element: CanvasElement, patch: Partial<CanvasElement>): Partial<CanvasElement> {
  const next: Partial<CanvasElement> = { ...patch };
  if (patch.scale !== undefined) next.scale = clampElementScale(patch.scale);
  if (patch.rotation !== undefined) next.rotation = clampRotation(patch.rotation);
  if (patch.width !== undefined) next.width = round(clamp(patch.width, LIMITS.elementSide.min, LIMITS.elementSide.max), 2);
  if (patch.height !== undefined) next.height = round(clamp(patch.height, LIMITS.elementSide.min, LIMITS.elementSide.max), 2);
  if (patch.x !== undefined) next.x = round(patch.x, 2);
  if (patch.y !== undefined) next.y = round(patch.y, 2);
  if (patch.opacity !== undefined) next.opacity = round(clamp(patch.opacity, 0.1, 1), 2);
  if (patch.crop !== undefined) next.crop = normalizeCrop({ ...element.crop, ...patch.crop });
  if (patch.textStyle !== undefined) {
    const style = { ...element.textStyle, ...patch.textStyle };
    if (style.fontSize !== undefined) style.fontSize = clampFontSize(style.fontSize);
    next.textStyle = style;
  }
  return next;
}

export function updateElement(composition: ScrapbookComposition, id: string, patch: Partial<CanvasElement>): ScrapbookComposition {
  let changed = false;
  const elements = composition.elements.map((element) => {
    if (element.id !== id) return element;
    changed = true;
    const next = { ...element, ...sanitizePatch(element, patch) };
    if (next.type === "text" && (patch.content !== undefined || patch.textStyle !== undefined || patch.width !== undefined)) {
      next.height = estimateTextHeight(next.content ?? "", next.textStyle, next.width);
    }
    return next;
  });
  return changed ? withElements(composition, elements) : composition;
}

export function updateText(composition: ScrapbookComposition, id: string, content: string) {
  return updateElement(composition, id, { content });
}

export function removeElement(composition: ScrapbookComposition, id: string): ScrapbookComposition {
  return withElements(composition, normalizeZ(composition.elements.filter((element) => element.id !== id)));
}

export function duplicateElement(composition: ScrapbookComposition, id: string, newId = createElementId("copy")): ScrapbookComposition {
  const source = findElement(composition, id);
  if (!source) return composition;
  const offset = Math.round(composition.canvas.width * 0.025);
  const copy: CanvasElement = { ...source, id: newId, x: source.x + offset, y: source.y + offset, locked: false, z: maxZ(composition.elements) + 1 };
  return withElements(composition, normalizeZ([...composition.elements, copy]));
}

/** Escala el elemento seleccionado con límites. */
export function scaleElement(composition: ScrapbookComposition, id: string, scale: number) {
  return updateElement(composition, id, { scale });
}

export function rotateElement(composition: ScrapbookComposition, id: string, rotation: number) {
  return updateElement(composition, id, { rotation });
}

export function setPhotoFilter(composition: ScrapbookComposition, id: string, filter: PhotoFilter) {
  const element = findElement(composition, id);
  if (!element || element.type !== "photo") return composition;
  return updateElement(composition, id, { filter });
}

/**
 * Cambia el marco de una foto (o de un marco vacío) sin perder la foto.
 * La ventana de foto conserva su tamaño; el marco se recalcula a su alrededor
 * manteniendo el mismo centro.
 */
export function applyFrame(composition: ScrapbookComposition, id: string, frameId: FrameId) {
  const element = findElement(composition, id);
  if (!element || !hasFrame(element)) return composition;
  const center = getCenter(element);
  const next = { ...element, frameId };
  const outer = getOuterSize(next);
  return updateElement(composition, id, { frameId, x: center.x - outer.width / 2, y: center.y - outer.height / 2 });
}

/**
 * Coloca una foto dentro de un marco vacío. El marco hereda la proporción de
 * la foto (conserva su lado largo y su centro), así nunca queda deformado.
 */
export function placePhotoInFrame(
  composition: ScrapbookComposition,
  frameElementId: string,
  photo: { src: string; naturalWidth?: number; naturalHeight?: number; asset?: AssetRef },
) {
  const frame = findElement(composition, frameElementId);
  if (!frame || !hasFrame(frame)) return composition;
  const center = getCenter(frame);
  const aspect = photo.naturalWidth && photo.naturalHeight ? photo.naturalWidth / photo.naturalHeight : frame.width / frame.height;
  const size = fitSizeToAspect(Math.max(frame.width, frame.height), aspect);
  const next: CanvasElement = {
    ...frame,
    type: "photo",
    ...size,
    src: photo.src,
    filter: frame.filter ?? "original",
    crop: { ...DEFAULT_CROP },
    asset: photo.asset ?? { width: photo.naturalWidth, height: photo.naturalHeight },
  };
  const outer = getOuterSize(next);
  return withElements(
    composition,
    composition.elements.map((element) =>
      element.id === frameElementId ? { ...next, x: round(center.x - outer.width / 2, 2), y: round(center.y - outer.height / 2, 2) } : element,
    ),
  );
}

/** Reemplaza la foto conservando marco, filtro, posición y ancho; ajusta el alto a la nueva proporción. */
export function replacePhoto(
  composition: ScrapbookComposition,
  id: string,
  photo: { src: string; naturalWidth?: number; naturalHeight?: number; asset?: AssetRef },
) {
  const element = findElement(composition, id);
  if (!element || (element.type !== "photo" && element.type !== "frame")) return composition;
  return placePhotoInFrame(composition, id, photo);
}

export type CropFormat = "original" | "square" | "vertical" | "horizontal";

/** Recorta la ventana de la foto a un formato (la foto se reencuadra con object-fit: cover). */
export function setPhotoCropFormat(composition: ScrapbookComposition, id: string, format: CropFormat) {
  const element = findElement(composition, id);
  if (!element || element.type !== "photo") return composition;
  const natural = element.asset?.width && element.asset?.height ? element.asset.width / element.asset.height : element.width / element.height;
  const aspect = format === "square" ? 1 : format === "vertical" ? 4 / 5 : format === "horizontal" ? 4 / 3 : natural;
  const center = getCenter(element);
  const size = fitSizeToAspect(Math.max(element.width, element.height), aspect);
  const next = { ...element, ...size };
  const outer = getOuterSize(next);
  return updateElement(composition, id, {
    ...size,
    x: center.x - outer.width / 2,
    y: center.y - outer.height / 2,
    crop: { ...normalizeCrop(element.crop), fit: "cover", offsetX: 0, offsetY: 0 },
  });
}

/* ---------------------------------- Capas ---------------------------------- */

export function sortByZ(elements: CanvasElement[]) {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => a.element.z - b.element.z || a.index - b.index)
    .map(({ element }) => element);
}

/** Reasigna z = 1..n respetando el orden actual. */
export function normalizeZ(elements: CanvasElement[]) {
  const order = new Map(sortByZ(elements).map((element, index) => [element.id, index + 1]));
  return elements.map((element) => (order.get(element.id) === element.z ? element : { ...element, z: order.get(element.id) ?? element.z }));
}

export type LayerMove = "front" | "back" | "up" | "down";

export function moveLayer(composition: ScrapbookComposition, id: string, move: LayerMove): ScrapbookComposition {
  const ordered = sortByZ(composition.elements);
  const index = ordered.findIndex((element) => element.id === id);
  if (index === -1) return composition;
  const next = [...ordered];
  const [item] = next.splice(index, 1);
  const target = move === "front" ? next.length : move === "back" ? 0 : move === "up" ? Math.min(next.length, index + 1) : Math.max(0, index - 1);
  next.splice(target, 0, item);
  const zById = new Map(next.map((element, position) => [element.id, position + 1]));
  return withElements(
    composition,
    composition.elements.map((element) => ({ ...element, z: zById.get(element.id) ?? element.z })),
  );
}

export const bringToFront = (composition: ScrapbookComposition, id: string) => moveLayer(composition, id, "front");
export const sendToBack = (composition: ScrapbookComposition, id: string) => moveLayer(composition, id, "back");

/* --------------------------------- Lienzo ---------------------------------- */

export function updateCanvas(composition: ScrapbookComposition, patch: Partial<CanvasSettings>): ScrapbookComposition {
  const canvas = { ...composition.canvas, ...patch };
  canvas.width = Math.round(clamp(canvas.width, LIMITS.canvasSide.min, LIMITS.canvasSide.max));
  canvas.height = Math.round(clamp(canvas.height, LIMITS.canvasSide.min, LIMITS.canvasSide.max));
  if (canvas.zoom !== undefined) canvas.zoom = clampCanvasZoom(canvas.zoom);
  return { ...composition, canvas };
}

/** Cambia el formato del lienzo recolocando los elementos proporcionalmente (sin deformarlos). */
export function resizeCanvas(composition: ScrapbookComposition, width: number, height: number, formatId?: string): ScrapbookComposition {
  const resized = updateCanvas(composition, { width, height, formatId });
  const sx = resized.canvas.width / composition.canvas.width;
  const sy = resized.canvas.height / composition.canvas.height;
  return {
    ...resized,
    elements: composition.elements.map((element) => {
      const center = getCenter(element);
      const outer = getOuterSize(element);
      return { ...element, x: round(center.x * sx - outer.width / 2, 2), y: round(center.y * sy - outer.height / 2, 2) };
    }),
  };
}

/** Recoloca las fotos según un estilo de composición. */
export function arrangePhotos(composition: ScrapbookComposition, style: "grid" | "collage" | "straighten"): ScrapbookComposition {
  const photos = sortByZ(composition.elements).filter((element) => element.type === "photo" || element.type === "frame");
  if (photos.length === 0) return composition;
  const { width: W, height: H } = composition.canvas;
  const positions = new Map<string, Partial<CanvasElement>>();

  if (style === "straighten") {
    photos.forEach((photo) => positions.set(photo.id, { rotation: 0 }));
  } else if (style === "grid") {
    const cols = Math.ceil(Math.sqrt(photos.length));
    const rows = Math.ceil(photos.length / cols);
    const margin = Math.min(W, H) * 0.07;
    const cellW = (W - margin * 2) / cols;
    const cellH = (H - margin * 2) / rows;
    photos.forEach((photo, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const outer = getOuterSize(photo);
      const fit = Math.min((cellW * 0.86) / outer.width, (cellH * 0.86) / outer.height);
      const scale = clampElementScale(fit);
      const cx = margin + cellW * (col + 0.5);
      const cy = margin + cellH * (row + 0.5);
      positions.set(photo.id, { x: cx - outer.width / 2, y: cy - outer.height / 2, scale, rotation: 0 });
    });
  } else {
    const tilts = [-6, 4, -3, 7, -5, 3];
    photos.forEach((photo, index) => {
      const outer = getOuterSize(photo);
      const angle = (index / photos.length) * Math.PI * 2 - Math.PI / 2;
      const radius = photos.length === 1 ? 0 : Math.min(W, H) * 0.22;
      const cx = W / 2 + Math.cos(angle) * radius * (W / H);
      const cy = H / 2 + Math.sin(angle) * radius;
      const scale = clampElementScale(Math.min(1, (Math.min(W, H) * 0.55) / Math.max(outer.width, outer.height)));
      positions.set(photo.id, { x: cx - outer.width / 2, y: cy - outer.height / 2, rotation: tilts[index % tilts.length], scale });
    });
  }

  let next = composition;
  positions.forEach((patch, id) => {
    next = updateElement(next, id, patch);
  });
  return next;
}

/* ------------------------------------------------------------------------- */
/* Composición por defecto, guardado y validación                              */
/* ------------------------------------------------------------------------- */

export type ScrapbookSeed = { id: string; title: string; location: string; cover?: string; description?: string };

export function createEmptyComposition(now = new Date()): ScrapbookComposition {
  return {
    version: 1,
    canvas: { width: 1200, height: 900, background: "#EAE7DA", texture: "paper", frame: "none", zoom: 1, formatId: "horizontal" },
    elements: [],
    updatedAt: now.toISOString(),
  };
}

/** Composición inicial de un scrapbook que ya tiene portada: la portada es solo el punto de partida. */
export function createStarterComposition(scrapbook: ScrapbookSeed, now = new Date()): ScrapbookComposition {
  const base = createEmptyComposition(now);
  if (!scrapbook.cover) return base;
  const id = (suffix: string) => `${scrapbook.id}-${suffix}`;
  const elements: CanvasElement[] = [
    {
      id: id("cover"),
      type: "photo",
      x: 96,
      y: 120,
      width: 560,
      height: 420,
      rotation: -3,
      scale: 1,
      z: 1,
      visible: true,
      src: scrapbook.cover,
      frameId: "polaroid",
      filter: "original",
      crop: { ...DEFAULT_CROP },
    },
    {
      id: id("tape"),
      type: "decoration",
      sampleId: "tape-stripes",
      x: 290,
      y: 92,
      width: 210,
      height: 54,
      rotation: -7,
      scale: 1,
      z: 2,
      visible: true,
      color: "#FA9223",
    },
    {
      id: id("title"),
      type: "text",
      x: 690,
      y: 170,
      width: 440,
      height: 0,
      rotation: -2,
      scale: 1,
      z: 3,
      visible: true,
      content: scrapbook.title,
      textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 72, align: "left" },
    },
    {
      id: id("location"),
      type: "decoration",
      sampleId: "stamp-location",
      x: 720,
      y: 560,
      width: 330,
      height: 132,
      rotation: 5,
      scale: 1,
      z: 4,
      visible: true,
      color: "#0B2130",
      content: scrapbook.location,
    },
    {
      id: id("star"),
      type: "sticker",
      sampleId: "star-sparkle",
      x: 1040,
      y: 60,
      width: 96,
      height: 96,
      rotation: 8,
      scale: 1,
      z: 5,
      visible: true,
      color: "#FA9223",
    },
  ];
  const withHeights = elements.map((element) =>
    element.type === "text" ? { ...element, height: estimateTextHeight(element.content ?? "", element.textStyle, element.width) } : element,
  );
  return { ...base, elements: withHeights };
}

/** Normaliza la composición antes de guardarla: quita textos vacíos, ordena capas y sella la fecha. */
export function prepareCompositionForSave(composition: ScrapbookComposition, now = new Date()): ScrapbookComposition {
  const elements = normalizeZ(composition.elements.filter((element) => !(element.type === "text" && !(element.content ?? "").trim())));
  return { ...composition, version: 1, elements, updatedAt: now.toISOString() };
}

const ELEMENT_TYPES = new Set<CanvasElementType>(["photo", "text", "frame", "sticker", "shape", "decoration"]);
const TEXTURES = new Set<CanvasTexture>(["none", "paper", "grid", "dots", "lines", "kraft"]);
const CANVAS_FRAMES = new Set<CanvasFrame>(["none", "thin", "bold", "stamp", "polaroid"]);

const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const str = (value: unknown) => (typeof value === "string" ? value : undefined);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Quita las claves con valor undefined para que el JSON guardado sea estable. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function sanitizeElement(raw: unknown): CanvasElement | null {
  if (!isRecord(raw)) return null;
  const type = raw.type as CanvasElementType;
  const id = str(raw.id);
  if (!id || !ELEMENT_TYPES.has(type)) return null;
  const element: CanvasElement = {
    id,
    type,
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    width: clamp(num(raw.width, 200), LIMITS.elementSide.min, LIMITS.elementSide.max),
    height: clamp(num(raw.height, 200), LIMITS.elementSide.min, LIMITS.elementSide.max),
    rotation: clampRotation(num(raw.rotation, 0)),
    scale: clampElementScale(num(raw.scale, 1)),
    z: num(raw.z, 0),
    locked: raw.locked === true ? true : undefined,
    visible: raw.visible === false ? false : true,
  };
  const content = str(raw.content);
  if (content !== undefined) element.content = content;
  const src = str(raw.src);
  if (src !== undefined) element.src = src;
  if (isFrameId(raw.frameId)) element.frameId = raw.frameId;
  if (isPhotoFilter(raw.filter)) element.filter = raw.filter;
  else if (type === "photo") element.filter = "original";
  if (isRecord(raw.textStyle)) {
    const style = raw.textStyle;
    element.textStyle = compact<TextStyle>({
      fontFamily: str(style.fontFamily),
      fontSize: style.fontSize === undefined ? undefined : clampFontSize(num(style.fontSize, DEFAULT_TEXT_STYLE.fontSize)),
      fontWeight: style.fontWeight === undefined ? undefined : num(style.fontWeight, 400),
      color: str(style.color),
      align: style.align === "left" || style.align === "right" || style.align === "center" ? style.align : undefined,
      background: str(style.background),
      italic: typeof style.italic === "boolean" ? style.italic : undefined,
    });
  }
  const color = str(raw.color);
  if (color) element.color = color;
  if (raw.opacity !== undefined) element.opacity = clamp(num(raw.opacity, 1), 0.1, 1);
  const sampleId = str(raw.sampleId);
  if (sampleId) element.sampleId = sampleId;
  if (isRecord(raw.crop)) element.crop = normalizeCrop(raw.crop as Partial<PhotoCrop>);
  if (isRecord(raw.asset)) element.asset = raw.asset as AssetRef;
  if (isRecord(raw.metadata)) element.metadata = raw.metadata;
  return compact(element);
}

/** Valida datos desconocidos (localStorage, API). Devuelve null si no es una composición. */
export function sanitizeComposition(raw: unknown): ScrapbookComposition | null {
  if (!isRecord(raw) || !isRecord(raw.canvas) || !Array.isArray(raw.elements)) return null;
  const canvas = raw.canvas;
  const texture = canvas.texture as CanvasTexture;
  const frame = canvas.frame as CanvasFrame;
  return {
    version: 1,
    canvas: compact<CanvasSettings>({
      width: Math.round(clamp(num(canvas.width, 1200), LIMITS.canvasSide.min, LIMITS.canvasSide.max)),
      height: Math.round(clamp(num(canvas.height, 900), LIMITS.canvasSide.min, LIMITS.canvasSide.max)),
      background: str(canvas.background) ?? "#EAE7DA",
      backgroundImage: str(canvas.backgroundImage),
      texture: TEXTURES.has(texture) ? texture : "none",
      frame: CANVAS_FRAMES.has(frame) ? frame : "none",
      zoom: clampCanvasZoom(num(canvas.zoom, 1)),
      formatId: str(canvas.formatId),
    }),
    elements: normalizeZ(raw.elements.map(sanitizeElement).filter((element): element is CanvasElement => element !== null)),
    updatedAt: str(raw.updatedAt) ?? new Date(0).toISOString(),
  };
}

export function countPhotos(composition: ScrapbookComposition | undefined) {
  return composition?.elements.filter((element) => element.type === "photo").length ?? 0;
}

/** Comparación barata para saber si hay cambios sin guardar (ignora updatedAt). */
export function compositionsEqual(a: ScrapbookComposition, b: ScrapbookComposition) {
  return JSON.stringify({ ...a, updatedAt: "" }) === JSON.stringify({ ...b, updatedAt: "" });
}

export function isDarkColor(color: string) {
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return false;
  const full = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}
