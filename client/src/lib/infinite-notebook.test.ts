import { describe, expect, it } from "vitest";
import {
  addElement,
  arrangePhotos,
  createEmptyComposition,
  createNoteElement,
  createPhotoElement,
  createTextElement,
  getCenter,
  getContentBounds,
  getElementBounds,
  isNote,
  prepareCompositionForSave,
  sanitizeComposition,
  updateElement,
  updateText,
} from "./composition";
import { fitCamera, patternScale, screenToWorld, visibleWorldRect, worldToScreen, zoomCameraAt } from "./camera";
import { compositionToRows, rowsToComposition } from "./supabase-composition";

const base = () => createEmptyComposition(new Date("2026-11-25T10:00:00.000Z"));
const photo = (composition = base(), center = { x: 0, y: 0 }) => createPhotoElement(composition, { src: "https://cdn.example/a.webp", naturalWidth: 1200, naturalHeight: 800, center });

describe("cámara del cuaderno infinito", () => {
  it("convierte pantalla ↔ cuaderno de ida y vuelta", () => {
    const camera = { zoom: 0.5, x: 120, y: -40 };
    const world = screenToWorld(camera, { x: 300, y: 200 });
    expect(world).toEqual({ x: 360, y: 480 });
    expect(worldToScreen(camera, world)).toEqual({ x: 300, y: 200 });
  });

  it("el zoom mantiene fijo el punto bajo el cursor y respeta los límites", () => {
    const camera = { zoom: 1, x: 0, y: 0 };
    const anchor = { x: 400, y: 300 };
    const before = screenToWorld(camera, anchor);
    const zoomed = zoomCameraAt(camera, 2, anchor);
    expect(zoomed.zoom).toBe(2);
    expect(screenToWorld(zoomed, anchor)).toEqual(before);
    expect(zoomCameraAt(camera, 100, anchor).zoom).toBe(4);
    expect(zoomCameraAt(camera, 0.001, anchor).zoom).toBe(0.1);
  });

  it("encuadra un contenido en cualquier posición, también en coordenadas negativas", () => {
    const viewport = { width: 1000, height: 800 };
    const bounds = { x: -5000, y: -3000, width: 2000, height: 1000 };
    const camera = fitCamera(bounds, viewport, { padding: 0 });
    expect(camera.zoom).toBe(0.5);
    const visible = visibleWorldRect(camera, viewport);
    expect(visible.x + visible.width / 2).toBeCloseTo(-4000);
    expect(visible.y + visible.height / 2).toBeCloseTo(-2500);
    // Una sola foto pequeña no se amplía más allá del 100%.
    expect(fitCamera({ x: 0, y: 0, width: 100, height: 100 }, viewport).zoom).toBe(1);
  });

  it("el patrón del papel no se convierte en ruido al alejar", () => {
    expect(patternScale(1)).toBe(1);
    expect(patternScale(0.1) * 36).toBeGreaterThanOrEqual(14);
  });
});

describe("contenido sin bordes", () => {
  it("los elementos pueden vivir fuera de la zona de referencia y se guardan tal cual", () => {
    const far = photo(base(), { x: -2400, y: 5100 });
    const composition = prepareCompositionForSave(addElement(base(), far));
    const restored = sanitizeComposition(JSON.parse(JSON.stringify(composition)))!;
    expect(getCenter(restored.elements[0]).x).toBeCloseTo(-2400);
    expect(getCenter(restored.elements[0]).y).toBeCloseTo(5100);
  });

  it("el encuadre cubre todos los elementos visibles con margen", () => {
    let composition = addElement(base(), photo(base(), { x: -1000, y: 0 }));
    composition = addElement(composition, photo(composition, { x: 3000, y: 200 }));
    const bounds = getContentBounds(composition);
    for (const element of composition.elements) {
      const box = getElementBounds(element);
      expect(box.x).toBeGreaterThan(bounds.x);
      expect(box.x + box.width).toBeLessThan(bounds.x + bounds.width);
      expect(box.y).toBeGreaterThan(bounds.y);
      expect(box.y + box.height).toBeLessThan(bounds.y + bounds.height);
    }
    // Una fila larga no se queda como una tira: la proporción se limita.
    expect(bounds.width / bounds.height).toBeLessThanOrEqual(2.4 + 1e-6);
  });

  it("sin elementos, el encuadre es la zona de referencia", () => {
    expect(getContentBounds(base())).toEqual({ x: 0, y: 0, width: 1200, height: 900 });
  });

  it("la caja de un elemento girado 90° intercambia ancho y alto", () => {
    const element = { ...createTextElement(base(), { content: "x", width: 400 }), height: 100, rotation: 90 };
    const box = getElementBounds(element);
    expect(box.width).toBeCloseTo(100);
    expect(box.height).toBeCloseTo(400);
  });

  it("ordenar fotos las coloca alrededor de su grupo, sin cambiar su tamaño", () => {
    let composition = base();
    for (const center of [{ x: 5000, y: 5000 }, { x: 5100, y: 5200 }, { x: 4900, y: 5100 }, { x: 5050, y: 4950 }]) {
      composition = addElement(composition, photo(composition, center));
    }
    const grid = arrangePhotos(composition, "grid");
    const centers = grid.elements.map(getCenter);
    const cx = centers.reduce((sum, point) => sum + point.x, 0) / centers.length;
    const cy = centers.reduce((sum, point) => sum + point.y, 0) / centers.length;
    expect(cx).toBeCloseTo(5012.5, 0);
    expect(cy).toBeCloseTo(5062.5, 0);
    expect(grid.elements.every((element) => element.scale === 1 && element.rotation === 0)).toBe(true);
  });
});

describe("notas breves", () => {
  it("una nota es un texto manuscrito sobre papel de color", () => {
    const note = createNoteElement(base(), { center: { x: -300, y: 40 }, color: "#D8E2DC" });
    expect(isNote(note)).toBe(true);
    expect(note.type).toBe("text");
    expect(note.textStyle).toMatchObject({ variant: "note", fontFamily: "hand", background: "#D8E2DC" });
    expect(getCenter(note).x).toBeCloseTo(-300);
  });

  it("crece al escribir y nunca es más baja que un papel de nota", () => {
    const note = createNoteElement(base());
    let composition = addElement(base(), note);
    const empty = composition.elements[0].height;
    expect(empty).toBeGreaterThanOrEqual(note.width * 0.62);
    composition = updateText(composition, note.id, "Primer día en Lisboa.\nTranvía 28, pastéis de nata y atardecer en el mirador.\n¡Volver!");
    expect(composition.elements[0].height).toBeGreaterThan(empty);
    composition = updateElement(composition, note.id, { textStyle: { background: "#F2C5A0" } });
    expect(composition.elements[0].textStyle).toMatchObject({ variant: "note", background: "#F2C5A0" });
  });

  it("se guarda en Supabase sin columnas nuevas (va en style_json)", () => {
    const note = { ...createNoteElement(base(), { content: "hola" }), id: "33333333-3333-4333-8333-333333333333" };
    const composition = prepareCompositionForSave(addElement(base(), note));
    const { page, elements } = compositionToRows(composition, { scrapbookId: "sb-1", pageId: "22222222-2222-4222-8222-222222222222", createdBy: "user-1" });
    expect(elements[0].element_type).toBe("text");
    const restored = rowsToComposition(page, elements)!;
    expect(isNote(restored.elements[0])).toBe(true);
    expect(restored.elements[0].content).toBe("hola");
  });
});
