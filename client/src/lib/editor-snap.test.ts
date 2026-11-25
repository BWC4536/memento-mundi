import { describe, expect, it } from "vitest";
import { addElement, createEmptyComposition, createTextElement } from "./composition";
import { snapPosition, snapRotation } from "./editor-snap";

describe("guías de alineación", () => {
  it("ajusta al centro de otro elemento cuando queda cerca", () => {
    const composition = createEmptyComposition();
    const anchor = { ...createTextElement(composition, { content: "ancla", width: 200 }), x: 500, y: 600, height: 80 };
    const element = { ...createTextElement(composition, { content: "hola", width: 200 }), height: 80 };
    const result = snapPosition(addElement(addElement(composition, anchor), element), element, { x: 503, y: 100 }, 8);
    expect(result.x).toBe(500);
    expect(result.guides.vertical).toEqual([500]);
  });

  it("no hay bordes de página: un elemento solo no se imanta a nada", () => {
    const composition = createEmptyComposition();
    const element = { ...createTextElement(composition, { content: "hola", width: 200 }), height: 80 };
    const result = snapPosition(addElement(composition, element), element, { x: 502, y: -3 }, 8);
    expect(result).toEqual({ x: 502, y: -3, guides: { vertical: [], horizontal: [] } });
  });

  it("imanta la rotación a múltiplos de 45°", () => {
    expect(snapRotation(43)).toBe(45);
    expect(snapRotation(-2)).toBe(0);
    expect(snapRotation(30)).toBe(30);
  });
});
