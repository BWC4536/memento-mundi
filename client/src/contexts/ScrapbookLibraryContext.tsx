import { createContext, useContext, type ReactNode } from "react";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useScrapbookLibrary } from "@/hooks/useScrapbookLibrary";

type Library = ReturnType<typeof useScrapbookLibrary>;

const ScrapbookLibraryContext = createContext<Library | null>(null);

/** Una sola biblioteca para toda la app: lo que se guarda en el editor se ve al volver a Home. */
export function ScrapbookLibraryProvider({ children }: { children: ReactNode }) {
  const auth = useAppAuth();
  const library = useScrapbookLibrary(auth.user, auth.provider);
  return <ScrapbookLibraryContext.Provider value={library}>{children}</ScrapbookLibraryContext.Provider>;
}

export function useSharedScrapbookLibrary(): Library {
  const library = useContext(ScrapbookLibraryContext);
  if (!library) throw new Error("useSharedScrapbookLibrary debe usarse dentro de ScrapbookLibraryProvider");
  return library;
}
