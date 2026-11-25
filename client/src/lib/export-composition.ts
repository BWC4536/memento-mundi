import { createElement } from "react";
import { DecorationArt } from "@/components/scrapbook/decorations";
import {
  DEFAULT_TEXT_STYLE,
  NOTE_MIN_ASPECT,
  NOTE_PADDING_X,
  NOTE_PADDING_Y,
  getContentBounds,
  getFilterDefinition,
  getFontCss,
  getFramePadding,
  getOuterSize,
  isDarkColor,
  normalizeCrop,
  sortByZ,
  type CanvasElement,
  type FrameId,
  type ScrapbookComposition,
} from "./composition";

/**
 * Exporta el cuaderno a una imagen (JPEG) pintándolo directamente en un <canvas>.
 * Usa las mismas medidas y estilos que `CompositionCanvas`, así la imagen
 * coincide con lo que se ve en pantalla. Las texturas con ruido (papel, kraft)
 * se omiten: en la imagen queda el color liso.
 */

const NAVY = "#0B2130";
const MAX_SIDE = 3200;
const MAX_PIXELS = 12_000_000;
const DECORATION_MARGIN = 12;
const BRAND_FONT_FILE = { family: "Brasika Display - Trial", url: "/__manus__/brasika-display-trial.otf" };

type Ctx = CanvasRenderingContext2D;
type Radius = number | [number, number, number, number];

const rr = (ctx: Ctx, x: number, y: number, w: number, h: number, r: Radius) => {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), r);
};

/** Sombra dura de los marcos y textos: anillo (opcional) + copia desplazada. */
function paintBox(ctx: Ctx, w: number, h: number, radius: Radius, fill: string, ring?: { width: number; color: string }, shadow?: { dx: number; dy: number; color: string }) {
  const base = typeof radius === "number" ? radius : 0;
  if (shadow) {
    ctx.fillStyle = shadow.color;
    rr(ctx, shadow.dx, shadow.dy, w, h, radius);
    ctx.fill();
  }
  if (ring) {
    ctx.fillStyle = ring.color;
    rr(ctx, -ring.width, -ring.width, w + ring.width * 2, h + ring.width * 2, typeof radius === "number" ? base + ring.width : radius.map((value) => value + ring.width) as Radius);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  rr(ctx, 0, 0, w, h, radius);
  ctx.fill();
}

/* ------------------------------ Recursos ------------------------------ */

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    if (/^https?:/i.test(src)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

let brandFontData: Promise<string | null> | null = null;
function brandFontDataUrl() {
  brandFontData ??= fetch(BRAND_FONT_FILE.url)
    .then((response) => (response.ok ? response.blob() : Promise.reject(new Error("font"))))
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    )
    .catch(() => null);
  return brandFontData;
}

/** Dibuja una decoración (SVG de la app) en un <img> para pasarla al canvas. */
async function decorationImage(element: CanvasElement, width: number, height: number, pixelsPerUnit: number): Promise<HTMLImageElement | null> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(createElement(DecorationArt, { element }));
  const open = markup.match(/^<svg[^>]*>/)?.[0];
  if (!open) return null;
  const sized = open.replace(/width="100%"/, `width="${width}"`).replace(/height="100%"/, `height="${height}"`).replace("<svg", '<svg x="0" y="0"');
  const inner = sized + markup.slice(open.length);
  const font = markup.includes("Brasika") ? await brandFontDataUrl() : null;
  const defs = font ? `<defs><style>@font-face{font-family:"${BRAND_FONT_FILE.family}";src:url(${font})}</style></defs>` : "";
  const total = DECORATION_MARGIN * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${(width + total) * pixelsPerUnit}" height="${(height + total) * pixelsPerUnit}" viewBox="${-DECORATION_MARGIN} ${-DECORATION_MARGIN} ${width + total} ${height + total}" style="--mm-u:1px">${defs}${inner}</svg>`;
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

/* ------------------------------ Papel ------------------------------ */

function paintPaper(ctx: Ctx, composition: ScrapbookComposition, bounds: { x: number; y: number; width: number; height: number }, backgroundImage: HTMLImageElement | null) {
  const { background, texture } = composition.canvas;
  ctx.fillStyle = background;
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  if (backgroundImage) {
    const scale = Math.max(bounds.width / backgroundImage.naturalWidth, bounds.height / backgroundImage.naturalHeight);
    const w = backgroundImage.naturalWidth * scale;
    const h = backgroundImage.naturalHeight * scale;
    ctx.drawImage(backgroundImage, bounds.x + (bounds.width - w) / 2, bounds.y + (bounds.height - h) / 2, w, h);
  }
  const dark = isDarkColor(background);
  const ink = dark ? "rgba(234,231,218,.16)" : "rgba(11,33,48,.10)";
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const first = (start: number, step: number) => Math.floor(start / step) * step;

  if (texture === "dots") {
    ctx.fillStyle = dark ? "rgba(234,231,218,.28)" : "rgba(11,33,48,.22)";
    for (let x = first(bounds.x, 36); x < right; x += 36) {
      for (let y = first(bounds.y, 36); y < bottom; y += 36) {
        ctx.beginPath();
        ctx.arc(x + 18, y + 18, 2.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (texture === "grid") {
    ctx.fillStyle = ink;
    for (let x = first(bounds.x, 48); x < right; x += 48) ctx.fillRect(x, bounds.y, 2, bounds.height);
    for (let y = first(bounds.y, 48); y < bottom; y += 48) ctx.fillRect(bounds.x, y, bounds.width, 2);
  } else if (texture === "lines") {
    ctx.fillStyle = ink;
    for (let y = first(bounds.y, 46); y < bottom; y += 46) ctx.fillRect(bounds.x, y + 44, bounds.width, 2);
  }
}

/* ------------------------------ Fotos ------------------------------ */

type FrameLook = { background: string; radius: number; inner: number; ring?: { width: number; color: string }; shadow?: { dx: number; dy: number; color: string }; postcard?: boolean };

function frameLook(frameId: FrameId | undefined, width: number, height: number, color?: string): FrameLook | null {
  const side = Math.min(width, height);
  switch (frameId) {
    case "classic":
      return { background: color ?? "#FFFFFF", radius: 6, inner: 2, ring: { width: 3, color: NAVY }, shadow: { dx: 9, dy: 9, color: "rgba(11,33,48,.92)" } };
    case "navy":
      return { background: color ?? NAVY, radius: 10, inner: 4, shadow: { dx: 9, dy: 9, color: "#FA9223" } };
    case "orange":
      return { background: color ?? "#FA9223", radius: 8, inner: 4, ring: { width: 3, color: NAVY }, shadow: { dx: 9, dy: 9, color: NAVY } };
    case "polaroid":
      return { background: color ?? "#FFFDF6", radius: 4, inner: 2, ring: { width: 2, color: "rgba(11,33,48,.85)" }, shadow: { dx: 10, dy: 12, color: "rgba(11,33,48,.32)" } };
    case "rounded":
      return { background: color ?? "#EAE7DA", radius: side * 0.16, inner: side * 0.12, ring: { width: 3, color: NAVY }, shadow: { dx: 9, dy: 9, color: NAVY } };
    case "postcard":
      return { background: color ?? "#FFFDF6", radius: 4, inner: 2, shadow: { dx: 8, dy: 8, color: "rgba(11,33,48,.85)" }, postcard: true };
    default:
      return null;
  }
}

function paintPhoto(ctx: Ctx, element: CanvasElement, image: HTMLImageElement | null) {
  const outer = getOuterSize(element);
  const pad = getFramePadding(element.frameId, element.width, element.height);
  const look = frameLook(element.frameId, element.width, element.height, element.color);
  if (look) {
    paintBox(ctx, outer.width, outer.height, look.radius, look.background, look.ring, look.shadow);
    if (look.postcard) {
      const inset = Math.min(element.width, element.height) * 0.025;
      ctx.save();
      ctx.setLineDash([9, 6]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = NAVY;
      rr(ctx, inset, inset, outer.width - inset * 2, outer.height - inset * 2, 4);
      ctx.stroke();
      ctx.restore();
      const size = Math.max(9, Math.min(element.width, element.height) * 0.045);
      ctx.save();
      ctx.font = `700 ${size}px ${getFontCss("mono")}`;
      ctx.fillStyle = "rgba(11,33,48,.7)";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("POSTAL · MEMENTO MUNDI", outer.width / 2, outer.height - pad.bottom * 0.32);
      ctx.restore();
    }
  }

  ctx.save();
  rr(ctx, pad.left, pad.top, element.width, element.height, look?.inner ?? 0);
  ctx.clip();
  ctx.fillStyle = "#D8E2DC";
  ctx.fillRect(pad.left, pad.top, element.width, element.height);

  if (image) {
    const crop = normalizeCrop(element.crop);
    const scale = crop.fit === "contain" ? Math.min(element.width / image.naturalWidth, element.height / image.naturalHeight) : Math.max(element.width / image.naturalWidth, element.height / image.naturalHeight);
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const fx = (50 + crop.offsetX * 50) / 100;
    const fy = (50 + crop.offsetY * 50) / 100;
    const filter = getFilterDefinition(element.filter);
    ctx.save();
    const ox = pad.left + element.width * fx;
    const oy = pad.top + element.height * fy;
    ctx.translate(ox, oy);
    ctx.scale(crop.zoom, crop.zoom);
    ctx.translate(-ox, -oy);
    if (filter.css !== "none") ctx.filter = filter.css;
    ctx.drawImage(image, pad.left + (element.width - drawW) * fx, pad.top + (element.height - drawH) * fy, drawW, drawH);
    ctx.restore();
    if (filter.overlay) {
      ctx.globalCompositeOperation = (filter.blend && filter.blend !== "normal" ? filter.blend : "source-over") as GlobalCompositeOperation;
      ctx.fillStyle = filter.overlay;
      ctx.fillRect(pad.left, pad.top, element.width, element.height);
    }
  }
  ctx.restore();
}

/* ------------------------------ Texto ------------------------------ */

type TextLayout = { lines: string[]; height: number; font: string; fontSize: number; lineHeight: number; padX: number; padY: number; note: boolean; boxed: boolean };

function wrapLines(ctx: Ctx, content: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of content.split("\n")) {
    const words = paragraph.split(/ +/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      let rest = word;
      while (ctx.measureText(rest).width > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

function applyLetterSpacing(ctx: Ctx, family: string | undefined, fontSize: number) {
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = family === "brand" ? `${-0.02 * fontSize}px` : "0px";
}

function layoutText(ctx: Ctx, element: CanvasElement): TextLayout {
  const style = { ...DEFAULT_TEXT_STYLE, ...element.textStyle };
  const fontSize = style.fontSize;
  const note = style.variant === "note";
  const boxed = !note && !!style.background && style.background !== "transparent";
  const padX = note ? fontSize * NOTE_PADDING_X : boxed ? fontSize * 0.38 : 0;
  const padY = note ? fontSize * NOTE_PADDING_Y : boxed ? fontSize * 0.22 : 0;
  const lineHeight = fontSize * (note ? 1.2 : 1.12);
  const font = `${style.italic ? "italic " : ""}${style.fontWeight} ${fontSize}px ${getFontCss(style.fontFamily)}`;
  ctx.save();
  ctx.font = font;
  applyLetterSpacing(ctx, style.fontFamily, fontSize);
  const lines = wrapLines(ctx, element.content ?? "", Math.max(1, element.width - padX * 2));
  ctx.restore();
  const content = lines.length * lineHeight + padY * 2;
  const height = Math.max(content, note ? element.width * NOTE_MIN_ASPECT : fontSize * 1.12);
  return { lines, height, font, fontSize, lineHeight, padX, padY, note, boxed };
}

function paintText(ctx: Ctx, element: CanvasElement, layout: TextLayout) {
  const style = { ...DEFAULT_TEXT_STYLE, ...element.textStyle };
  const { width } = element;
  if (layout.note) {
    const paper = style.background && style.background !== "transparent" ? style.background : "#FBE7A1";
    paintBox(ctx, width, layout.height, [4, 4, 18, 4], paper, { width: 2, color: "rgba(11,33,48,.55)" }, { dx: 6, dy: 8, color: "rgba(11,33,48,.22)" });
  } else if (layout.boxed) {
    paintBox(ctx, width, layout.height, layout.fontSize * 0.2, style.background, { width: 3, color: NAVY }, { dx: 5, dy: 5, color: NAVY });
  }
  ctx.font = layout.font;
  ctx.fillStyle = style.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = style.align === "left" ? "left" : style.align === "right" ? "right" : "center";
  applyLetterSpacing(ctx, style.fontFamily, layout.fontSize);
  const x = style.align === "left" ? layout.padX : style.align === "right" ? width - layout.padX : width / 2;
  layout.lines.forEach((line, index) => ctx.fillText(line, x, layout.padY + layout.lineHeight * (index + 0.5)));
}

/* ------------------------------ Exportación ------------------------------ */

export type ExportResult = { blob: Blob; width: number; height: number; missingImages: number };

export async function renderCompositionToBlob(composition: ScrapbookComposition): Promise<ExportResult> {
  const bounds = getContentBounds(composition);
  const ordered = sortByZ(composition.elements).filter((element) => element.visible !== false);
  const scale = Math.min(2, MAX_SIDE / Math.max(bounds.width, bounds.height), Math.sqrt(MAX_PIXELS / (bounds.width * bounds.height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bounds.width * scale));
  canvas.height = Math.max(1, Math.round(bounds.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador no puede crear la imagen.");

  const fonts = new Set<string>();
  for (const element of ordered) {
    if (element.type !== "text") continue;
    const style = { ...DEFAULT_TEXT_STYLE, ...element.textStyle };
    fonts.add(`${style.italic ? "italic " : ""}${style.fontWeight} 40px ${getFontCss(style.fontFamily)}`);
  }
  await Promise.all([...fonts].map((font) => document.fonts.load(font, "AaÁáñ¡").catch(() => []))).then(() => document.fonts.ready);

  const sources = new Set<string>();
  ordered.forEach((element) => {
    if ((element.type === "photo" || element.type === "frame") && element.src) sources.add(element.src);
  });
  if (composition.canvas.backgroundImage) sources.add(composition.canvas.backgroundImage);
  const loaded = new Map<string, HTMLImageElement | null>(await Promise.all([...sources].map(async (src) => [src, await loadImage(src)] as const)));
  const missingImages = [...loaded.values()].filter((image) => !image).length;

  ctx.setTransform(scale, 0, 0, scale, -bounds.x * scale, -bounds.y * scale);
  paintPaper(ctx, composition, bounds, composition.canvas.backgroundImage ? loaded.get(composition.canvas.backgroundImage) ?? null : null);

  for (const element of ordered) {
    const outer = getOuterSize(element);
    const isText = element.type === "text";
    const isPhoto = element.type === "photo" || element.type === "frame";
    const layout = isText ? layoutText(ctx, element) : null;
    const height = layout ? layout.height : outer.height;
    const decoration = !isText && !isPhoto ? await decorationImage(element, outer.width, outer.height, scale * element.scale) : null;

    ctx.save();
    ctx.globalAlpha = element.opacity ?? 1;
    ctx.translate(element.x + outer.width / 2, element.y + height / 2);
    ctx.rotate((element.rotation * Math.PI) / 180);
    ctx.scale(element.scale, element.scale);
    ctx.translate(-outer.width / 2, -height / 2);
    if (layout) paintText(ctx, element, layout);
    else if (isPhoto) paintPhoto(ctx, element, element.src ? loaded.get(element.src) ?? null : null);
    else if (decoration) ctx.drawImage(decoration, -DECORATION_MARGIN, -DECORATION_MARGIN, outer.width + DECORATION_MARGIN * 2, outer.height + DECORATION_MARGIN * 2);
    ctx.restore();
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("No se pudo crear la imagen.");
  return { blob, width: canvas.width, height: canvas.height, missingImages };
}

const slug = (title: string) =>
  title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "scrapbook";

/** Genera el JPEG y lo descarga. Devuelve cuántas fotos no se pudieron cargar. */
export async function downloadCompositionJpeg(composition: ScrapbookComposition, title: string) {
  const { blob, missingImages } = await renderCompositionToBlob(composition);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(title)}.jpg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { missingImages };
}
