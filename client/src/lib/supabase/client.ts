/**
 * Cliente REST mínimo de Supabase (Auth, PostgREST y Storage) sin dependencias.
 *
 * Usamos fetch directamente en lugar de @supabase/supabase-js para no añadir
 * paquetes (el proyecto vive en un disco exFAT donde pnpm no puede enlazarlos)
 * y para mantener el bundle pequeño. Solo usa la clave publicable: los permisos
 * reales los imponen las políticas RLS con el token del usuario.
 */
import type { SupabaseConfig } from "../supabase-config";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class SupabaseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

export type RequestOptions = {
  method?: string;
  body?: unknown;
  rawBody?: BodyInit;
  headers?: Record<string, string>;
  accessToken?: string | null;
};

export function createSupabaseClient(config: SupabaseConfig, fetchImpl: FetchLike = (input, init) => fetch(input, init)) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { apikey: config.publishableKey, ...options.headers };
    if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
    let body: BodyInit | undefined = options.rawBody;
    if (options.body !== undefined) {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      body = JSON.stringify(options.body);
    }
    let response: Response;
    try {
      response = await fetchImpl(`${config.url}${path}`, { method: options.method ?? "GET", headers, body });
    } catch {
      throw new SupabaseError("No hay conexión con el servidor. Revisa tu conexión a internet.", 0, "network");
    }
    const text = await response.text();
    const data = text ? safeJson(text) : null;
    if (!response.ok) {
      const record = (data ?? {}) as Record<string, unknown>;
      const message = String(record.msg ?? record.message ?? record.error_description ?? record.error ?? `Error ${response.status}`);
      throw new SupabaseError(message, response.status, typeof record.code === "string" ? record.code : typeof record.error_code === "string" ? record.error_code : undefined);
    }
    return data as T;
  }

  return { config, request };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
