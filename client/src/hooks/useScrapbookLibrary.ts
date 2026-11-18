import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScrapbookComposition } from "@/lib/composition";
import { loadCompositionLocally } from "@/lib/composition-storage";
import {
  applyCompositionToScrapbooks,
  createScrapbookDraft,
  forgetScrapbook,
  hydrateScrapbooks,
  persistComposition,
  saveCustomScrapbooks,
} from "@/lib/scrapbook-library";
import type { Scrapbook } from "@/lib/scrapbooks";
import { authStore, supabaseClient } from "@/lib/supabase/auth";
import { SupabaseError } from "@/lib/supabase/client";
import { createScrapbookRepository } from "@/lib/supabase/scrapbook-repository";
import type { AppUser } from "@/hooks/useAppAuth";

export type SaveResult = { persisted: boolean; message?: string; composition?: ScrapbookComposition };
export type CompositionStatus = "ready" | "loading" | "error";

const describe = (error: unknown) => (error instanceof SupabaseError ? error.message : "No se pudo conectar con el servidor.");

/**
 * Fuente de verdad de los scrapbooks de Home.
 * - "cloud": usuario con sesión de Supabase. Lee y guarda en Supabase; localStorage queda como copia de respaldo.
 * - "local": sin Supabase. Scrapbooks de demo y guardado en el navegador.
 */
export function useScrapbookLibrary(user: AppUser | null, provider: "supabase" | "manus") {
  const mode: "cloud" | "local" = provider === "supabase" && user && supabaseClient && authStore ? "cloud" : "local";
  const repository = useMemo(
    () =>
      mode === "cloud" && supabaseClient && authStore
        ? createScrapbookRepository({ client: supabaseClient, getAccessToken: () => authStore!.getAccessToken(), getUserId: () => authStore!.getSession()?.user.id ?? null })
        : null,
    [mode],
  );

  const [scrapbooks, setScrapbooks] = useState<Scrapbook[]>(() => (mode === "local" ? hydrateScrapbooks() : []));
  const [loading, setLoading] = useState(mode === "cloud");
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, CompositionStatus>>({});
  const requested = useRef(new Set<string>());
  const userId = user?.id ?? null;

  const reload = useCallback(async () => {
    if (!repository) {
      setScrapbooks(hydrateScrapbooks());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setScrapbooks(await repository.listScrapbooks());
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    requested.current.clear();
    setStatuses({});
    void reload();
  }, [reload, userId]);

  useEffect(() => {
    if (mode === "local") saveCustomScrapbooks(scrapbooks);
  }, [mode, scrapbooks]);

  /** Carga la composición de un scrapbook de la nube la primera vez que se abre. */
  const ensureComposition = useCallback(
    async (id: string, force = false) => {
      if (!repository || (!force && requested.current.has(id))) return;
      requested.current.add(id);
      setStatuses((current) => ({ ...current, [id]: "loading" }));
      try {
        const composition = await repository.loadComposition(id);
        if (composition) setScrapbooks((items) => items.map((book) => (book.id === id ? { ...book, composition } : book)));
        setStatuses((current) => ({ ...current, [id]: "ready" }));
      } catch {
        // Sin red: usamos la última copia guardada en este dispositivo, si existe.
        const backup = loadCompositionLocally(id);
        if (backup) {
          setScrapbooks((items) => items.map((book) => (book.id === id ? { ...book, composition: backup } : book)));
          setStatuses((current) => ({ ...current, [id]: "ready" }));
        } else {
          requested.current.delete(id);
          setStatuses((current) => ({ ...current, [id]: "error" }));
        }
      }
    },
    [repository],
  );

  const compositionStatus = useCallback((id: string): CompositionStatus => (mode === "local" ? "ready" : statuses[id] ?? "loading"), [mode, statuses]);

  const createScrapbook = useCallback(
    async (title: string, description: string) => {
      if (!repository) {
        const created = createScrapbookDraft(title, description);
        setScrapbooks((items) => [created, ...items]);
        return created;
      }
      const created = await repository.createScrapbook({ title, description });
      requested.current.add(created.id);
      setStatuses((current) => ({ ...current, [created.id]: "ready" }));
      setScrapbooks((items) => [created, ...items]);
      return created;
    },
    [repository],
  );

  const deleteScrapbook = useCallback(
    async (id: string) => {
      if (repository) await repository.deleteScrapbook(id);
      forgetScrapbook(id);
      setScrapbooks((items) => items.filter((item) => item.id !== id));
    },
    [repository],
  );

  /** Guardar del editor: actualiza el scrapbook en el estado compartido, en Supabase y en la copia local. */
  const saveComposition = useCallback(
    async (id: string, composition: ScrapbookComposition): Promise<SaveResult> => {
      if (!repository) {
        setScrapbooks((items) => applyCompositionToScrapbooks(items, id, composition));
        const result = persistComposition(id, composition);
        return result.ok ? { persisted: true } : { persisted: false, message: result.message };
      }
      try {
        const saved = await repository.saveComposition(id, composition);
        setScrapbooks((items) => applyCompositionToScrapbooks(items, id, saved));
        persistComposition(id, saved);
        return { persisted: true, composition: saved };
      } catch (err) {
        setScrapbooks((items) => applyCompositionToScrapbooks(items, id, composition));
        persistComposition(id, composition);
        return { persisted: false, message: `No se pudo guardar en la nube (${describe(err)}). Hay una copia en este dispositivo: vuelve a pulsar Guardar cuando tengas conexión.` };
      }
    },
    [repository],
  );

  return { mode, scrapbooks, loading, error, reload, ensureComposition, compositionStatus, createScrapbook, deleteScrapbook, saveComposition };
}
