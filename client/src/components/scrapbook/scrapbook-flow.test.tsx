import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  addElement,
  applyFrame,
  createPhotoElement,
  createTextElement,
  findElement,
  prepareCompositionForSave,
  setPhotoFilter,
  sortByZ,
  updateElement,
  updateText,
  type ScrapbookComposition,
} from "@/lib/composition";
import { createMemoryStorage } from "@/lib/composition-storage";
import { createEditorState, editorReducer, type EditorState } from "@/lib/editor-history";
import { applyCompositionToScrapbooks, getScrapbookComposition, hydrateScrapbooks, persistComposition } from "@/lib/scrapbook-library";
import { demoScrapbooks } from "@/lib/scrapbooks";
import ScrapbookPhotoView from "@/components/ScrapbookPhotoView";
import InfiniteCanvasEditor from "@/components/InfiniteCanvasEditor";
import CompositionViewer from "./CompositionViewer";

const PHOTO = "https://cdn.example/foto-prueba.webp";

/** Simula una sesión de edición con el mismo reducer que usa el editor. */
function editSession(initial: ScrapbookComposition) {
  let state: EditorState = createEditorState(initial);
  const run = (action: Parameters<typeof editorReducer>[1]) => {
    state = editorReducer(state, action);
  };

  // 1-4. Pulsar Texto, crear la capa y escribir exactamente "hola".
  const text = createTextElement(state.present, { center: { x: 600, y: 700 } });
  run({ type: "apply", update: (composition) => addElement(composition, text), select: text.id });
  run({ type: "checkpoint" });
  for (const value of ["h", "ho", "hol", "hola"]) run({ type: "apply", update: (composition) => updateText(composition, text.id, value), record: false });
  // 5-7. Mover, cambiar tamaño y color.
  run({ type: "apply", update: (composition) => updateElement(composition, text.id, { x: 120, y: 760, scale: 1.4, textStyle: { color: "#FA9223" } }) });
  // 8-11. Añadir foto, marco y filtro blanco y negro.
  const photo = createPhotoElement(state.present, { src: PHOTO, naturalWidth: 1200, naturalHeight: 800 });
  run({ type: "apply", update: (composition) => addElement(composition, photo), select: photo.id });
  run({ type: "apply", update: (composition) => applyFrame(composition, photo.id, "polaroid") });
  run({ type: "apply", update: (composition) => setPhotoFilter(composition, photo.id, "noir") });
  return { state, textId: text.id, photoId: photo.id };
}

const elementOrder = (markup: string) => Array.from(markup.matchAll(/data-element-id="([^"]+)"/g), (match) => match[1]);

describe("flujo completo: editar, guardar, cerrar y ver", () => {
  it("la composición guardada sobrevive al cierre del editor y a un refresh", () => {
    const storage = createMemoryStorage();
    let scrapbooks = hydrateScrapbooks(demoScrapbooks, storage);
    const book = scrapbooks[0];

    const { state, textId, photoId } = editSession(getScrapbookComposition(book));
    expect(findElement(state.present, textId)?.content).toBe("hola");

    // 12. Guardar: el editor devuelve la composición al padre (Home), que la aplica y la respalda.
    const saved = prepareCompositionForSave(state.present);
    scrapbooks = applyCompositionToScrapbooks(scrapbooks, book.id, saved);
    expect(persistComposition(book.id, saved, storage)).toMatchObject({ ok: true });

    // 13. Cerrar con X: el estado del editor se descarta, el padre conserva la composición.
    const inParent = getScrapbookComposition(scrapbooks.find((item) => item.id === book.id)!);
    expect(findElement(inParent, textId)?.content).toBe("hola");

    // Refresh del navegador: se recupera desde localStorage.
    const reloaded = hydrateScrapbooks(demoScrapbooks, storage);
    const recovered = getScrapbookComposition(reloaded.find((item) => item.id === book.id)!);
    expect(recovered).toEqual(JSON.parse(JSON.stringify(inParent)));
    expect(findElement(recovered, photoId)).toMatchObject({ src: PHOTO, filter: "noir", frameId: "polaroid" });
  });

  it("la previsualización muestra la composición guardada (foto, marco, filtro y texto hola)", () => {
    const book = demoScrapbooks[0];
    const { state, textId } = editSession(getScrapbookComposition(book));
    const saved = prepareCompositionForSave(state.present);
    const markup = renderToStaticMarkup(<ScrapbookPhotoView scrapbook={book} composition={saved} onBack={() => {}} onEdit={() => {}} />);

    expect(markup).toContain(">hola</div>");
    expect(markup).toContain(PHOTO);
    expect(markup).toContain('data-filter="noir"');
    expect(markup).toContain("grayscale(1)");
    expect(markup).toContain(" Editar</button>");
    expect(markup).toContain(" Ver</button>");
    // Las capas se pintan en orden de z.
    expect(elementOrder(markup)).toEqual(sortByZ(saved.elements).map((element) => element.id));
    expect(elementOrder(markup).at(-1)).not.toBe(textId);
  });

  it("la pantalla completa renderiza exactamente los mismos elementos que la previsualización", () => {
    const book = demoScrapbooks[0];
    const saved = prepareCompositionForSave(editSession(getScrapbookComposition(book)).state.present);
    const preview = renderToStaticMarkup(<ScrapbookPhotoView scrapbook={book} composition={saved} onBack={() => {}} onEdit={() => {}} />);
    const fullscreen = renderToStaticMarkup(<CompositionViewer open composition={saved} title={book.title} location={book.location} onClose={() => {}} />);

    expect(fullscreen).toContain(">hola</div>");
    expect(fullscreen).toContain('aria-label="Cerrar"');
    expect(fullscreen).toContain('data-filter="noir"');
    expect(elementOrder(fullscreen)).toEqual(elementOrder(preview));

    // Deep link ?fullscreen desde la vista previa también muestra la composición, no solo la portada.
    const deepLink = renderToStaticMarkup(<ScrapbookPhotoView scrapbook={book} composition={saved} onBack={() => {}} onEdit={() => {}} initialFullscreen />);
    expect(elementOrder(deepLink)).toEqual([...elementOrder(preview), ...elementOrder(preview)]);
  });

  it("al reabrir el editor se carga la composición guardada", () => {
    const book = demoScrapbooks[0];
    const saved = prepareCompositionForSave(editSession(getScrapbookComposition(book)).state.present);
    const markup = renderToStaticMarkup(<InfiniteCanvasEditor scrapbook={book} initialComposition={saved} onSave={() => undefined} onClose={() => {}} />);
    expect(markup).toContain(">hola</div>");
    expect(markup).toContain("Guardar");
    expect(markup).toContain('aria-label="Cerrar editor"');
    for (const label of ["Fotos", "Nota", "Texto", "Decorar", "Capas", "Papel"]) expect(markup).toContain(label);
    // Nada de "formatos" ni marcos de página: el cuaderno no tiene bordes.
    expect(markup).not.toContain("Formato del lienzo");
  });

  it("un scrapbook nuevo empieza vacío con instrucciones", () => {
    const fresh = { ...demoScrapbooks[0], id: "new-1", createdAt: "2026-11-18T10:00:00.000Z" };
    const composition = getScrapbookComposition(fresh);
    expect(composition.elements).toHaveLength(0);
    const markup = renderToStaticMarkup(<InfiniteCanvasEditor scrapbook={fresh} initialComposition={composition} onSave={() => undefined} onClose={() => {}} />);
    expect(markup).toContain("Tu cuaderno está en blanco");
  });
});
