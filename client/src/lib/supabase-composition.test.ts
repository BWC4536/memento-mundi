import { describe, expect, it } from "vitest";
import { addElement, createEmptyComposition, createPhotoElement, createTextElement, prepareCompositionForSave, setPhotoFilter } from "./composition";
import { buildAssetStoragePath, compositionToRows, findInlineAssets, rowsToComposition } from "./supabase-composition";

describe("mapeo a Supabase (preparado, no conectado)", () => {
  it("convierte la composición en filas y de vuelta sin perder datos", () => {
    let composition = createEmptyComposition();
    const photo = createPhotoElement(composition, { src: "https://xyz.supabase.co/storage/v1/object/public/scrapbook-media/a.webp", naturalWidth: 1200, naturalHeight: 900, frameId: "polaroid" });
    const text = createTextElement(composition, { content: "hola", textStyle: { color: "#FA9223" } });
    composition = prepareCompositionForSave(setPhotoFilter(addElement(addElement(composition, photo), text), photo.id, "vintage"));

    const { page, elements } = compositionToRows(composition, { scrapbookId: "sb-1", pageId: "page-1" });
    expect(page).toMatchObject({ scrapbook_id: "sb-1", width: 1200, height: 900, background: "#EAE7DA" });
    expect(elements.find((row) => row.element_type === "photo")).toMatchObject({ filter_name: "vintage", frame_id: "polaroid", z_index: 1 });
    expect(elements.find((row) => row.element_type === "text")).toMatchObject({ content: "hola", z_index: 2 });

    const restored = rowsToComposition(page, elements)!;
    expect(restored.elements.find((element) => element.type === "text")).toMatchObject({ content: "hola", textStyle: { color: "#FA9223" } });
    expect(restored.elements.find((element) => element.type === "photo")).toMatchObject({ filter: "vintage", frameId: "polaroid" });
  });

  it("se niega a guardar bytes de imagen en la base de datos", () => {
    let composition = createEmptyComposition();
    composition = addElement(composition, createPhotoElement(composition, { src: "data:image/webp;base64,AAAA" }));
    expect(findInlineAssets(composition)).toHaveLength(1);
    expect(() => compositionToRows(composition, { scrapbookId: "a", pageId: "b" })).toThrow(/Storage/);
  });

  it("construye rutas de Storage coherentes con las políticas RLS", () => {
    expect(buildAssetStoragePath("sb-1", "user-9", "asset-3", "image/jpeg")).toBe("sb-1/user-9/asset-3.jpg");
  });
});
