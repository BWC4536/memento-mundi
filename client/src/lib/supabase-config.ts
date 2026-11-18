/**
 * Configuración de Supabase leída de variables de entorno de Vite
 * (.env.local en desarrollo; variables del proyecto en Vercel en producción).
 * Solo se usa la clave publicable: la secret key nunca debe llegar al navegador.
 */
export type SupabaseConfig = { url: string; publishableKey: string };

export function readSupabaseConfig(env: Record<string, string | undefined> = import.meta.env): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim().replace(/\/(rest\/v1\/?)?$/, "");
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) return null;
  return { url, publishableKey };
}

export const supabaseConfig = readSupabaseConfig();
export const isSupabaseConfigured = supabaseConfig !== null;
