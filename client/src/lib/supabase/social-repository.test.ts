import { describe, expect, it } from "vitest";
import { createSupabaseClient, type FetchLike } from "./client";
import { buildSocialMediaPath, createSocialRepository, SocialSetupError } from "./social-repository";

const CONFIG = { url: "https://demo.supabase.co", publishableKey: "sb_publishable_test" };
const USER_ID = "11111111-1111-4111-8111-111111111111";
const POST_ID = "22222222-2222-4222-8222-222222222222";

type Call = { method: string; url: string; headers: Record<string, string>; body: unknown };

function fakeFetch(handler: (call: Call) => { status?: number; body?: unknown } | undefined) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    const raw = init.body;
    const call = { method: init.method ?? "GET", url: input.replace(CONFIG.url, ""), headers, body: typeof raw === "string" ? JSON.parse(raw) : raw };
    calls.push(call);
    const result = handler(call) ?? {};
    return new Response(result.body === undefined ? "" : JSON.stringify(result.body), { status: result.status ?? 200 });
  };
  return { calls, fetchImpl };
}

const repo = (fetchImpl: FetchLike) =>
  createSocialRepository({ client: createSupabaseClient(CONFIG, fetchImpl), getAccessToken: async () => "token-1", getUserId: () => USER_ID, createId: () => POST_ID });

describe("repositorio de la red social", () => {
  it("pide el feed por RPC con alcance, lugar y cursor", async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({ body: [] }));
    await repo(fetchImpl).feed({ scope: "following", placeId: "pl-1" }, "2026-11-25T10:00:00Z", 12);
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "/rest/v1/rpc/social_feed",
      body: { p_scope: "following", p_place: "pl-1", p_author: null, p_before: "2026-11-25T10:00:00Z", p_limit: 12 },
    });
    expect(calls[0].headers.Authorization).toBe("Bearer token-1");
  });

  it("like y seguir son idempotentes; quitar usa DELETE con filtros", async () => {
    const { calls, fetchImpl } = fakeFetch(() => undefined);
    const repository = repo(fetchImpl);
    await repository.setLiked("p1", true);
    await repository.setFollowing("u2", false);
    expect(calls[0]).toMatchObject({ method: "POST", url: "/rest/v1/social_likes?on_conflict=post_id,user_id", body: { post_id: "p1", user_id: USER_ID } });
    expect(calls[0].headers.Prefer).toContain("ignore-duplicates");
    expect(calls[1]).toMatchObject({ method: "DELETE", url: `/rest/v1/social_follows?follower_id=eq.${USER_ID}&followee_id=eq.u2` });
  });

  it("publica: crea el post, sube cada archivo a su carpeta y registra los medios", async () => {
    const { calls, fetchImpl } = fakeFetch((call) => (call.url === "/rest/v1/rpc/social_feed" ? { body: [{ id: POST_ID }] } : undefined));
    const progress: number[] = [];
    const created = await repo(fetchImpl).createPost(
      {
        caption: "  Hola Panamá  ",
        placeId: "pl-panama",
        media: [
          { kind: "photo", blob: new Blob(["a"], { type: "image/webp" }), mimeType: "image/webp", width: 1080, height: 1350, duration: null },
          { kind: "video", blob: new Blob(["b"], { type: "video/mp4" }), mimeType: "video/mp4", width: 720, height: 1280, duration: 9.5 },
        ],
      },
      (done) => progress.push(done),
    );
    expect(created).toMatchObject({ id: POST_ID });
    expect(calls[0]).toMatchObject({ url: "/rest/v1/social_posts", body: { id: POST_ID, author_id: USER_ID, place_id: "pl-panama", caption: "Hola Panamá" } });
    expect(calls[1].url).toBe(`/storage/v1/object/social-media/${USER_ID}/${POST_ID}/0.webp`);
    expect(calls[2].url).toBe(`/storage/v1/object/social-media/${USER_ID}/${POST_ID}/1.mp4`);
    expect(calls[3]).toMatchObject({ url: "/rest/v1/social_post_media" });
    expect((calls[3].body as Array<Record<string, unknown>>)[1]).toMatchObject({
      kind: "video",
      position: 1,
      duration_seconds: 9.5,
      url: `https://demo.supabase.co/storage/v1/object/public/social-media/${USER_ID}/${POST_ID}/1.mp4`,
    });
    expect(progress).toEqual([1, 2]);
  });

  it("si falla una subida, deshace el post y borra lo ya subido", async () => {
    const { calls, fetchImpl } = fakeFetch((call) => (call.url.endsWith("/1.mp4") ? { status: 413, body: { message: "Payload too large" } } : undefined));
    const media = [
      { kind: "photo" as const, blob: new Blob(["a"]), mimeType: "image/jpeg", width: 1, height: 1, duration: null },
      { kind: "video" as const, blob: new Blob(["b"]), mimeType: "video/mp4", width: 1, height: 1, duration: 1 },
    ];
    await expect(repo(fetchImpl).createPost({ caption: "", placeId: null, media })).rejects.toThrow("Payload too large");
    expect(calls.some((call) => call.method === "DELETE" && call.url === `/rest/v1/social_posts?id=eq.${POST_ID}`)).toBe(true);
    expect(calls.find((call) => call.method === "DELETE" && call.url === "/storage/v1/object/social-media")?.body).toEqual({ prefixes: [`${USER_ID}/${POST_ID}/0.jpg`] });
  });

  it("avisa de que falta la migración si la función no existe", async () => {
    const { fetchImpl } = fakeFetch(() => ({ status: 404, body: { code: "PGRST202", message: "Could not find the function" } }));
    await expect(repo(fetchImpl).places()).rejects.toBeInstanceOf(SocialSetupError);
  });

  it("rutas de Storage por usuario y post con la extensión correcta", () => {
    expect(buildSocialMediaPath("u", "p", 2, "video/quicktime")).toBe("u/p/2.mov");
    expect(buildSocialMediaPath("u", "p", 0, "image/jpeg")).toBe("u/p/0.jpg");
  });
});
