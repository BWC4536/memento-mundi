import { describe, expect, it } from "vitest";
import { addElement, createEmptyComposition, createTextElement } from "./composition";
import { snapPosition, snapRotation } from "./editor-snap";

describe("guías de alineación", () => {
  it("ajusta al centro del lienzo cuando el elemento queda cerca", () => {
    const composition = createEmptyComposition();
    const element = { ...createTextElement(composition, { content: "hola", width: 200 }), height: 80 };
    const result = snapPosition(addElement(composition, element), element, { x: 503, y: 100 }, 8);
    expect(result.x).toBe(500);
    expect(result.guides.vertical).toEqual([600]);
  });

  it("no mueve el elemento si ninguna guía está cerca", () => {
    const composition = createEmptyComposition();
    const element = { ...createTextElement(composition, { content: "hola", width: 200 }), height: 80 };
    const result = snapPosition(composition, element, { x: 333, y: 222 }, 4);
    expect(result).toEqual({ x: 333, y: 222, guides: { vertical: [], horizontal: [] } });
  });

  it("imanta la rotación a múltiplos de 45°", () => {
    expect(snapRotation(43)).toBe(45);
    expect(snapRotation(-2)).toBe(0);
    expect(snapRotation(30)).toBe(30);
  });
});
