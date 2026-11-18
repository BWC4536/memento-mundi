import { forwardRef, memo, type CSSProperties, type ReactNode } from "react";
import { ImagePlus } from "lucide-react";
import {
  getFilterDefinition,
  getFontCss,
  getFramePadding,
  getOuterSize,
  getPhotoImageStyle,
  sortByZ,
  DEFAULT_TEXT_STYLE,
  type CanvasElement,
  type FrameId,
  type ScrapbookComposition,
} from "@/lib/composition";
import { getCanvasFrameStyle, getTextureStyle, u } from "@/lib/composition-presets";
import { DecorationArt } from "./decorations";

/**
 * Renderizador ÚNICO de la composición. Lo usan el editor, la vista previa y
 * la pantalla completa, así las tres vistas son idénticas por construcción.
 *
 * Todo se mide en unidades del lienzo con container queries (`--mm-u`), de
 * modo que la composición escala a cualquier tamaño sin recalcular nada.
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
  const hasBackground = style.background && style.background !== "transparent";
  const fontSize = style.fontSize;
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
      {element.content ? element.content : editing ? <span style={{ opacity: 0.38 }}>Escribe aquí…</span> : null}
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

export type CompositionCanvasProps = {
  composition: ScrapbookComposition;
  className?: string;
  style?: CSSProperties;
  /** "edit" muestra marcadores de posición (marcos vacíos, textos sin escribir). */
  mode?: "view" | "edit";
  label?: string;
  emptyState?: ReactNode;
  children?: ReactNode;
};

const CompositionCanvas = forwardRef<HTMLDivElement, CompositionCanvasProps>(function CompositionCanvas(
  { composition, className = "", style, mode = "view", label = "Composición del scrapbook", emptyState, children },
  ref,
) {
  const { canvas } = composition;
  const editing = mode === "edit";
  const ordered = sortByZ(composition.elements).filter((element) => element.visible !== false);
  const texture = getTextureStyle(canvas.texture, canvas.background);
  const frame = getCanvasFrameStyle(canvas.frame, canvas.background);

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
          aspectRatio: `${canvas.width} / ${canvas.height}`,
          containerType: "inline-size",
          background: canvas.background,
          "--mm-u": `calc(100cqw / ${canvas.width})`,
          ...style,
        } as CSSProperties
      }
    >
      {canvas.backgroundImage ? <img src={canvas.backgroundImage} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" /> : null}
      {texture ? <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={texture} /> : null}

      {ordered.map((element, index) => {
        const outer = getOuterSize(element);
        const isText = element.type === "text";
        return (
          <div
            key={element.id}
            data-element-id={element.id}
            data-element-type={element.type}
            className="absolute"
            style={{
              left: pct(element.x / canvas.width),
              top: pct(element.y / canvas.height),
              width: pct(outer.width / canvas.width),
              height: isText ? "auto" : pct(outer.height / canvas.height),
              transform: `rotate(${element.rotation}deg) scale(${element.scale})`,
              transformOrigin: "center center",
              zIndex: index + 1,
              opacity: element.opacity ?? 1,
            }}
          >
            <ElementContent element={element} editing={editing} />
          </div>
        );
      })}

      {frame ? <div aria-hidden="true" className="pointer-events-none absolute" style={{ ...frame, zIndex: ordered.length + 2 }} /> : null}
      {ordered.length === 0 && emptyState ? <div className="absolute inset-0 z-[1] flex items-center justify-center p-4">{emptyState}</div> : null}
      {children}
    </div>
  );
});

export default memo(CompositionCanvas);
