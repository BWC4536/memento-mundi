import type { ScrapbookComposition } from "./composition";

/**
 * Estado del editor con historial. Las actualizaciones durante un gesto
 * (arrastrar, escribir) se aplican con `record: false` después de un
 * `checkpoint`, así un gesto completo se deshace de una sola vez.
 */
export type EditorState = {
  present: ScrapbookComposition;
  past: ScrapbookComposition[];
  future: ScrapbookComposition[];
  selectedId: string | null;
};

export type EditorAction =
  | { type: "apply"; update: (composition: ScrapbookComposition) => ScrapbookComposition; record?: boolean; select?: string | null }
  | { type: "checkpoint" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; id: string | null }
  | { type: "reset"; composition: ScrapbookComposition };

export const HISTORY_LIMIT = 80;

export function createEditorState(composition: ScrapbookComposition, selectedId: string | null = null): EditorState {
  return { present: composition, past: [], future: [], selectedId };
}

const pushPast = (past: ScrapbookComposition[], item: ScrapbookComposition) => [...past, item].slice(-HISTORY_LIMIT);

const selectionExists = (composition: ScrapbookComposition, id: string | null) =>
  id && composition.elements.some((element) => element.id === id) ? id : null;

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "apply": {
      const next = action.update(state.present);
      const selectedId = action.select !== undefined ? action.select : selectionExists(next, state.selectedId);
      if (next === state.present) return selectedId === state.selectedId ? state : { ...state, selectedId };
      const record = action.record ?? true;
      return {
        present: next,
        past: record ? pushPast(state.past, state.present) : state.past,
        future: record ? [] : state.future,
        selectedId,
      };
    }
    case "checkpoint":
      if (state.past[state.past.length - 1] === state.present) return state;
      return { ...state, past: pushPast(state.past, state.present), future: [] };
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
        selectedId: selectionExists(previous, state.selectedId),
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { present: next, past: pushPast(state.past, state.present), future: rest, selectedId: selectionExists(next, state.selectedId) };
    }
    case "select":
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id };
    case "reset":
      return createEditorState(action.composition);
    default:
      return state;
  }
}
