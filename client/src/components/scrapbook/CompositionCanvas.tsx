import { forwardRef, memo, type CSSProperties, type ReactNode } from "react";
import { ImagePlus } from "lucide-react";
import {
  getContentBounds,
  getFilterDefinition,
  getFontCss,
  getFramePadding,
  getOuterSize,
  getPhotoImageStyle,
  sortByZ,
  DEFAULT_TEXT_STYLE,
  NOTE_MIN_ASPECT,
  NOTE_PADDING_X,
  NOTE_PADDING_Y,
  type CanvasElement,
  type FrameId,
  type Rect,
  type ScrapbookComposition,
} from "@/lib/composition";
import { getTextureStyle, u } from "@/lib/composition-presets";
import { DecorationArt } from "./decorations";

/**
 * Renderizador ÚNICO de la composición. El editor, la vista previa y la
 * pantalla completa pintan cada elemento con `ElementNode`, así las tres
 * vistas son idénticas por construcción.
 *
 * Todo se mide en unidades del cuaderno (`--mm-u`): en las vistas con
 * container queries; en el editor, 1px dentro de una capa escalada.
 */

const pct = (value: number) => `${Math.round(value * 1e6) / 1e4}%`;

type FrameLook = { shell: CSSProperties; innerRadius: string; label?: string };

function getFrameLook(frameId: FrameId | undefined, width: number, height: number, color?: string): FrameLook {
  const side = Math.min(width, height);
  switch (frameId) {
    case "classic":
      return { shell: { background: color ?? "#FFFFFF", borderRadius: u(6), boxShadow: `0 0 0 ${u(3)} #0B2130, ${u(9)} ${u(9)} 0 rgba(11,33,48,.92)` }, innerRadius: u(2) };
    case "navy":
      return { shell: { background: color ?? "#0B2130", borderRadius: u(10), boxShadow: `${u(9)} ${u(9)} 0 #FA9223` }, innerRadius: u(4) };
    case "orange":
      return { shell: { background: color ?? "#FA9223", borderRadius: u(8), boxShadow: `0 0 0 ${u(3)} #0B2130, ${u(9)} ${u(9)} 0 #0B2130` }, innerRadius: u(4) };
    case "polaroid":
      return { shell: { background: color ?? "#FFFDF6", borderRadius: u(4), boxShadow: `0 0 0 ${u(2)} rgba(11,33,48,.85), ${u(10)} ${u(12)} 0 rgba(11,33,48,.32)` }, innerRadius: u(2) };
    case "rounded":
      return { shell: { background: color ?? "#EAE7DA", borderRadius: u(side * 0.16), boxShadow: `0 0 0 ${u(3)} #0B2130, ${u(9)} ${u(9)} 0 #0B2130` }, innerRadius: u(side * 0.12) };
    case "postcard":
      return {
        shell: { background: color ?? "#FFFDF6", borderRadius: u(4), outline: `${u(3)} dashed #0B2130`, outlineOffset: `calc(-1 * ${u(side * 0.025)})`, boxShadow: `${u(8)} ${u(8)} 0 rgba(11,33,48,.85)` },
        innerRadius: u(2),
        label: "POSTAL · MEMENTO MUNDI",
      };
    default:
      return { shell: {}, innerRadius: "0" };
  }
}

function PhotoContent({ element, editing }: { element: CanvasElement; editing: boolean }) {
  const outer = getOuterSize(element);
  const pad = getFramePadding(element.frameId, element.width, element.height);
  const look = getFrameLook(element.frameId, element.width, element.height, element.color);
  const filter = getFilterDefinition(element.filter);
  const imageStyle = getPhotoImageStyle(element.crop);
  return (
    <div className="absolute inset-0" style={look.shell}>
      <div
        className="absolute overflow-hidden"
        style={{
          left: pct(pad.left / outer.width),
          top: pct(pad.top / outer.height),
          width: pct(element.width / outer.width),
          height: pct(element.height / outer.height),
          borderRadius: look.innerRadius,
          background: "#D8E2DC",
        }}
      >
        {element.src ? (
          <>
            <img
              src={element.src}
              alt=""
              draggable={false}
              data-filter={element.filter ?? "original"}
              decoding="async"
              className="pointer-events-none block h-full w-full select-none"
              style={{ ...imageStyle, filter: filter.css === "none" ? undefined : filter.css }}
            />
            {filter.overlay ? <span className="pointer-events-none absolute inset-0" style={{ background: filter.overlay, mixBlendMode: filter.blend as CSSProperties["mixBlendMode"] }} /> : null}
          </>
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-[0.4em] text-center text-ink/60"
            style={{
              fontSize: u(Math.max(14, Math.min(element.width, element.height) * 0.08)),
              backgroundImage: "repeating-linear-gradient(135deg, rgba(11,33,48,.06) 0 10px, transparent 10px 20px)",
            }}
          >
            {editing ? (
              <>
                <ImagePlus style={{ width: "1.6em", height: "1.6em" }} aria-hidden="true" />
                <span style={{ fontWeight: 800, lineHeight: 1.1 }}>Toca para añadir foto</span>
              </>
            ) : null}
          </div>
        )}
      </div>
      {look.label ? (
        <span
          className="pointer-events-none absolute inset-x-0 text-center text-ink/70"
          style={{ bottom: pct((pad.bottom * 0.32) / outer.height), fontFamily: getFontCss("mono"), fontSize: u(Math.max(9, Math.min(element.width, element.height) * 0.045)), letterSpacing: ".12em", fontWeight: 700 }}
        >
          {look.label}
        </span>
      ) : null}
    </div>
  );
}

function TextContent({ element, editing }: { element: CanvasElement; editing: boolean }) {
  const style = { ...DEFAULT_TEXT_STYLE, ...element.textStyle };
  const fontSize = style.fontSize;
  const placeholder = editing ? <span style={{ opacity: 0.38 }}>{style.variant === "note" ? "Escribe una nota…" : "Escribe aquí…"}</span> : null;

  if (style.variant === "note") {
    const paper = style.background && style.background !== "transparent" ? style.background : "#FBE7A1";
    return (
      <div
        data-text-content
        data-note
        style={{
          position: "relative",
          fontFamily: getFontCss(style.fontFamily),
          fontSize: u(fontSize),
          fontWeight: style.fontWeight,
          fontStyle: style.italic ? "italic" : "normal",
          color: style.color,
          textAlign: style.align,
          lineHeight: 1.2,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          backgroundColor: paper,
          backgroundImage: "linear-gradient(160deg, rgba(255,255,255,.35), transparent 45%)",
          padding: `${u(fontSize * NOTE_PADDING_Y)} ${u(fontSize * NOTE_PADDING_X)}`,
          minHeight: u(element.width * NOTE_MIN_ASPECT),
          borderRadius: `${u(4)} ${u(4)} ${u(18)} ${u(4)}`,
          boxShadow: `0 0 0 ${u(2)} rgba(11,33,48,.55), ${u(6)} ${u(8)} 0 rgba(11,33,48,.22)`,
        }}
      >
        {element.content ? element.content : placeholder}
      </div>
    );
  }

  const hasBackground = style.background && style.background !== "transparent";
  return (
    <div
      data-text-content
      style={{
        fontFamily: getFontCss(style.fontFamily),
        fontSize: u(fontSize),
        fontWeight: style.fontWeight,
        fontStyle: style.italic ? "italic" : "normal",
        color: style.color,
        textAlign: style.align,
        lineHeight: 1.12,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        letterSpacing: style.fontFamily === "brand" ? "-0.02em" : undefined,
        background: hasBackground ? style.background : undefined,
        padding: hasBackground ? `${u(fontSize * 0.22)} ${u(fontSize * 0.38)}` : 0,
        borderRadius: hasBackground ? u(fontSize * 0.2) : undefined,
        boxShadow: hasBackground ? `0 0 0 ${u(3)} #0B2130, ${u(5)} ${u(5)} 0 #0B2130` : undefined,
        minHeight: u(fontSize * 1.12),
      }}
    >
      {element.content ? element.content : placeholder}
    </div>
  );
}

export function ElementContent({ element, editing = false }: { element: CanvasElement; editing?: boolean }) {
  if (element.type === "photo" || element.type === "frame") return <PhotoContent element={element} editing={editing} />;
  if (element.type === "text") return <TextContent element={element} editing={editing} />;
  return (
    <div className="absolute inset-0">
      <DecorationArt element={element} />
    </div>
  );
}

type ElementNodeProps = {
  element: CanvasElement;
  zIndex: number;
  editing?: boolean;
  /** Zona del cuaderno que ocupa el contenedor (posiciones en %), o null para posiciones en unidades del cuaderno (px con `--mm-u: 1px`). */
  frame: Rect | null;
};

/** Un elemento colocado en el cuaderno. Lo comparten las vistas (en %) y el editor (en unidades del cuaderno). */
export const ElementNode = memo(function ElementNode({ element, zIndex, editing = false, frame }: ElementNodeProps) {
  const outer = getOuterSize(element);
  const isText = element.type === "text";
  const place = frame
    ? { left: pct((element.x - frame.x) / frame.width), top: pct((element.y - frame.y) / frame.height), width: pct(outer.width / frame.width), height: isText ? "auto" : pct(outer.height / frame.height) }
    : { left: element.x, top: element.y, width: outer.width, height: isText ? "auto" : outer.height };
  return (
    <div
      data-element-id={element.id}
      data-element-type={element.type}
      className="absolute"
      style={{
        ...place,
        transform: `rotate(${element.rotation}deg) scale(${element.scale})`,
        transformOrigin: "center center",
        zIndex,
        opacity: element.opacity ?? 1,
      }}
    >
      <ElementContent element={element} editing={editing} />
    </div>
  );
});

/** Patrón del papel anclado al origen del cuaderno. `--mm-u` debe estar definido en un ancestro o en `style`. */
export function PaperTexture({ composition, offset, style }: { composition: ScrapbookComposition; offset: { x: string; y: string }; style?: CSSProperties }) {
  const texture = getTextureStyle(composition.canvas.texture, composition.canvas.background);
  if (!texture) return null;
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ ...texture, backgroundPosition: `${offset.x} ${offset.y}`, ...style }} />;
}

export type CompositionCanvasProps = {
  composition: ScrapbookComposition;
  className?: string;
  style?: CSSProperties;
  /** "edit" muestra marcadores de posición (marcos vacíos, textos sin escribir). */
  mode?: "view" | "edit";
  label?: string;
  emptyState?: ReactNode;
  /** Zona del cuaderno a mostrar. Por defecto, el encuadre de todo el contenido. */
  bounds?: Rect;
  children?: ReactNode;
};

/**
 * Vista estática de un cuaderno infinito: encuadra su contenido (o `bounds`)
 * y lo escala al ancho disponible.
 */
const CompositionCanvas = forwardRef<HTMLDivElement, CompositionCanvasProps>(function CompositionCanvas(
  { composition, className = "", style, mode = "view", label = "Composición del scrapbook", emptyState, bounds, children },
  ref,
) {
  const { canvas } = composition;
  const editing = mode === "edit";
  const ordered = sortByZ(composition.elements).filter((element) => element.visible !== false);
  const frame = bounds ?? getContentBounds(composition);

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-composition
      data-element-count={ordered.length}
      className={`relative select-none overflow-hidden ${className}`}
      style={
        {
          aspectRatio: `${frame.width} / ${frame.height}`,
          containerType: "inline-size",
          background: canvas.background,
          "--mm-u": `calc(100cqw / ${frame.width})`,
          ...style,
        } as CSSProperties
      }
    >
      {canvas.backgroundImage ? <img src={canvas.backgroundImage} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" /> : null}
      <PaperTexture composition={composition} offset={{ x: u(-frame.x), y: u(-frame.y) }} />

      {ordered.map((element, index) => (
        <ElementNode key={element.id} element={element} zIndex={index + 1} editing={editing} frame={frame} />
      ))}

      {ordered.length === 0 && emptyState ? <div className="absolute inset-0 z-[1] flex items-center justify-center p-4">{emptyState}</div> : null}
      {children}
    </div>
  );
});

export default memo(CompositionCanvas);
