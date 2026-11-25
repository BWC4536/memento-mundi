/**
 * Supabase Auth por email (código de 6 dígitos o enlace mágico).
 *
 * - requestEmailCode envía el email. Si la plantilla del email incluye {{ .Token }},
 *   el usuario escribe el código; si solo trae el enlace, al abrirlo vuelve a la app
 *   con la sesión en el fragmento de la URL (#access_token=...), que leemos aquí.
 * - La sesión se guarda en localStorage y se renueva sola antes de caducar.
 */
import { useEffect, useSyncExternalStore } from "react";
import { supabaseConfig } from "../supabase-config";
import { createSupabaseClient, SupabaseError, type SupabaseClient } from "./client";

export type SupabaseUser = { id: string; email: string | null; name: string | null };
export type SupabaseSession = { accessToken: string; refreshToken: string; expiresAt: number; user: SupabaseUser };

export const SESSION_STORAGE_KEY = "memento-mundi:supabase-session";

type AuthResponse = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> };
};

export function sessionFromResponse(data: AuthResponse, now = Date.now()): SupabaseSession {
  const expiresAt = data.expires_at ? data.expires_at * 1000 : now + (data.expires_in ?? 3600) * 1000;
  const metadata = data.user.user_metadata ?? {};
  const name = typeof metadata.name === "string" ? metadata.name : typeof metadata.full_name === "string" ? metadata.full_name : null;
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt, user: { id: data.user.id, email: data.user.email ?? null, name } };
}

/** Lee la sesión que Supabase deja en el fragmento de la URL al abrir el enlace mágico. */
export function parseSessionFromHash(hash: string): { tokens: { accessToken: string; refreshToken: string; expiresIn: number } } | { error: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const error = params.get("error_description") ?? params.get("error");
  if (error) return { error: error.replace(/\+/g, " ") };
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { tokens: { accessToken, refreshToken, expiresIn: Number(params.get("expires_in") ?? 3600) } };
}

export function friendlyAuthError(error: unknown) {
  if (!(error instanceof SupabaseError)) return "No se pudo completar el inicio de sesión.";
  if (error.status === 0) return error.message;
  if (error.status === 429 || /rate limit|security purposes/i.test(error.message)) return "Has pedido demasiados códigos seguidos. Espera un minuto y vuelve a intentarlo.";
  if (/expired|invalid/i.test(error.message) || error.code === "otp_expired") return "El código no es válido o ha caducado. Pide uno nuevo.";
  if (/email/i.test(error.message) && error.status === 400) return "Revisa el email: no parece válido.";
  return error.message;
}

/* ------------------------------------------------------------------ */
/* Almacén de sesión                                                   */
/* ------------------------------------------------------------------ */

type Listener = () => void;

export function createAuthStore(client: SupabaseClient, storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null) {
  let session: SupabaseSession | null = null;
  let ready = false;
  const listeners = new Set<Listener>();
  let refreshing: Promise<SupabaseSession | null> | null = null;

  const emit = () => listeners.forEach((listener) => listener());

  const persist = (next: SupabaseSession | null) => {
    session = next;
    try {
      if (next) storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
      else storage?.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* sin almacenamiento: la sesión vive en memoria */
    }
    emit();
  };

  const readStored = (): SupabaseSession | null => {
    try {
      const raw = storage?.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SupabaseSession;
      return parsed?.accessToken && parsed?.refreshToken && parsed?.user?.id ? parsed : null;
    } catch {
      return null;
    }
  };

  session = readStored();

  /** Otra pestaña (o la app reabierta) pudo renovar o cerrar la sesión: adoptamos lo que hay guardado. */
  function syncFromStorage() {
    const stored = readStored();
    if (stored?.refreshToken === session?.refreshToken && stored?.accessToken === session?.accessToken) return;
    session = stored;
    emit();
  }

  async function requestEmailCode(email: string, redirectTo?: string) {
    const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "";
    await client.request(`/auth/v1/otp${query}`, { method: "POST", body: { email: email.trim().toLowerCase(), create_user: true } });
  }

  async function verifyEmailCode(email: string, code: string) {
    const data = await client.request<AuthResponse>("/auth/v1/verify", { method: "POST", body: { type: "email", email: email.trim().toLowerCase(), token: code.replace(/\s/g, "") } });
    persist(sessionFromResponse(data));
    return session!;
  }

  async function completeFromHash(tokens: { accessToken: string; refreshToken: string; expiresIn: number }) {
    const user = await client.request<AuthResponse["user"]>("/auth/v1/user", { accessToken: tokens.accessToken });
    persist(sessionFromResponse({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken, expires_in: tokens.expiresIn, user }));
    return session!;
  }

  async function refresh(): Promise<SupabaseSession | null> {
    const current = session;
    if (!current) return null;
    if (!refreshing) {
      refreshing = client
        .request<AuthResponse>("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: current.refreshToken } })
        .then((data) => {
          persist(sessionFromResponse(data));
          return session;
        })
        .catch((error) => {
          // Solo cerramos sesión si el servidor rechaza el token; sin red la mantenemos.
          if (error instanceof SupabaseError && error.status >= 400 && error.status < 500) {
            // Si otra pestaña ya renovó el token (rotación), usamos su sesión en vez de cerrarla.
            const stored = readStored();
            if (stored && stored.refreshToken !== current.refreshToken) {
              session = stored;
              emit();
            } else persist(null);
          }
          return session;
        })
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  }

  /** Token válido para las peticiones; renueva la sesión si caduca en menos de un minuto. */
  async function getAccessToken(now = Date.now()) {
    if (!session) return null;
    if (session.expiresAt - now < 60_000) await refresh();
    return session?.accessToken ?? null;
  }

  /** "local": solo este dispositivo. "global": revoca la sesión en todos los dispositivos. */
  async function signOut(scope: "local" | "global" = "local") {
    const token = scope === "global" ? await getAccessToken() : session?.accessToken;
    persist(null);
    if (token) await client.request(`/auth/v1/logout?scope=${scope}`, { method: "POST", accessToken: token }).catch(() => undefined);
  }

  return {
    getSession: () => session,
    syncFromStorage,
    isReady: () => ready,
    markReady: () => {
      ready = true;
      emit();
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    requestEmailCode,
    verifyEmailCode,
    completeFromHash,
    refresh,
    getAccessToken,
    signOut,
  };
}

export type AuthStore = ReturnType<typeof createAuthStore>;

const browserStorage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

export const supabaseClient = supabaseConfig ? createSupabaseClient(supabaseConfig) : null;
export const authStore = supabaseClient ? createAuthStore(supabaseClient, browserStorage()) : null;

if (authStore && typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_STORAGE_KEY || event.key === null) authStore.syncFromStorage();
  });
  // Pide al navegador que no borre la sesión al liberar espacio (clave en móvil).
  void navigator.storage?.persist?.().catch(() => undefined);
  // Al volver a la app (móvil: suspendida en segundo plano) renovamos si el token ha caducado.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && authStore.getSession()) void authStore.getAccessToken();
  });
}

let initialised = false;
let hashError: string | null = null;

/** Procesa el enlace mágico (si lo hay) y deja la sesión lista. Se llama una vez al arrancar. */
async function initialiseAuth() {
  if (!authStore || initialised || typeof window === "undefined") return;
  initialised = true;
  const parsed = parseSessionFromHash(window.location.hash);
  if (parsed) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if ("error" in parsed) hashError = parsed.error;
    else await authStore.completeFromHash(parsed.tokens).catch((error) => (hashError = friendlyAuthError(error)));
  } else if (authStore.getSession()) {
    await authStore.getAccessToken();
  }
  authStore.markReady();
}

export function consumeAuthLinkError() {
  const error = hashError;
  hashError = null;
  return error;
}

const noop = () => () => {};

export function useSupabaseSession() {
  useEffect(() => {
    void initialiseAuth();
  }, []);
  const session = useSyncExternalStore(authStore?.subscribe ?? noop, () => authStore?.getSession() ?? null, () => null);
  const ready = useSyncExternalStore(authStore?.subscribe ?? noop, () => authStore?.isReady() ?? true, () => false);
  return { session, ready };
}
