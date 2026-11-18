import { describe, expect, it } from "vitest";
import { addElement, createEmptyComposition, createPhotoElement, createTextElement, prepareCompositionForSave, setPhotoFilter } from "./composition";
import { compositionStorageKey, createMemoryStorage, loadCompositionLocally, removeCompositionLocally, saveCompositionLocally } from "./composition-storage";

describe("guardado local de la composición", () => {
  it("usa una clave por scrapbook", () => {
    expect(compositionStorageKey("algarve-2026")).toBe("memento-mundi:scrapbook:algarve-2026:composition");
  });

  it("guarda y recupera la composición completa", () => {
    const storage = createMemoryStorage();
    let composition = createEmptyComposition();
    const text = createTextElement(composition, { content: "hola" });
    const photo = createPhotoElement(composition, { src: "https://cdn.example/foto.webp", naturalWidth: 1200, naturalHeight: 800, frameId: "polaroid" });
    composition = setPhotoFilter(addElement(addElement(composition, photo), text), photo.id, "noir");
    const saved = prepareCompositionForSave(composition);

    expect(saveCompositionLocally("algarve-2026", saved, storage)).toMatchObject({ ok: true });
    expect(storage.data.has("memento-mundi:scrapbook:algarve-2026:composition")).toBe(true);

    const restored = loadCompositionLocally("algarve-2026", storage);
    expect(restored).toEqual(JSON.parse(JSON.stringify(saved)));
    expect(restored?.elements.find((element) => element.type === "text")?.content).toBe("hola");
    expect(restored?.elements.find((element) => element.type === "photo")).toMatchObject({ filter: "noir", frameId: "polaroid" });
    expect(loadCompositionLocally("otro", storage)).toBeNull();
  });

  it("informa si no hay espacio sin lanzar errores", () => {
    const storage = createMemoryStorage({}, 50);
    const result = saveCompositionLocally("x", createEmptyComposition(), storage);
    expect(result).toMatchObject({ ok: false, reason: "quota" });
  });

  it("ignora datos corruptos y permite borrar la copia", () => {
    const storage = createMemoryStorage({ [compositionStorageKey("roto")]: "{no es json" });
    expect(loadCompositionLocally("roto", storage)).toBeNull();
    removeCompositionLocally("roto", storage);
    expect(storage.data.size).toBe(0);
    expect(saveCompositionLocally("x", createEmptyComposition(), null)).toMatchObject({ ok: false, reason: "unavailable" });
  });
});
