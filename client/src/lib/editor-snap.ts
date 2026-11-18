import { getOuterSize, type CanvasElement, type ScrapbookComposition } from "./composition";

export type SnapGuides = { vertical: number[]; horizontal: number[] };
export type SnapResult = { x: number; y: number; guides: SnapGuides };

function closestDelta(sources: number[], targets: number[], threshold: number) {
  let best: { delta: number; line: number } | null = null;
  for (const source of sources) {
    for (const target of targets) {
      const delta = target - source;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line: target };
    }
  }
  return best;
}

/**
 * Ajusta la posición propuesta de un elemento a los bordes y el centro del
 * lienzo y de los demás elementos (guías opcionales del editor).
 * `heightOverride` permite usar el alto real medido de un texto.
 */
export function snapPosition(
  composition: ScrapbookComposition,
  element: CanvasElement,
  proposed: { x: number; y: number },
  threshold: number,
  heightOverride?: number,
): SnapResult {
  const outer = getOuterSize(element);
  const height = heightOverride ?? outer.height;
  const w = outer.width * element.scale;
  const h = height * element.scale;
  const cx = proposed.x + outer.width / 2;
  const cy = proposed.y + height / 2;

  const { width: W, height: H } = composition.canvas;
  const verticalTargets = [0, W / 2, W];
  const horizontalTargets = [0, H / 2, H];
  for (const other of composition.elements) {
    if (other.id === element.id || other.visible === false) continue;
    const otherOuter = getOuterSize(other);
    const ocx = other.x + otherOuter.width / 2;
    const ocy = other.y + otherOuter.height / 2;
    const ow = otherOuter.width * other.scale;
    const oh = otherOuter.height * other.scale;
    verticalTargets.push(ocx - ow / 2, ocx, ocx + ow / 2);
    horizontalTargets.push(ocy - oh / 2, ocy, ocy + oh / 2);
  }

  const snapX = closestDelta([cx - w / 2, cx, cx + w / 2], verticalTargets, threshold);
  const snapY = closestDelta([cy - h / 2, cy, cy + h / 2], horizontalTargets, threshold);
  return {
    x: proposed.x + (snapX?.delta ?? 0),
    y: proposed.y + (snapY?.delta ?? 0),
    guides: { vertical: snapX ? [snapX.line] : [], horizontal: snapY ? [snapY.line] : [] },
  };
}

/** Rotación con imán suave a múltiplos de 45°. */
export function snapRotation(rotation: number, threshold = 4) {
  const nearest = Math.round(rotation / 45) * 45 || 0;
  return Math.abs(rotation - nearest) <= threshold ? nearest : rotation;
}
