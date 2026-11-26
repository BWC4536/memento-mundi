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

  it("pagina con cursor compuesto y pide la pestaña propia filtrada por privacidad", async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({ body: [] }));
    await repo(fetchImpl).feed({ scope: "mine", visibility: "private" }, { created_at: "2026-11-25T10:00:00Z", id: POST_ID }, 8);
    expect(calls[0].body).toEqual({ p_scope: "mine", p_place: null, p_author: null, p_before: "2026-11-25T10:00:00Z", p_before_id: POST_ID, p_limit: 8, p_visibility: "private" });
  });

  it("publica en privado: sube al bucket privado y no guarda URL pública", async () => {
    const { calls, fetchImpl } = fakeFetch((call) => (call.url === "/rest/v1/rpc/social_feed" ? { body: [] } : undefined));
    await repo(fetchImpl).createPost({ caption: "", placeId: null, visibility: "private", media: [{ kind: "photo", blob: new Blob(["a"]), mimeType: "image/jpeg", width: 1, height: 1, duration: null }] });
    expect(calls[0].body).toMatchObject({ visibility: "private" });
    expect(calls[1].url).toBe(`/storage/v1/object/social-private/${USER_ID}/${POST_ID}/0.jpg`);
    expect((calls[2].body as Array<Record<string, unknown>>)[0]).toMatchObject({ bucket: "social-private", url: null, storage_path: `${USER_ID}/${POST_ID}/0.jpg` });
  });

  it("firma en bloque los medios privados del feed y deja los públicos como están", async () => {
    const privatePath = `${USER_ID}/${POST_ID}/0.jpg`;
    const { calls, fetchImpl } = fakeFetch((call) => {
      if (call.url === "/rest/v1/rpc/social_feed")
        return {
          body: [
            { id: POST_ID, media: [{ id: "m1", kind: "photo", url: null, bucket: "social-private", path: privatePath }] },
            { id: "p2", media: [{ id: "m2", kind: "photo", url: "https://cdn/x.jpg", bucket: "social-media", path: null }] },
          ],
        };
      if (call.url === "/storage/v1/object/sign/social-private") return { body: [{ path: privatePath, signedURL: `/object/sign/social-private/${privatePath}?token=t`, error: null }] };
      return undefined;
    });
    const posts = await repo(fetchImpl).feed({ scope: "mine" });
    expect(calls[1].body).toMatchObject({ paths: [privatePath] });
    expect(posts[0]!.media[0]!.url).toBe(`https://demo.supabase.co/storage/v1/object/sign/social-private/${privatePath}?token=t`);
    expect(posts[1]!.media[0]!.url).toBe("https://cdn/x.jpg");
  });

  it("al hacer privada mueve los archivos al bucket privado y luego actualiza en SQL", async () => {
    const path = `${USER_ID}/${POST_ID}/0.jpg`;
    const { calls, fetchImpl } = fakeFetch((call) => (call.url.startsWith("/rest/v1/social_post_media") ? { body: [{ storage_path: path, bucket: "social-media" }] } : call.url === "/rest/v1/rpc/social_feed" ? { body: [] } : undefined));
    await repo(fetchImpl).setVisibility(POST_ID, "private");
    expect(calls[1]).toMatchObject({ url: "/storage/v1/object/move", body: { bucketId: "social-media", sourceKey: path, destinationKey: path, destinationBucket: "social-private" } });
    expect(calls[2]).toMatchObject({ url: "/rest/v1/rpc/social_set_visibility", body: { p_post: POST_ID, p_visibility: "private", p_public_base: "https://demo.supabase.co/storage/v1/object/public/social-media" } });
  });

  it("si falla la actualización SQL, devuelve los archivos a su bucket", async () => {
    const path = `${USER_ID}/${POST_ID}/0.jpg`;
    const { calls, fetchImpl } = fakeFetch((call) =>
      call.url.startsWith("/rest/v1/social_post_media") ? { body: [{ storage_path: path, bucket: "social-private" }] } : call.url === "/rest/v1/rpc/social_set_visibility" ? { status: 400, body: { message: "boom" } } : undefined,
    );
    await expect(repo(fetchImpl).setVisibility(POST_ID, "public")).rejects.toThrow("boom");
    expect(calls.at(-1)).toMatchObject({ url: "/storage/v1/object/move", body: { bucketId: "social-media", destinationBucket: "social-private" } });
  });

  it("al borrar, quita los archivos de cada bucket", async () => {
    const { calls, fetchImpl } = fakeFetch((call) => (call.url.startsWith("/rest/v1/social_post_media") ? { body: [{ storage_path: "a", bucket: "social-private" }, { storage_path: "b", bucket: "social-media" }] } : undefined));
    await repo(fetchImpl).deletePost(POST_ID);
    expect(calls.filter((call) => call.method === "DELETE" && call.url.startsWith("/storage")).map((call) => [call.url, call.body])).toEqual([
      ["/storage/v1/object/social-media", { prefixes: ["b"] }],
      ["/storage/v1/object/social-private", { prefixes: ["a"] }],
    ]);
  });

  it("busca amigos sin la @ inicial y no llama al servidor con el texto vacío", async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({ body: [{ id: "u2" }] }));
    const repository = repo(fetchImpl);
    expect(await repository.searchUsers("   ")).toEqual([]);
    expect(calls).toHaveLength(0);
    const found = await repository.searchUsers("  @lucia.viaja ", 30);
    expect(found).toEqual([{ id: "u2" }]);
    expect(calls[0]).toMatchObject({ method: "POST", url: "/rest/v1/rpc/social_search_users", body: { p_query: "lucia.viaja", p_limit: 30 } });
  });

  it("pide mis conexiones por tipo", async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({ body: [] }));
    await repo(fetchImpl).connections("followers");
    expect(calls[0]).toMatchObject({ url: "/rest/v1/rpc/social_connections", body: { p_kind: "followers", p_limit: 100 } });
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
