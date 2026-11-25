import { useSyncExternalStore } from "react";
import type { StorageLike } from "./composition-storage";

/**
 * Pequeño almacén reactivo respaldado en localStorage, sincronizado entre pestañas.
 * `parse` recibe el texto guardado (o null) y devuelve el valor válido.
 */
export function createLocalStore<T>(key: string, parse: (raw: string | null) => T, storage: StorageLike | null) {
  const read = () => {
    try {
      return parse(storage?.getItem(key) ?? null);
    } catch {
      return parse(null);
    }
  };
  let value = read();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  return {
    key,
    get: () => value,
    set(next: T | null) {
      try {
        if (next === null) storage?.removeItem(key);
        else storage?.setItem(key, JSON.stringify(next));
      } catch {
        /* sin almacenamiento: vale para esta visita */
      }
      value = next === null ? parse(null) : next;
      emit();
    },
    /** Relee lo guardado (otra pestaña pudo cambiarlo). */
    sync() {
      value = read();
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type LocalStore<T> = ReturnType<typeof createLocalStore<T>>;

export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Escucha cambios hechos en otras pestañas. */
export function syncAcrossTabs(stores: Array<{ key: string; sync: () => void }>) {
  if (typeof window === "undefined") return;
  window.addEventListener("storage", (event) => {
    for (const store of stores) if (event.key === store.key || event.key === null) store.sync();
  });
}

export function useLocalStore<T>(store: LocalStore<T>) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Estado booleano global simple (p. ej. abrir un diálogo desde cualquier sitio). */
export function createFlag(initial = false) {
  let value = initial;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const set = (next: boolean) => {
    value = next;
    listeners.forEach((listener) => listener());
  };
  const get = () => value;
  return { get, set, use: () => useSyncExternalStore(subscribe, get, () => initial) };
}
