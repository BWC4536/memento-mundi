/**
 * Preferencias de la app guardadas en este dispositivo.
 * - reduceMotion: desactiva animaciones aunque el sistema no lo pida.
 */
import { browserStorage, createLocalStore, syncAcrossTabs, useLocalStore } from "./local-store";

export const PREFERENCES_KEY = "memento-mundi:preferences";

export type AppPreferences = { reduceMotion: boolean };
export const DEFAULT_PREFERENCES: AppPreferences = { reduceMotion: false };

export function parsePreferences(raw: string | null): AppPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const data = JSON.parse(raw) as Partial<AppPreferences>;
    return { reduceMotion: data.reduceMotion === true };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export const preferencesStore = createLocalStore<AppPreferences>(PREFERENCES_KEY, parsePreferences, browserStorage());
syncAcrossTabs([preferencesStore]);

export const useAppPreferences = () => useLocalStore(preferencesStore);
export const setAppPreference = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => preferencesStore.set({ ...preferencesStore.get(), [key]: value });
