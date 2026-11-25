import type { CSSProperties } from "react";
import {
  isDarkColor,
  updateCanvas,
  type CanvasTexture,
  type FrameId,
  type ScrapbookComposition,
} from "./composition";

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

/** Unidad lógica del lienzo en CSS: 1 unidad = (ancho del lienzo / canvas.width) px. */
export const u = (value: number) => `calc(${value} * var(--mm-u))`;

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E\")";

/**
 * Patrón del papel (se pinta en un div hijo para que `--mm-u` resuelva). El
 * patrón se repite sin fin; quien lo pinta fija `backgroundPosition` para que
 * quede anclado al origen del cuaderno (igual en el editor y en las vistas).
 */
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
        backgroundImage: `linear-gradient(transparent ${u(44)}, ${ink} ${u(44)})`,
        backgroundSize: `100% ${u(46)}`,
      };
    default:
      return null;
  }
}

/* --------------------------- Presets visuales --------------------------- */

export const DESIGN_PRESETS = [
  { id: "cuaderno", label: "Cuaderno", background: "#EAE7DA", texture: "dots" },
  { id: "cuadricula", label: "Cuadrícula", background: "#FFFDF6", texture: "grid" },
  { id: "postal", label: "Atlántico", background: "#D8E2DC", texture: "lines" },
  { id: "atardecer", label: "Atardecer", background: "#F2C5A0", texture: "paper" },
  { id: "kraft", label: "Kraft", background: "#CDB48E", texture: "kraft" },
  { id: "nocturno", label: "Noche", background: "#0B2130", texture: "dots" },
] as const satisfies ReadonlyArray<{ id: string; label: string; background: string; texture: CanvasTexture }>;

export type DesignPresetId = (typeof DESIGN_PRESETS)[number]["id"];

/**
 * Aplica un preset de papel (color + textura). Si el fondo cambia de
 * claro a oscuro (o al revés) se invierten los textos navy/crema para que
 * sigan siendo legibles.
 */
export function applyDesignPreset(composition: ScrapbookComposition, presetId: DesignPresetId) {
  const preset = DESIGN_PRESETS.find((item) => item.id === presetId);
  if (!preset) return composition;
  return setCanvasBackground(updateCanvas(composition, { texture: preset.texture, frame: "none" }), preset.background);
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
