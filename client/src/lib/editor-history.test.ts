import { describe, expect, it } from "vitest";
import { addElement, createEmptyComposition, createTextElement, findElement, updateElement, updateText } from "./composition";
import { createEditorState, editorReducer } from "./editor-history";

describe("historial del editor", () => {
  it("deshace y rehace cambios registrados", () => {
    const initial = createEmptyComposition();
    const text = createTextElement(initial, { content: "hola" });
    let state = createEditorState(initial);
    state = editorReducer(state, { type: "apply", update: (composition) => addElement(composition, text), select: text.id });
    expect(state.selectedId).toBe(text.id);
    expect(state.present.elements).toHaveLength(1);
    state = editorReducer(state, { type: "undo" });
    expect(state.present.elements).toHaveLength(0);
    expect(state.selectedId).toBeNull();
    state = editorReducer(state, { type: "redo" });
    expect(state.present.elements).toHaveLength(1);
  });

  it("agrupa un gesto o la escritura completa en un solo paso de historial", () => {
    const initial = createEmptyComposition();
    const text = createTextElement(initial);
    let state = editorReducer(createEditorState(initial), { type: "apply", update: (composition) => addElement(composition, text), select: text.id });
    state = editorReducer(state, { type: "checkpoint" });
    for (const value of ["h", "ho", "hol", "hola"]) {
      state = editorReducer(state, { type: "apply", update: (composition) => updateText(composition, text.id, value), record: false });
    }
    for (let i = 1; i <= 5; i += 1) {
      state = editorReducer(state, { type: "apply", update: (composition) => updateElement(composition, text.id, { x: i * 10 }), record: false });
    }
    expect(findElement(state.present, text.id)?.content).toBe("hola");
    state = editorReducer(state, { type: "undo" });
    expect(findElement(state.present, text.id)?.content).toBe("");
  });

  it("no crea entradas de historial cuando nada cambia", () => {
    const state = createEditorState(createEmptyComposition());
    const next = editorReducer(state, { type: "apply", update: (composition) => composition });
    expect(next).toBe(state);
  });
});
