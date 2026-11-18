import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { authStore, useSupabaseSession } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase-config";

/* Diálogo de login global (se pinta una vez en App). */
let loginOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function openLoginDialog() {
  loginOpen = true;
  emit();
}
export function closeLoginDialog() {
  loginOpen = false;
  emit();
}
export function useLoginDialogOpen() {
  return useSyncExternalStore(subscribe, () => loginOpen, () => false);
}

export type AppUser = { id: string; name: string; email: string | null };

/**
 * Sesión de la app. Con Supabase configurado (VITE_SUPABASE_*) usa Supabase Auth por
 * email; si no, mantiene el login de Manus del scaffold.
 */
export function useAppAuth() {
  const manus = useAuth();
  const { session, ready } = useSupabaseSession();

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) await authStore?.signOut();
    else await manus.logout();
  }, [manus]);

  if (isSupabaseConfigured) {
    const user: AppUser | null = session
      ? { id: session.user.id, email: session.user.email, name: session.user.name ?? session.user.email?.split("@")[0] ?? "Viajero" }
      : null;
    return { provider: "supabase" as const, loading: !ready, isAuthenticated: !!session, user, openLogin: openLoginDialog, signOut };
  }

  const manusUser = manus.user as { id?: unknown; name?: string | null; email?: string | null } | null;
  const user: AppUser | null = manusUser ? { id: String(manusUser.id ?? ""), name: manusUser.name ?? "Viajero", email: manusUser.email ?? null } : null;
  return { provider: "manus" as const, loading: manus.loading, isAuthenticated: manus.isAuthenticated, user, openLogin: () => startLogin(), signOut };
}
