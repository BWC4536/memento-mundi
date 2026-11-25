import { describe, expect, it } from "vitest";
import {
  addElement,
  applyFrame,
  bringToFront,
  clampCanvasZoom,
  clampElementScale,
  clampRotation,
  createEmptyComposition,
  createFrameElement,
  createPhotoElement,
  createStarterComposition,
  createTextElement,
  duplicateElement,
  findElement,
  getFilterDefinition,
  getFramePadding,
  getOuterSize,
  getPhotoImageStyle,
  moveLayer,
  normalizeRotation,
  placePhotoInFrame,
  prepareCompositionForSave,
  removeElement,
  replacePhoto,
  sanitizeComposition,
  sendToBack,
  setPhotoCropFormat,
  setPhotoFilter,
  sortByZ,
  updateElement,
  updateText,
  PHOTO_FILTERS,
} from "./composition";
import { applyDesignPreset, setCanvasBackground } from "./composition-presets";

const base = () => createEmptyComposition(new Date("2026-11-18T10:00:00.000Z"));

describe("texto", () => {
  it("crea una capa de texto editable centrada y encima de todo", () => {
    const composition = base();
    const text = createTextElement(composition, { center: { x: 600, y: 450 } });
    const next = addElement(composition, text);
    const created = findElement(next, text.id)!;
    expect(created.type).toBe("text");
    expect(created.content).toBe("");
    expect(created.x + created.width / 2).toBeCloseTo(600);
    expect(created.z).toBe(1);
  });

  it("modifica el texto y guarda exactamente lo escrito", () => {
    const text = createTextElement(base());
    const composition = addElement(base(), text);
    const edited = updateText(composition, text.id, "hola");
    expect(findElement(edited, text.id)?.content).toBe("hola");
    expect(findElement(composition, text.id)?.content).toBe("");
    const restyled = updateElement(edited, text.id, { textStyle: { color: "#FA9223", fontSize: 999, align: "left", fontFamily: "hand" } });
    const style = findElement(restyled, text.id)!.textStyle!;
    expect(style.color).toBe("#FA9223");
    expect(style.fontSize).toBe(240);
    expect(style.align).toBe("left");
    expect(style.fontFamily).toBe("hand");
    expect(findElement(restyled, text.id)?.content).toBe("hola");
  });

  it("descarta textos vacíos al guardar y conserva los escritos", () => {
    const empty = createTextElement(base());
    const filled = createTextElement(base(), { content: "hola" });
    const composition = addElement(addElement(base(), empty), filled);
    const saved = prepareCompositionForSave(composition, new Date("2026-11-18T12:00:00.000Z"));
    expect(saved.elements.map((element) => element.content)).toEqual(["hola"]);
    expect(saved.updatedAt).toBe("2026-11-18T12:00:00.000Z");
  });
});

describe("marcos y fotos", () => {
  it("el marco hereda inicialmente el tamaño y la proporción de la foto", () => {
    const composition = base();
    const photo = createPhotoElement(composition, { src: "data:image/webp;base64,AAAA", naturalWidth: 3000, naturalHeight: 2000 });
    expect(photo.width / photo.height).toBeCloseTo(1.5);
    const withPhoto = addElement(composition, photo);
    const framed = applyFrame(withPhoto, photo.id, "polaroid");
    const result = findElement(framed, photo.id)!;
    expect(result.frameId).toBe("polaroid");
    expect(result.src).toBe(photo.src);
    expect(result.width).toBe(photo.width);
    expect(result.height).toBe(photo.height);
    const pad = getFramePadding("polaroid", result.width, result.height);
    expect(getOuterSize(result)).toEqual({ width: result.width + pad.left + pad.right, height: result.height + pad.top + pad.bottom });
    // El marco es proporcional al lado corto de la foto: nunca desproporcionado.
    expect(pad.left / Math.min(result.width, result.height)).toBeCloseTo(0.06);
  });

  it("cambiar el marco conserva la foto y su centro", () => {
    const photo = createPhotoElement(base(), { src: "/foto.jpg", naturalWidth: 800, naturalHeight: 1000 });
    const composition = addElement(base(), photo);
    const before = findElement(composition, photo.id)!;
    const centerBefore = { x: before.x + getOuterSize(before).width / 2, y: before.y + getOuterSize(before).height / 2 };
    const changed = applyFrame(applyFrame(composition, photo.id, "postcard"), photo.id, "rounded");
    const after = findElement(changed, photo.id)!;
    expect(after.src).toBe("/foto.jpg");
    expect(after.frameId).toBe("rounded");
    expect(after.x + getOuterSize(after).width / 2).toBeCloseTo(centerBefore.x);
    expect(after.y + getOuterSize(after).height / 2).toBeCloseTo(centerBefore.y);
  });

  it("añade un marco vacío y al poner una foto adopta su proporción", () => {
    const composition = base();
    const frame = createFrameElement(composition, "classic", 1);
    const withFrame = addElement(composition, frame);
    expect(findElement(withFrame, frame.id)?.type).toBe("frame");
    const filled = placePhotoInFrame(withFrame, frame.id, { src: "/vertical.jpg", naturalWidth: 900, naturalHeight: 1600 });
    const photo = findElement(filled, frame.id)!;
    expect(photo.type).toBe("photo");
    expect(photo.frameId).toBe("classic");
    expect(photo.width / photo.height).toBeCloseTo(900 / 1600);
    expect(Math.max(photo.width, photo.height)).toBeCloseTo(Math.max(frame.width, frame.height));
  });

  it("reemplaza la foto sin perder marco ni filtro", () => {
    const photo = createPhotoElement(base(), { src: "/a.jpg", naturalWidth: 400, naturalHeight: 300, frameId: "navy" });
    const composition = setPhotoFilter(addElement(base(), photo), photo.id, "sepia");
    const replaced = findElement(replacePhoto(composition, photo.id, { src: "/b.jpg", naturalWidth: 300, naturalHeight: 300 }), photo.id)!;
    expect(replaced.src).toBe("/b.jpg");
    expect(replaced.frameId).toBe("navy");
    expect(replaced.filter).toBe("sepia");
    expect(replaced.width).toBeCloseTo(replaced.height);
  });

  it("recorta a un formato con object-fit cover y permite mover la foto dentro", () => {
    const photo = createPhotoElement(base(), { src: "/a.jpg", naturalWidth: 1600, naturalHeight: 900 });
    const square = findElement(setPhotoCropFormat(addElement(base(), photo), photo.id, "square"), photo.id)!;
    expect(square.width).toBeCloseTo(square.height);
    expect(square.crop?.fit).toBe("cover");
    const style = getPhotoImageStyle({ fit: "cover", zoom: 2, offsetX: -1, offsetY: 0.5 });
    expect(style.objectFit).toBe("cover");
    expect(style.objectPosition).toBe("0% 75%");
    expect(style.transform).toBe("scale(2)");
    expect(getPhotoImageStyle({ fit: "contain", zoom: 9, offsetX: 4, offsetY: 0 }).transform).toBe("scale(3)");
  });
});

describe("filtros", () => {
  it("incluye todos los filtros requeridos con CSS no destructivo", () => {
    expect(PHOTO_FILTERS.map((filter) => filter.id)).toEqual(["original", "noir", "vivid", "contrast", "vintage", "warm", "cool", "fade", "sepia"]);
    expect(getFilterDefinition("noir").label).toBe("Blanco y negro");
    expect(getFilterDefinition("noir").css).toContain("grayscale(1)");
  });

  it("aplica el filtro como propiedad del elemento sin tocar la imagen original", () => {
    const photo = createPhotoElement(base(), { src: "/original.jpg" });
    const composition = addElement(base(), photo);
    const filtered = findElement(setPhotoFilter(composition, photo.id, "noir"), photo.id)!;
    expect(filtered.filter).toBe("noir");
    expect(filtered.src).toBe("/original.jpg");
    const text = createTextElement(base(), { content: "hola" });
    const withText = addElement(base(), text);
    expect(setPhotoFilter(withText, text.id, "noir")).toBe(withText);
  });
});

describe("límites de zoom, rotación y escala", () => {
  it("limita el zoom del lienzo de la cámara entre 0.1 y 4", () => {
    expect(clampCanvasZoom(0.01)).toBe(0.1);
    expect(clampCanvasZoom(9)).toBe(4);
    expect(clampCanvasZoom(1.25)).toBe(1.25);
    expect(clampCanvasZoom(Number.NaN)).toBe(0.1);
  });

  it("limita la escala entre 0.25 y 3 y la rotación entre -180 y 180", () => {
    expect(clampElementScale(0.01)).toBe(0.25);
    expect(clampElementScale(12)).toBe(3);
    expect(clampRotation(270)).toBe(180);
    expect(clampRotation(-500)).toBe(-180);
    expect(normalizeRotation(190)).toBe(-170);
    expect(normalizeRotation(-190)).toBe(170);
    expect(normalizeRotation(540)).toBe(180);
  });

  it("los parches del modelo también respetan los límites", () => {
    const text = createTextElement(base(), { content: "hola" });
    const composition = addElement(base(), text);
    const updated = findElement(updateElement(composition, text.id, { scale: 50, rotation: -720 }), text.id)!;
    expect(updated.scale).toBe(3);
    expect(updated.rotation).toBe(-180);
  });
});

describe("capas", () => {
  const layered = () => {
    let composition = base();
    const ids: string[] = [];
    for (const content of ["fondo", "medio", "frente"]) {
      const element = createTextElement(composition, { content });
      ids.push(element.id);
      composition = addElement(composition, element);
    }
    return { composition, ids };
  };
  const order = (composition: ReturnType<typeof base>) => sortByZ(composition.elements).map((element) => element.content);

  it("trae al frente, envía al fondo, sube y baja una capa", () => {
    const { composition, ids } = layered();
    expect(order(composition)).toEqual(["fondo", "medio", "frente"]);
    expect(order(bringToFront(composition, ids[0]))).toEqual(["medio", "frente", "fondo"]);
    expect(order(sendToBack(composition, ids[2]))).toEqual(["frente", "fondo", "medio"]);
    expect(order(moveLayer(composition, ids[0], "up"))).toEqual(["medio", "fondo", "frente"]);
    expect(order(moveLayer(composition, ids[2], "down"))).toEqual(["fondo", "frente", "medio"]);
    expect(sortByZ(bringToFront(composition, ids[0]).elements).map((element) => element.z)).toEqual([1, 2, 3]);
  });

  it("duplica y elimina elementos", () => {
    const { composition, ids } = layered();
    const duplicated = duplicateElement(composition, ids[1], "copia");
    expect(findElement(duplicated, "copia")?.content).toBe("medio");
    expect(order(duplicated).at(-1)).toBe("medio");
    expect(removeElement(duplicated, "copia").elements).toHaveLength(3);
  });
});

describe("diseño", () => {
  it("cambia el papel (color y patrón) sin marco de página", () => {
    const text = createTextElement(base(), { content: "hola", center: { x: 600, y: 450 } });
    const composition = addElement(base(), text);
    const night = applyDesignPreset(composition, "nocturno");
    expect(night.canvas.background).toBe("#0B2130");
    expect(night.canvas.texture).toBe("dots");
    expect(night.canvas.frame).toBe("none");
    expect(findElement(night, text.id)?.textStyle?.color).toBe("#EAE7DA");
    expect(setCanvasBackground(night, "#EAE7DA").elements[0].textStyle?.color).toBe("#0B2130");
    // Cambiar el papel nunca mueve los elementos.
    expect(findElement(night, text.id)).toMatchObject({ x: text.x, y: text.y });
  });

  it("la composición inicial usa la portada como una foto más, con título y ubicación", () => {
    const starter = createStarterComposition({ id: "x", title: "Viaje", location: "Lisboa, Portugal", cover: "/cover.jpg" });
    expect(starter.elements.find((element) => element.type === "photo")?.src).toBe("/cover.jpg");
    expect(starter.elements.find((element) => element.type === "text")?.content).toBe("Viaje");
    expect(starter.elements.find((element) => element.sampleId === "stamp-location")?.content).toBe("Lisboa, Portugal");
  });
});

describe("validación", () => {
  it("sanea datos externos y descarta elementos inválidos", () => {
    const raw = {
      canvas: { width: 99999, height: 10, background: "#fff", texture: "nope" },
      elements: [
        { id: "ok", type: "text", x: 1, y: 2, width: 100, height: 20, rotation: 999, scale: 10, z: 3, content: "hola", filter: "inventado" },
        { id: "bad", type: "video" },
        "basura",
      ],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const composition = sanitizeComposition(raw)!;
    expect(composition.canvas.width).toBe(4000);
    expect(composition.canvas.height).toBe(320);
    expect(composition.canvas.texture).toBe("none");
    expect(composition.elements).toHaveLength(1);
    expect(composition.elements[0]).toMatchObject({ id: "ok", content: "hola", rotation: 180, scale: 3, z: 1 });
    expect(sanitizeComposition({ nope: true })).toBeNull();
  });
});
