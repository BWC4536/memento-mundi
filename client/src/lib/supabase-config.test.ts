import { describe, expect, it } from "vitest";
import { readSupabaseConfig } from "./supabase-config";

describe("configuración de Supabase", () => {
  it("acepta la URL del proyecto con o sin /rest/v1/", () => {
    const key = "sb_publishable_test";
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: "https://abc123.supabase.co/rest/v1/", VITE_SUPABASE_PUBLISHABLE_KEY: key })).toEqual({ url: "https://abc123.supabase.co", publishableKey: key });
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: "https://abc123.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: key })?.url).toBe("https://abc123.supabase.co");
  });

  it("queda desactivada si faltan datos o la URL no es de Supabase", () => {
    expect(readSupabaseConfig({})).toBeNull();
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: "https://evil.example.com", VITE_SUPABASE_PUBLISHABLE_KEY: "x" })).toBeNull();
  });
});
