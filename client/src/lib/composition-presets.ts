import type { CSSProperties } from "react";
import {
  isDarkColor,
  resizeCanvas,
  updateCanvas,
  type CanvasFrame,
  type CanvasTexture,
  type FrameId,
  type ScrapbookComposition,
} from "./composition";

/* ------------------------------ Formatos ------------------------------ */

export const CANVAS_FORMATS = [
  { id: "horizontal", label: "Horizontal", hint: "4:3", width: 1200, height: 900 },
  { id: "vertical", label: "Vertical", hint: "4:5", width: 1080, height: 1350 },
  { id: "cuadrado", label: "Cuadrado", hint: "1:1", width: 1200, height: 1200 },
  { id: "panoramico", label: "Panorámico", hint: "16:9", width: 1600, height: 900 },
  { id: "historia", label: "Historia", hint: "9:16", width: 1080, height: 1920 },
] as const;

export type CanvasFormatId = (typeof CANVAS_FORMATS)[number]["id"];

export function applyCanvasFormat(composition: ScrapbookComposition, formatId: CanvasFormatId) {
  const format = CANVAS_FORMATS.find((item) => item.id === formatId);
  if (!format) return composition;
  return resizeCanvas(composition, format.width, format.height, format.id);
}

/* ------------------------------ Fondos ------------------------------ */

export const BACKGROUND_SWATCHES = [
  { id: "crema", label: "Crema", value: "#EAE7DA" },
  { id: "verde", label: "Verde suave", value: "#D8E2DC" },
  { id: "papel", label: "Papel", value: "#FFFDF6" },
  { id: "rosa", label: "Arena", value: "#F2C5A0" },
  { id: "kraft", label: "Kraft", value: "#CDB48E" },
  { id: "cielo", label: "Cielo", value: "#C9D9E3" },
  { id: "naranja", label: "Naranja", value: "#FA9223" },
  { id: "navy", label: "Navy", value: "#0B2130" },
] as const;

export const TEXTURES: Array<{ id: CanvasTexture; label: string }> = [
  { id: "none", label: "Lisa" },
  { id: "paper", label: "Papel" },
  { id: "grid", label: "Cuadrícula" },
  { id: "dots", label: "Puntos" },
  { id: "lines", label: "Rayas" },
  { id: "kraft", label: "Kraft" },
];

export const CANVAS_FRAMES: Array<{ id: CanvasFrame; label: string }> = [
  { id: "none", label: "Sin marco" },
  { id: "thin", label: "Línea fina" },
  { id: "bold", label: "Borde grueso" },
  { id: "stamp", label: "Troquelado" },
  { id: "polaroid", label: "Margen blanco" },
];

/** Unidad lógica del lienzo en CSS: 1 unidad = (ancho del lienzo / canvas.width) px. */
export const u = (value: number) => `calc(${value} * var(--mm-u))`;

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E\")";

/** Capa de textura (se pinta en un div hijo del lienzo para que `--mm-u` resuelva). */
export function getTextureStyle(texture: CanvasTexture | undefined, background: string): CSSProperties | null {
  const dark = isDarkColor(background);
  const ink = dark ? "rgba(234,231,218,.16)" : "rgba(11,33,48,.10)";
  switch (texture) {
    case "paper":
      return { backgroundImage: NOISE, backgroundSize: `${u(320)} ${u(320)}`, opacity: dark ? 0.25 : 0.45, mixBlendMode: dark ? "screen" : "multiply" };
    case "kraft":
      return {
        backgroundImage: `${NOISE}, repeating-linear-gradient(102deg, rgba(120,84,40,.08) 0 ${u(3)}, transparent ${u(3)} ${u(17)})`,
        backgroundSize: `${u(260)} ${u(260)}, auto`,
        opacity: 0.7,
        mixBlendMode: "multiply",
      };
    case "grid":
      return {
        backgroundImage: `linear-gradient(${ink} ${u(2)}, transparent ${u(2)}), linear-gradient(90deg, ${ink} ${u(2)}, transparent ${u(2)})`,
        backgroundSize: `${u(48)} ${u(48)}`,
      };
    case "dots":
      return {
        backgroundImage: `radial-gradient(${dark ? "rgba(234,231,218,.28)" : "rgba(11,33,48,.22)"} ${u(2.6)}, transparent ${u(3.2)})`,
        backgroundSize: `${u(36)} ${u(36)}`,
      };
    case "lines":
      return {
        backgroundImage: `linear-gradient(90deg, transparent ${u(96)}, rgba(250,146,35,.45) ${u(96)}, rgba(250,146,35,.45) ${u(99)}, transparent ${u(99)}), repeating-linear-gradient(transparent 0 ${u(44)}, ${ink} ${u(44)} ${u(46)})`,
      };
    default:
      return null;
  }
}

export function getCanvasFrameStyle(frame: CanvasFrame | undefined, background: string): CSSProperties | null {
  const line = isDarkColor(background) ? "#EAE7DA" : "#0B2130";
  switch (frame) {
    case "thin":
      return { inset: u(22), border: `${u(3)} solid ${line}`, borderRadius: u(14) };
    case "bold":
      return { inset: 0, border: `${u(18)} solid ${line}` };
    case "stamp":
      return { inset: u(18), border: `${u(5)} dashed ${line}`, borderRadius: u(10) };
    case "polaroid":
      return { inset: 0, border: `${u(34)} solid #FFFDF6`, boxShadow: `inset 0 0 0 ${u(3)} ${line}` };
    default:
      return null;
  }
}

/* --------------------------- Presets visuales --------------------------- */

export const DESIGN_PRESETS = [
  { id: "cuaderno", label: "Cuaderno de viaje", background: "#EAE7DA", texture: "grid", frame: "thin" },
  { id: "postal", label: "Postal atlántica", background: "#D8E2DC", texture: "lines", frame: "stamp" },
  { id: "atardecer", label: "Atardecer", background: "#F2C5A0", texture: "paper", frame: "bold" },
  { id: "kraft", label: "Mesa kraft", background: "#CDB48E", texture: "kraft", frame: "polaroid" },
  { id: "nocturno", label: "Noche navy", background: "#0B2130", texture: "dots", frame: "thin" },
  { id: "minimal", label: "Minimal", background: "#FFFDF6", texture: "none", frame: "none" },
] as const satisfies ReadonlyArray<{ id: string; label: string; background: string; texture: CanvasTexture; frame: CanvasFrame }>;

export type DesignPresetId = (typeof DESIGN_PRESETS)[number]["id"];

/**
 * Aplica un preset de fondo + textura + marco general. Si el fondo cambia de
 * claro a oscuro (o al revés) se invierten los textos navy/crema para que
 * sigan siendo legibles.
 */
export function applyDesignPreset(composition: ScrapbookComposition, presetId: DesignPresetId) {
  const preset = DESIGN_PRESETS.find((item) => item.id === presetId);
  if (!preset) return composition;
  return setCanvasBackground(updateCanvas(composition, { texture: preset.texture, frame: preset.frame }), preset.background);
}

export function setCanvasBackground(composition: ScrapbookComposition, background: string) {
  const wasDark = isDarkColor(composition.canvas.background);
  const isDark = isDarkColor(background);
  const next = updateCanvas(composition, { background });
  if (wasDark === isDark) return next;
  const from = isDark ? "#0B2130" : "#EAE7DA";
  const to = isDark ? "#EAE7DA" : "#0B2130";
  return {
    ...next,
    elements: next.elements.map((element) =>
      element.type === "text" && element.textStyle?.color?.toUpperCase() === from ? { ...element, textStyle: { ...element.textStyle, color: to } } : element,
    ),
  };
}

/* ------------------------------ Marcos de foto ------------------------------ */

export const PHOTO_FRAME_SAMPLES: Array<{ id: string; label: string; frameId: FrameId; aspect: number }> = [
  { id: "frame-square", label: "Marco cuadrado", frameId: "classic", aspect: 1 },
  { id: "frame-vertical", label: "Marco vertical", frameId: "navy", aspect: 4 / 5 },
  { id: "frame-horizontal", label: "Marco horizontal", frameId: "orange", aspect: 4 / 3 },
  { id: "frame-polaroid", label: "Polaroid", frameId: "polaroid", aspect: 1 },
  { id: "frame-rounded", label: "Redondeado", frameId: "rounded", aspect: 1 },
  { id: "frame-postcard", label: "Postal", frameId: "postcard", aspect: 3 / 2 },
];

export const FRAME_LABELS: Record<FrameId, string> = {
  none: "Sin marco",
  classic: "Clásico",
  navy: "Navy",
  orange: "Naranja",
  polaroid: "Polaroid",
  rounded: "Redondeado",
  postcard: "Postal",
};

export const TEXT_COLORS = ["#0B2130", "#EAE7DA", "#FA9223", "#FFFDF6", "#B44728", "#3C6E71", "#D8E2DC"] as const;
export const ELEMENT_COLORS = ["#FA9223", "#0B2130", "#EAE7DA", "#D8E2DC", "#B44728", "#3C6E71", "#F2C5A0", "#FFFDF6"] as const;
