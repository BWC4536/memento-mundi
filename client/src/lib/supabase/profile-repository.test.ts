import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "../composition-storage";
import { createSupabaseClient, SupabaseError, type FetchLike } from "./client";
import { createCloudProfileRepository, createLocalProfileRepository, describeProfileError } from "./profile-repository";

const CONFIG = { url: "https://demo.supabase.co", publishableKey: "sb_publishable_test" };
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "viajera@example.com", name: "Viajera" };

type Call = { method: string; url: string; headers: Record<string, string>; body: unknown };

function fakeFetch(handler: (call: Call) => { status?: number; body?: unknown } | undefined) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    const raw = init.body;
    const body = typeof raw === "string" ? JSON.parse(raw) : raw;
    const call = { method: init.method ?? "GET", url: input.replace(CONFIG.url, ""), headers, body };
    calls.push(call);
    const result = handler(call) ?? {};
    return new Response(result.body === undefined ? "" : JSON.stringify(result.body), { status: result.status ?? 200 });
  };
  return { calls, fetchImpl };
}

const PROFILE_ROW = {
  id: USER.id,
  username: null,
  display_name: "Viajera",
  avatar_url: null,
  bio: null,
  instagram_handle: "insta",
  tiktok_handle: null,
  website_url: null,
  is_private: false,
  ugc_points: 3,
  created_at: "2026-01-01T00:00:00.000Z",
};

const repo = (fetchImpl: FetchLike) => createCloudProfileRepository({ client: createSupabaseClient(CONFIG, fetchImpl), getAccessToken: async () => "token", user: USER, now: () => 1700000000000 });

describe("perfil en Supabase", () => {
  it("carga perfil, ajustes, pegatinas y solicitudes", async () => {
    const { fetchImpl } = fakeFetch((call) => {
      if (call.url.startsWith("/rest/v1/profiles")) return { body: [PROFILE_ROW] };
      if (call.url.startsWith("/rest/v1/user_settings")) return { body: [{ marketing_opt_in: true, marketing_opt_in_at: "2026-02-01T00:00:00.000Z" }] };
      if (call.url.startsWith("/rest/v1/stickers")) return { body: [{ id: "s1", title: "Lisboa", image_url: null, scrapbook_id: "b1", unlocked_at: null, created_at: "2026-03-01", scrapbooks: { title: "Verano" } }] };
      if (call.url.startsWith("/rest/v1/ugc_claims")) return { body: [{ id: "c1", social_platform: "tiktok", proof_url: "https://tiktok.com/x", reward_claimed: "free_magnet", status: "approved", created_at: "2026-04-01" }] };
      return { body: [] };
    });
    const bundle = await repo(fetchImpl).load();
    expect(bundle.profile).toMatchObject({ displayName: "Viajera", instagram: "insta", ugcPoints: 3, bio: "" });
    expect(bundle.settings.marketingOptIn).toBe(true);
    expect(bundle.stickers[0]).toMatchObject({ scrapbookId: "b1", scrapbookTitle: "Verano" });
    expect(bundle.claims[0]).toMatchObject({ platform: "tiktok", status: "approved" });
    expect(bundle.features).toEqual({ privacy: true, settings: true });
  });

  it("funciona sin la migración 005: oculta privacidad y ajustes", async () => {
    const { calls, fetchImpl } = fakeFetch((call) => {
      if (call.url.includes("website_url")) return { status: 400, body: { code: "42703", message: "column profiles.website_url does not exist" } };
      if (call.url.startsWith("/rest/v1/profiles")) return { body: [PROFILE_ROW] };
      if (call.url.startsWith("/rest/v1/user_settings")) return { status: 404, body: { code: "PGRST205", message: "Could not find the table" } };
      return { body: [] };
    });
    const repository = repo(fetchImpl);
    const bundle = await repository.load();
    expect(bundle.features).toEqual({ privacy: false, settings: false });

    await repository.updateProfile({ bio: "Hola", website: "https://a.com", isPrivate: true }).catch(() => undefined);
    const patch = calls.find((call) => call.method === "PATCH");
    expect(patch?.body).toEqual({ bio: "Hola" });
  });

  it("guarda solo las columnas editables y explica un usuario repetido", async () => {
    const { calls, fetchImpl } = fakeFetch((call) => {
      if (call.method === "PATCH") return { status: 409, body: { code: "23505", message: 'duplicate key value violates unique constraint "profiles_username_key"' } };
      return { body: [PROFILE_ROW] };
    });
    const error = await repo(fetchImpl).updateProfile({ username: "tomado", displayName: "V" }).catch((err) => err);
    expect(calls[0]).toMatchObject({ method: "PATCH", url: expect.stringContaining(`/rest/v1/profiles?id=eq.${USER.id}`), body: { username: "tomado", display_name: "V" } });
    expect(describeProfileError(error)).toBe("Ese nombre de usuario ya está cogido.");
  });

  it("sube el avatar a su carpeta y borra el anterior", async () => {
    const previous = `${CONFIG.url}/storage/v1/object/public/avatars/${USER.id}/avatar-1.webp`;
    const { calls, fetchImpl } = fakeFetch((call) => (call.method === "PATCH" ? { body: [{ ...PROFILE_ROW, avatar_url: call.body && (call.body as { avatar_url: string }).avatar_url }] } : { body: {} }));
    const profile = await repo(fetchImpl).uploadAvatar(new Blob(["x"], { type: "image/webp" }), previous);
    expect(calls[0]).toMatchObject({ method: "POST", url: `/storage/v1/object/avatars/${USER.id}/avatar-1700000000000.webp` });
    expect(profile.avatarUrl).toBe(`${CONFIG.url}/storage/v1/object/public/avatars/${USER.id}/avatar-1700000000000.webp`);
    expect(calls[2]).toMatchObject({ method: "DELETE", url: "/storage/v1/object/avatars", body: { prefixes: [`${USER.id}/avatar-1.webp`] } });
  });

  it("envía solicitudes UGC solo con plataforma y enlace", async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({ body: [{ id: "c2", social_platform: "instagram", proof_url: "https://instagram.com/p/1", reward_claimed: "free_magnet", status: "pending", created_at: "2026-05-01" }] }));
    const claim = await repo(fetchImpl).submitClaim("instagram", "https://instagram.com/p/1");
    expect(calls[0].body).toEqual({ user_id: USER.id, social_platform: "instagram", proof_url: "https://instagram.com/p/1" });
    expect(claim.status).toBe("pending");
  });

  it("borra archivos y luego la cuenta", async () => {
    const { calls, fetchImpl } = fakeFetch((call) => {
      if (call.url === "/storage/v1/object/list/avatars") return { body: [{ name: "avatar-1.webp" }] };
      if (call.url.startsWith("/rest/v1/scrapbook_assets")) return { body: [{ storage_path: "b1/u/a.jpg" }] };
      return { body: null };
    });
    await repo(fetchImpl).deleteAccount();
    expect(calls.map((call) => `${call.method} ${call.url.split("?")[0]}`)).toEqual([
      "POST /storage/v1/object/list/avatars",
      "DELETE /storage/v1/object/avatars",
      "GET /rest/v1/scrapbook_assets",
      "DELETE /storage/v1/object/scrapbook-media",
      "POST /rest/v1/rpc/delete_my_account",
    ]);
  });

  it("explica si el borrado aún no está activado en el servidor", async () => {
    const { fetchImpl } = fakeFetch((call) => (call.url.includes("rpc") ? { status: 404, body: { code: "PGRST202", message: "Could not find the function" } } : { body: [] }));
    const error = await repo(fetchImpl).deleteAccount().catch((err) => err);
    expect(error).toBeInstanceOf(SupabaseError);
    expect(error.code).toBe("rpc_missing");
  });
});

describe("perfil local", () => {
  it("guarda el perfil y evita solicitudes repetidas", async () => {
    const storage = createMemoryStorage();
    const repository = createLocalProfileRepository(USER, storage, () => 1);
    await repository.updateProfile({ bio: "Hola" });
    expect((await createLocalProfileRepository(USER, storage).load()).profile.bio).toBe("Hola");
    await repository.submitClaim("instagram", "https://instagram.com/p/1");
    await expect(repository.submitClaim("instagram", "https://instagram.com/p/1")).rejects.toThrow("Ya enviaste");
  });
});
