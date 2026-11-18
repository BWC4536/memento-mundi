import { useId, type ReactNode } from "react";
import { Camera, Compass, Luggage, MapPin, Mountain, Plane, Sun, TreePalm, type LucideIcon } from "lucide-react";
import type { CanvasElement } from "@/lib/composition";

/**
 * Galería de samples del panel "Elementos". Todo se dibuja con SVG propio
 * (identidad Memento Mundi), así escala sin pérdida en el editor, la
 * previsualización y la pantalla completa.
 */

export type DecorationGroupId = "cintas" | "pegatinas" | "estrellas" | "flechas" | "corazones" | "sellos" | "formas" | "viaje";

export const DECORATION_GROUPS: Array<{ id: DecorationGroupId; label: string }> = [
  { id: "cintas", label: "Cintas adhesivas" },
  { id: "pegatinas", label: "Pegatinas" },
  { id: "estrellas", label: "Estrellas" },
  { id: "flechas", label: "Flechas" },
  { id: "corazones", label: "Corazones" },
  { id: "sellos", label: "Sellos" },
  { id: "formas", label: "Formas geométricas" },
  { id: "viaje", label: "Decoración de viaje" },
];

export type DecorationSample = {
  id: string;
  label: string;
  group: DecorationGroupId;
  type: "sticker" | "shape" | "decoration";
  width: number;
  height: number;
  color: string;
  colorable: boolean;
  /** Texto por defecto si el sample lleva texto editable. */
  text?: string;
};

const ORANGE = "#FA9223";
const NAVY = "#0B2130";
const CREAM = "#EAE7DA";
const SAGE = "#D8E2DC";
const PAPER = "#FFFDF6";

export const DECORATION_SAMPLES: DecorationSample[] = [
  { id: "tape-stripes", label: "Cinta a rayas", group: "cintas", type: "decoration", width: 220, height: 56, color: ORANGE, colorable: true },
  { id: "tape-grid", label: "Cinta cuadros", group: "cintas", type: "decoration", width: 220, height: 56, color: NAVY, colorable: true },
  { id: "tape-solid", label: "Cinta lisa", group: "cintas", type: "decoration", width: 200, height: 52, color: SAGE, colorable: true },
  { id: "tape-dots", label: "Cinta lunares", group: "cintas", type: "decoration", width: 220, height: 56, color: ORANGE, colorable: true },

  { id: "sticker-bon-voyage", label: "Bon voyage", group: "pegatinas", type: "sticker", width: 170, height: 170, color: ORANGE, colorable: true, text: "BON VOYAGE" },
  { id: "sticker-memento", label: "Etiqueta", group: "pegatinas", type: "sticker", width: 260, height: 94, color: CREAM, colorable: true, text: "memento" },
  { id: "sticker-boarding", label: "Billete", group: "pegatinas", type: "sticker", width: 300, height: 138, color: SAGE, colorable: true, text: "BOARDING PASS" },
  { id: "sticker-hola", label: "Bocadillo", group: "pegatinas", type: "sticker", width: 200, height: 150, color: PAPER, colorable: true, text: "¡HOLA!" },

  { id: "star-five", label: "Estrella", group: "estrellas", type: "sticker", width: 130, height: 130, color: ORANGE, colorable: true },
  { id: "star-sparkle", label: "Destello", group: "estrellas", type: "sticker", width: 110, height: 110, color: ORANGE, colorable: true },
  { id: "star-burst", label: "Explosión", group: "estrellas", type: "sticker", width: 150, height: 150, color: ORANGE, colorable: true, text: "¡SÍ!" },

  { id: "arrow-straight", label: "Flecha recta", group: "flechas", type: "decoration", width: 220, height: 66, color: NAVY, colorable: true },
  { id: "arrow-curve", label: "Flecha curva", group: "flechas", type: "decoration", width: 220, height: 110, color: NAVY, colorable: true },
  { id: "arrow-loop", label: "Flecha bucle", group: "flechas", type: "decoration", width: 240, height: 110, color: ORANGE, colorable: true },

  { id: "heart-solid", label: "Corazón", group: "corazones", type: "sticker", width: 120, height: 110, color: "#B44728", colorable: true },
  { id: "heart-outline", label: "Corazón línea", group: "corazones", type: "sticker", width: 120, height: 110, color: ORANGE, colorable: true },
  { id: "heart-double", label: "Dos corazones", group: "corazones", type: "sticker", width: 160, height: 120, color: "#B44728", colorable: true },

  { id: "stamp-postage", label: "Sello postal", group: "sellos", type: "decoration", width: 132, height: 164, color: ORANGE, colorable: true, text: "CORREO AÉREO" },
  { id: "stamp-round", label: "Matasellos", group: "sellos", type: "decoration", width: 170, height: 170, color: NAVY, colorable: true, text: "MEMENTO MUNDI" },
  { id: "stamp-location", label: "Sello de lugar", group: "sellos", type: "decoration", width: 330, height: 132, color: NAVY, colorable: true, text: "DESTINO" },

  { id: "shape-circle", label: "Círculo", group: "formas", type: "shape", width: 140, height: 140, color: ORANGE, colorable: true },
  { id: "shape-square", label: "Cuadrado", group: "formas", type: "shape", width: 140, height: 140, color: SAGE, colorable: true },
  { id: "shape-triangle", label: "Triángulo", group: "formas", type: "shape", width: 150, height: 130, color: ORANGE, colorable: true },
  { id: "shape-blob", label: "Mancha", group: "formas", type: "shape", width: 180, height: 150, color: "#F2C5A0", colorable: true },
  { id: "shape-half", label: "Media luna", group: "formas", type: "shape", width: 160, height: 84, color: NAVY, colorable: true },
  { id: "shape-line", label: "Línea", group: "formas", type: "shape", width: 260, height: 14, color: NAVY, colorable: true },

  { id: "travel-plane", label: "Avión", group: "viaje", type: "decoration", width: 120, height: 120, color: NAVY, colorable: true },
  { id: "travel-compass", label: "Brújula", group: "viaje", type: "decoration", width: 120, height: 120, color: NAVY, colorable: true },
  { id: "travel-luggage", label: "Maleta", group: "viaje", type: "decoration", width: 120, height: 120, color: ORANGE, colorable: true },
  { id: "travel-pin", label: "Pin de mapa", group: "viaje", type: "decoration", width: 110, height: 120, color: "#B44728", colorable: true },
  { id: "travel-sun", label: "Sol", group: "viaje", type: "decoration", width: 120, height: 120, color: ORANGE, colorable: true },
  { id: "travel-mountain", label: "Montaña", group: "viaje", type: "decoration", width: 130, height: 120, color: NAVY, colorable: true },
  { id: "travel-palm", label: "Palmera", group: "viaje", type: "decoration", width: 120, height: 130, color: "#3C6E71", colorable: true },
  { id: "travel-camera", label: "Cámara", group: "viaje", type: "decoration", width: 120, height: 110, color: NAVY, colorable: true },
];

const SAMPLE_BY_ID = new Map(DECORATION_SAMPLES.map((sample) => [sample.id, sample]));

export function getDecorationSample(sampleId: string | undefined) {
  return sampleId ? SAMPLE_BY_ID.get(sampleId) : undefined;
}

export function decorationLabel(element: Pick<CanvasElement, "sampleId" | "type">) {
  return getDecorationSample(element.sampleId)?.label ?? (element.type === "shape" ? "Forma" : element.type === "sticker" ? "Pegatina" : "Decoración");
}

const TRAVEL_ICONS: Record<string, LucideIcon> = {
  "travel-plane": Plane,
  "travel-compass": Compass,
  "travel-luggage": Luggage,
  "travel-pin": MapPin,
  "travel-sun": Sun,
  "travel-mountain": Mountain,
  "travel-palm": TreePalm,
  "travel-camera": Camera,
};

const BRAND_FONT = '"Brasika Display - Trial", "Briska", Georgia, serif';
const MONO_FONT = '"Space Mono", "Courier New", monospace';

/** Borde dentado de cinta adhesiva. */
function tapePath(width: number, height: number) {
  const teeth = 6;
  const step = height / teeth;
  let left = `M 6 0`;
  let right = "";
  for (let i = 0; i <= teeth; i += 1) right += ` L ${width - (i % 2 ? 0 : 6)} ${i * step}`;
  let back = "";
  for (let i = teeth; i >= 0; i -= 1) back += ` L ${i % 2 ? 0 : 6} ${i * step}`;
  left += right + back + " Z";
  return left;
}

const STAR_POINTS = (() => {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 48 : 20;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${50 + Math.cos(angle) * radius},${52 + Math.sin(angle) * radius}`);
  }
  return points.join(" ");
})();

const BURST_POINTS = (() => {
  const points: string[] = [];
  for (let i = 0; i < 32; i += 1) {
    const radius = i % 2 === 0 ? 49 : 40;
    const angle = (Math.PI / 16) * i;
    points.push(`${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`);
  }
  return points.join(" ");
})();

const HEART = "M50 88 C 18 66 4 46 10 28 C 16 10 40 6 50 26 C 60 6 84 10 90 28 C 96 46 82 66 50 88 Z";

function Svg({ viewBox, children, stretch = false }: { viewBox: string; children: ReactNode; stretch?: boolean }) {
  return (
    <svg viewBox={viewBox} width="100%" height="100%" preserveAspectRatio={stretch ? "none" : "xMidYMid meet"} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      {children}
    </svg>
  );
}

function fitText(text: string, maxWidth: number, maxSize: number, charRatio = 0.62) {
  return Math.min(maxSize, maxWidth / Math.max(1, text.length * charRatio));
}

/** Dibuja un sticker, forma o decoración ocupando el 100% de su caja. */
export function DecorationArt({ element }: { element: Pick<CanvasElement, "sampleId" | "color" | "content" | "type"> }) {
  const uid = useId().replace(/:/g, "");
  const sample = getDecorationSample(element.sampleId);
  const color = element.color ?? sample?.color ?? ORANGE;
  const text = element.content ?? sample?.text ?? "";
  const id = element.sampleId ?? "";

  const Icon = TRAVEL_ICONS[id];
  if (Icon) return <Icon width="100%" height="100%" color={color} strokeWidth={2.1} aria-hidden="true" style={{ display: "block", filter: `drop-shadow(3px 3px 0 ${color === NAVY ? ORANGE : NAVY})` }} />;

  switch (id) {
    case "tape-stripes":
      return (
        <Svg viewBox="0 0 220 56" stretch>
          <defs>
            <clipPath id={`clip-${uid}`}>
              <path d={tapePath(220, 56)} />
            </clipPath>
          </defs>
          <path d={tapePath(220, 56)} fill={color} opacity={0.82} />
          <g clipPath={`url(#clip-${uid})`} opacity={0.35}>
            {Array.from({ length: 16 }, (_, i) => (
              <rect key={i} x={i * 16 - 30} y={-10} width={7} height={80} fill={PAPER} transform={`skewX(-28)`} />
            ))}
          </g>
        </Svg>
      );
    case "tape-grid":
      return (
        <Svg viewBox="0 0 220 56" stretch>
          <defs>
            <clipPath id={`clip-${uid}`}>
              <path d={tapePath(220, 56)} />
            </clipPath>
          </defs>
          <path d={tapePath(220, 56)} fill={color} opacity={0.78} />
          <g clipPath={`url(#clip-${uid})`} stroke={PAPER} strokeWidth={3} opacity={0.4}>
            {Array.from({ length: 15 }, (_, i) => <line key={`v${i}`} x1={i * 15 + 4} y1={0} x2={i * 15 + 4} y2={56} />)}
            {Array.from({ length: 4 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 15 + 6} x2={220} y2={i * 15 + 6} />)}
          </g>
        </Svg>
      );
    case "tape-solid":
      return (
        <Svg viewBox="0 0 200 52" stretch>
          <path d={tapePath(200, 52)} fill={color} opacity={0.82} />
          <path d={tapePath(200, 52)} fill="none" stroke={NAVY} strokeOpacity={0.15} strokeWidth={2} />
        </Svg>
      );
    case "tape-dots":
      return (
        <Svg viewBox="0 0 220 56" stretch>
          <path d={tapePath(220, 56)} fill={PAPER} opacity={0.92} />
          {Array.from({ length: 10 }, (_, i) =>
            [0, 1].map((row) => <circle key={`${i}-${row}`} cx={18 + i * 20 + (row ? 10 : 0)} cy={row ? 38 : 18} r={5} fill={color} />),
          )}
        </Svg>
      );
    case "sticker-bon-voyage": {
      const [first, ...rest] = text.split(" ");
      return (
        <Svg viewBox="0 0 120 120">
          <circle cx={63} cy={63} r={54} fill={NAVY} />
          <circle cx={60} cy={60} r={54} fill={color} stroke={NAVY} strokeWidth={3} />
          <circle cx={60} cy={60} r={44} fill="none" stroke={PAPER} strokeWidth={2} strokeDasharray="5 5" />
          <text x={60} y={58} textAnchor="middle" fontFamily={BRAND_FONT} fontSize={fitText(first ?? "", 80, 22, 0.6)} fill={NAVY}>{first}</text>
          <text x={60} y={80} textAnchor="middle" fontFamily={BRAND_FONT} fontSize={fitText(rest.join(" "), 84, 20, 0.6)} fill={NAVY}>{rest.join(" ")}</text>
        </Svg>
      );
    }
    case "sticker-memento":
      return (
        <Svg viewBox="0 0 260 94">
          <rect x={8} y={10} width={248} height={80} rx={40} fill={NAVY} />
          <rect x={3} y={4} width={248} height={80} rx={40} fill={color} stroke={NAVY} strokeWidth={3} />
          <text x={127} y={56} textAnchor="middle" fontFamily={BRAND_FONT} fontSize={fitText(text, 200, 40, 0.55)} fill={color === NAVY ? CREAM : NAVY}>{text}</text>
        </Svg>
      );
    case "sticker-boarding":
      return (
        <Svg viewBox="0 0 300 138">
          <path d="M10 10 H290 V54 A15 15 0 0 0 290 84 V128 H10 V84 A15 15 0 0 0 10 54 Z" fill={NAVY} transform="translate(5 5)" />
          <path d="M10 10 H290 V54 A15 15 0 0 0 290 84 V128 H10 V84 A15 15 0 0 0 10 54 Z" fill={color} stroke={NAVY} strokeWidth={3} />
          <line x1={210} y1={18} x2={210} y2={120} stroke={NAVY} strokeWidth={2} strokeDasharray="6 6" />
          <text x={30} y={52} fontFamily={MONO_FONT} fontSize={fitText(text, 170, 22, 0.62)} fontWeight={700} fill={NAVY}>{text}</text>
          <text x={30} y={86} fontFamily={MONO_FONT} fontSize={14} fill={NAVY}>MM · 2026 · PUERTA 7</text>
          <text x={30} y={108} fontFamily={MONO_FONT} fontSize={14} fill={NAVY}>ASIENTO 12A</text>
          <g transform="translate(226 44)" fill="none" stroke={NAVY} strokeWidth={4} strokeLinecap="round">
            <path d="M8 26 L46 26 M30 10 L46 26 L30 42" />
          </g>
        </Svg>
      );
    case "sticker-hola":
      return (
        <Svg viewBox="0 0 200 150">
          <path d="M20 14 H186 A10 10 0 0 1 196 24 V96 A10 10 0 0 1 186 106 H84 L52 140 L58 106 H20 A10 10 0 0 1 10 96 V24 A10 10 0 0 1 20 14 Z" fill={NAVY} transform="translate(4 4)" />
          <path d="M20 14 H186 A10 10 0 0 1 196 24 V96 A10 10 0 0 1 186 106 H84 L52 140 L58 106 H20 A10 10 0 0 1 10 96 V24 A10 10 0 0 1 20 14 Z" fill={color} stroke={NAVY} strokeWidth={3} />
          <text x={103} y={74} textAnchor="middle" fontFamily={BRAND_FONT} fontSize={fitText(text, 160, 40, 0.58)} fill={color === NAVY ? CREAM : NAVY}>{text}</text>
        </Svg>
      );
    case "star-five":
      return (
        <Svg viewBox="0 0 100 100">
          <polygon points={STAR_POINTS} fill={NAVY} transform="translate(3 3)" />
          <polygon points={STAR_POINTS} fill={color} stroke={NAVY} strokeWidth={3} strokeLinejoin="round" />
        </Svg>
      );
    case "star-sparkle":
      return (
        <Svg viewBox="0 0 100 100">
          <path d="M50 2 C54 36 64 46 98 50 C64 54 54 64 50 98 C46 64 36 54 2 50 C36 46 46 36 50 2 Z" fill={color} stroke={NAVY} strokeWidth={2.5} strokeLinejoin="round" />
        </Svg>
      );
    case "star-burst":
      return (
        <Svg viewBox="0 0 100 100">
          <polygon points={BURST_POINTS} fill={color} stroke={NAVY} strokeWidth={2.5} strokeLinejoin="round" />
          <circle cx={50} cy={50} r={30} fill={PAPER} stroke={NAVY} strokeWidth={2} />
          <text x={50} y={58} textAnchor="middle" fontFamily={BRAND_FONT} fontSize={fitText(text, 48, 24, 0.6)} fill={NAVY}>{text}</text>
        </Svg>
      );
    case "arrow-straight":
      return (
        <Svg viewBox="0 0 220 66">
          <g fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 36 C 70 30 130 38 200 33" />
            <path d="M178 14 L204 33 L176 52" />
          </g>
        </Svg>
      );
    case "arrow-curve":
      return (
        <Svg viewBox="0 0 220 110">
          <g fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 92 C 50 20 140 6 196 52" />
            <path d="M170 50 L198 54 L190 26" />
          </g>
        </Svg>
      );
    case "arrow-loop":
      return (
        <Svg viewBox="0 0 240 110">
          <g fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 80 C 60 84 80 20 60 22 C 40 24 52 88 110 80 S 190 50 222 40" strokeDasharray="12 10" />
            <path d="M198 24 L224 39 L204 62" />
          </g>
        </Svg>
      );
    case "heart-solid":
      return (
        <Svg viewBox="0 0 100 92">
          <path d={HEART} fill={NAVY} transform="translate(3 3)" />
          <path d={HEART} fill={color} stroke={NAVY} strokeWidth={3} strokeLinejoin="round" />
        </Svg>
      );
    case "heart-outline":
      return (
        <Svg viewBox="0 0 100 92">
          <path d={HEART} fill="none" stroke={color} strokeWidth={7} strokeLinejoin="round" />
        </Svg>
      );
    case "heart-double":
      return (
        <Svg viewBox="0 0 140 104">
          <path d={HEART} fill={PAPER} stroke={NAVY} strokeWidth={3} transform="translate(44 6) rotate(12 50 50)" />
          <path d={HEART} fill={color} stroke={NAVY} strokeWidth={3} transform="translate(0 10) rotate(-10 50 50)" />
        </Svg>
      );
    case "stamp-postage": {
      const dots = [];
      for (let x = 8; x <= 124; x += 12) dots.push([x, 6], [x, 158]);
      for (let y = 18; y <= 146; y += 12) dots.push([6, y], [126, y]);
      const [first, ...rest] = text.split(" ");
      return (
        <Svg viewBox="0 0 132 164">
          <rect x={6} y={6} width={120} height={152} fill={PAPER} />
          {dots.map(([x, y], index) => <circle key={index} cx={x} cy={y} r={6} fill={PAPER} />)}
          <rect x={16} y={16} width={100} height={132} fill={color} stroke={NAVY} strokeWidth={2.5} />
          <g transform="translate(46 34)" fill="none" stroke={NAVY} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" transform="scale(1.7)" />
          </g>
          <text x={66} y={110} textAnchor="middle" fontFamily={MONO_FONT} fontWeight={700} fontSize={fitText(first ?? "", 90, 15, 0.62)} fill={NAVY}>{first}</text>
          <text x={66} y={128} textAnchor="middle" fontFamily={MONO_FONT} fontWeight={700} fontSize={fitText(rest.join(" "), 90, 15, 0.62)} fill={NAVY}>{rest.join(" ")}</text>
        </Svg>
      );
    }
    case "stamp-round": {
      const words = text.split(" ");
      return (
        <Svg viewBox="0 0 120 120">
          <g opacity={0.88} fill="none" stroke={color}>
            <circle cx={60} cy={60} r={54} strokeWidth={5} />
            <circle cx={60} cy={60} r={42} strokeWidth={2} />
          </g>
          <text x={60} y={44} textAnchor="middle" fontFamily={MONO_FONT} fontWeight={700} fontSize={fitText(words[0] ?? "", 70, 15)} fill={color}>{words[0]}</text>
          <text x={60} y={66} textAnchor="middle" fontFamily={BRAND_FONT} fontSize={18} fill={color}>★ 2026 ★</text>
          <text x={60} y={88} textAnchor="middle" fontFamily={MONO_FONT} fontWeight={700} fontSize={fitText(words.slice(1).join(" "), 70, 15)} fill={color}>{words.slice(1).join(" ")}</text>
        </Svg>
      );
    }
    case "stamp-location": {
      const label = text.toUpperCase();
      return (
        <Svg viewBox="0 0 330 132">
          <rect x={10} y={10} width={318} height={120} rx={12} fill={NAVY} />
          <rect x={4} y={4} width={318} height={120} rx={12} fill={PAPER} stroke={color} strokeWidth={4} />
          <rect x={14} y={14} width={298} height={100} rx={8} fill="none" stroke={color} strokeWidth={2} strokeDasharray="7 6" />
          <g transform="translate(28 40)" fill="none" stroke={ORANGE} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-10 14-2-2-10-8-10-14a10 10 0 0 1 20 0z" transform="scale(1.6)" />
            <circle cx={16} cy={16} r={5} />
          </g>
          <text x={186} y={76} textAnchor="middle" fontFamily={MONO_FONT} fontWeight={700} fontSize={fitText(label, 230, 30)} fill={color}>{label}</text>
        </Svg>
      );
    }
    case "shape-circle":
      return (
        <Svg viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={46} fill={color} stroke={NAVY} strokeWidth={3} />
        </Svg>
      );
    case "shape-square":
      return (
        <Svg viewBox="0 0 100 100">
          <rect x={6} y={6} width={92} height={92} rx={12} fill={NAVY} />
          <rect x={2} y={2} width={92} height={92} rx={12} fill={color} stroke={NAVY} strokeWidth={3} />
        </Svg>
      );
    case "shape-triangle":
      return (
        <Svg viewBox="0 0 100 88">
          <polygon points="50,4 96,84 4,84" fill={color} stroke={NAVY} strokeWidth={3} strokeLinejoin="round" />
        </Svg>
      );
    case "shape-blob":
      return (
        <Svg viewBox="0 0 120 100">
          <path d="M60 6 C 92 2 116 24 112 52 C 108 82 80 98 52 94 C 22 90 4 70 8 44 C 12 18 32 8 60 6 Z" fill={color} stroke={NAVY} strokeWidth={3} />
        </Svg>
      );
    case "shape-half":
      return (
        <Svg viewBox="0 0 100 52">
          <path d="M4 50 A46 46 0 0 1 96 50 Z" fill={color} stroke={NAVY} strokeWidth={3} strokeLinejoin="round" />
        </Svg>
      );
    case "shape-line":
      return (
        <Svg viewBox="0 0 260 14" stretch>
          <rect x={0} y={2} width={260} height={10} rx={5} fill={color} />
        </Svg>
      );
    default:
      return (
        <Svg viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={44} fill={color} stroke={NAVY} strokeWidth={3} />
          {text ? <text x={50} y={56} textAnchor="middle" fontFamily={BRAND_FONT} fontSize={fitText(text, 76, 22)} fill={NAVY}>{text}</text> : null}
        </Svg>
      );
  }
}
