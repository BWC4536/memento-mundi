import { describe, expect, it } from "vitest";
import { addElement, createEmptyComposition, createPhotoElement, createTextElement, isUuid, setPhotoFilter } from "../composition";
import { createMemoryStorage } from "../composition-storage";
import { createAuthStore, parseSessionFromHash, SESSION_STORAGE_KEY, sessionFromResponse } from "./auth";
import { createSupabaseClient, type FetchLike } from "./client";
import { createScrapbookRepository, EMPTY_COVER, toStorageRef } from "./scrapbook-repository";

const CONFIG = { url: "https://demo.supabase.co", publishableKey: "sb_publishable_test" };
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "viajera@example.com", user_metadata: { name: "Viajera" } };

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

const authBody = (expiresIn = 3600) => ({ access_token: "access-1", refresh_token: "refresh-1", expires_in: expiresIn, user: USER });

describe("Supabase Auth por email", () => {
  it("envía el código y crea la sesión al verificarlo", async () => {
    const { calls, fetchImpl } = fakeFetch((call) => (call.url.startsWith("/auth/v1/verify") ? { body: authBody() } : { body: {} }));
    const storage = createMemoryStorage();
    const store = createAuthStore(createSupabaseClient(CONFIG, fetchImpl), storage);

    await store.requestEmailCode(" Viajera@Example.com ", "https://app.test/");
    expect(calls[0]).toMatchObject({ method: "POST", url: "/auth/v1/otp?redirect_to=https%3A%2F%2Fapp.test%2F", body: { email: "viajera@example.com", create_user: true } });
    expect(calls[0].headers.apikey).toBe(CONFIG.publishableKey);

    const session = await store.verifyEmailCode("viajera@example.com", "123 456");
    expect(calls[1].body).toEqual({ type: "email", email: "viajera@example.com", token: "123456" });
    expect(session.user).toEqual({ id: USER.id, email: USER.email, name: "Viajera" });
    expect(JSON.parse(storage.data.get(SESSION_STORAGE_KEY)!).accessToken).toBe("access-1");
  });

  it("lee la sesión del enlace mágico o su error", () => {
    expect(parseSessionFromHash("#access_token=a&refresh_token=r&expires_in=60&type=magiclink")).toEqual({ tokens: { accessToken: "a", refreshToken: "r", expiresIn: 60 } });
    expect(parseSessionFromHash("#error=access_denied&error_description=Email+link+is+invalid+or+has+expired")).toEqual({ error: "Email link is invalid or has expired" });
    expect(parseSessionFromHash("")).toBeNull();
  });

  it("renueva el token antes de que caduque y cierra sesión si el servidor lo rechaza", async () => {
    let refreshStatus = 200;
    const { calls, fetchImpl } = fakeFetch((call) => (call.url.startsWith("/auth/v1/token") ? { status: refreshStatus, body: refreshStatus === 200 ? { ...authBody(), access_token: "access-2" } : { error: "invalid_grant" } } : undefined));
    const storage = createMemoryStorage({ [SESSION_STORAGE_KEY]: JSON.stringify(sessionFromResponse(authBody(30))) });
    const store = createAuthStore(createSupabaseClient(CONFIG, fetchImpl), storage);

    expect(await store.getAccessToken()).toBe("access-2");
    expect(calls[0]).toMatchObject({ url: "/auth/v1/token?grant_type=refresh_token", body: { refresh_token: "refresh-1" } });

    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionFromResponse(authBody(30))));
    refreshStatus = 400;
    const expiring = createAuthStore(createSupabaseClient(CONFIG, fetchImpl), storage);
    expect(await expiring.getAccessToken()).toBeNull();
    expect(storage.data.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it("sin conexión mantiene la sesión", async () => {
    const storage = createMemoryStorage({ [SESSION_STORAGE_KEY]: JSON.stringify(sessionFromResponse(authBody(30))) });
    const offline: FetchLike = async () => {
      throw new TypeError("Failed to fetch");
    };
    const store = createAuthStore(createSupabaseClient(CONFIG, offline), storage);
    expect(await store.getAccessToken()).toBe("access-1");
    expect(store.getSession()).not.toBeNull();
  });
});

const repoDeps = (fetchImpl: FetchLike) => ({
  client: createSupabaseClient(CONFIG, fetchImpl),
  getAccessToken: async () => "token-1",
  getUserId: () => USER.id,
  toBlob: async () => new Blob(["imagen"], { type: "image/webp" }),
});

describe("repositorio de scrapbooks en Supabase", () => {
  it("lista los scrapbooks con portada firmada y contadores", async () => {
    const { calls, fetchImpl } = fakeFetch((call) => {
      if (call.url.startsWith("/rest/v1/scrapbooks")) {
        return {
          body: [
            { id: "sb-1", owner_id: USER.id, title: "Lisboa", description: null, cover_image_url: toStorageRef("sb-1/u/a.webp"), cover_url: null, location_name: null, city: "Lisboa", country: "Portugal", latitude: null, longitude: null, is_public: false, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-02T00:00:00Z", scrapbook_members: [{ count: 2 }], scrapbook_assets: [{ count: 5 }] },
            { id: "sb-2", owner_id: USER.id, title: "Nuevo", description: null, cover_image_url: null, cover_url: null, location_name: null, city: null, country: null, latitude: null, longitude: null, is_public: false, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" },
          ],
        };
      }
      if (call.url.startsWith("/storage/v1/object/sign/")) return { body: [{ path: "sb-1/u/a.webp", signedURL: "/object/sign/scrapbook-media/sb-1/u/a.webp?token=x", error: null }] };
      return undefined;
    });
    const books = await createScrapbookRepository(repoDeps(fetchImpl)).listScrapbooks();
    expect(calls[0].headers.Authorization).toBe("Bearer token-1");
    expect(books[0]).toMatchObject({ id: "sb-1", location: "Lisboa, Portugal", photos: 5, invited: 2, source: "cloud", cover: "https://demo.supabase.co/storage/v1/object/sign/scrapbook-media/sb-1/u/a.webp?token=x" });
    expect(books[1]).toMatchObject({ location: "Sin ubicación", cover: EMPTY_COVER, photos: 0 });
  });

  it("guarda: sube las fotos a Storage, guarda solo referencias y borra los elementos eliminados", async () => {
    let composition = createEmptyComposition(new Date("2026-11-18T10:00:00Z"));
    const photo = createPhotoElement(composition, { src: "data:image/webp;base64,AAAA", naturalWidth: 1200, naturalHeight: 800, asset: { width: 1200, height: 800, inline: true } });
    composition = setPhotoFilter(addElement(composition, photo), photo.id, "noir");
    const text = createTextElement(composition, { content: "hola" });
    composition = addElement(composition, text);
    const legacy = { ...createTextElement(composition, { content: "viejo" }), id: "algarve-2026-title" };
    composition = addElement(composition, legacy);

    const { calls, fetchImpl } = fakeFetch((call) => {
      if (call.method === "GET" && call.url.startsWith("/rest/v1/scrapbook_pages")) return { body: [] };
      if (call.url.startsWith("/storage/v1/object/sign/")) return { body: (call.body as { paths: string[] }).paths.map((path) => ({ path, signedURL: `/object/sign/scrapbook-media/${path}?token=t`, error: null })) };
      return { body: null };
    });
    const saved = await createScrapbookRepository(repoDeps(fetchImpl)).saveComposition("sb-1", composition);

    const upload = calls.find((call) => call.url.startsWith("/storage/v1/object/scrapbook-media/"))!;
    expect(upload.method).toBe("POST");
    expect(upload.url).toMatch(new RegExp(`^/storage/v1/object/scrapbook-media/sb-1/${USER.id}/[0-9a-f-]{36}\\.webp$`));
    expect(upload.body).toBeInstanceOf(Blob);
    const storagePath = upload.url.replace("/storage/v1/object/scrapbook-media/", "");

    const asset = calls.find((call) => call.url === "/rest/v1/scrapbook_assets")!;
    expect(asset.body).toMatchObject({ scrapbook_id: "sb-1", uploaded_by: USER.id, storage_path: storagePath, mime_type: "image/webp", width: 1200, height: 800 });

    const page = calls.find((call) => call.url === "/rest/v1/scrapbook_pages?on_conflict=id")!;
    expect(page.headers.Prefer).toContain("merge-duplicates");
    const elements = calls.find((call) => call.url === "/rest/v1/scrapbook_elements?on_conflict=id")!.body as Array<Record<string, unknown>>;
    expect(elements).toHaveLength(3);
    expect(JSON.stringify(elements)).not.toContain("data:image");
    expect(elements.find((row) => row.element_type === "photo")).toMatchObject({ src: toStorageRef(storagePath), filter_name: "noir", created_by: USER.id });
    expect(elements.find((row) => row.content === "hola")).toBeTruthy();
    expect(elements.every((row) => isUuid(String(row.id)))).toBe(true);

    const cleanup = calls.find((call) => call.method === "DELETE")!;
    expect(cleanup.url).toContain(`page_id=eq.${saved.pageId}`);
    expect(cleanup.url).toContain(`id=not.in.(${elements.map((row) => row.id).join(",")})`);

    const cover = calls.find((call) => call.method === "PATCH")!;
    expect(cover.body).toMatchObject({ cover_image_url: toStorageRef(storagePath) });

    const savedPhoto = saved.elements.find((element) => element.type === "photo")!;
    expect(savedPhoto.src).toBe(`https://demo.supabase.co/storage/v1/object/sign/scrapbook-media/${storagePath}?token=t`);
    expect(savedPhoto.asset).toMatchObject({ storagePath, inline: false });
    expect(isUuid(saved.pageId!)).toBe(true);
  });

  it("carga la composición con las fotos firmadas", async () => {
    const page = { id: "22222222-2222-4222-8222-222222222222", scrapbook_id: "sb-1", name: "Página 1", width: 1200, height: 900, background: "#D8E2DC", background_json: { texture: "lines", frame: "stamp" }, sort_order: 0, updated_at: "2026-11-18T10:00:00Z" };
    const element = {
      id: "33333333-3333-4333-8333-333333333333", page_id: page.id, scrapbook_id: "sb-1", created_by: USER.id, element_type: "photo", x: 10, y: 20, width: 400, height: 300, rotation: 3, scale: 1.2, z_index: 1,
      content: null, src: toStorageRef("sb-1/u/f.webp"), frame_id: "polaroid", filter_name: "noir", locked: false, visible: true,
      style_json: { crop: { fit: "cover", zoom: 1, offsetX: 0, offsetY: 0 } }, metadata_json: { asset: { storagePath: "sb-1/u/f.webp", width: 1200, height: 900 } }, updated_at: "2026-11-18T10:00:00Z",
    };
    const { fetchImpl } = fakeFetch((call) => {
      if (call.url.startsWith("/rest/v1/scrapbook_pages")) return { body: [page] };
      if (call.url.startsWith("/rest/v1/scrapbook_elements")) return { body: [element] };
      if (call.url.startsWith("/storage/v1/object/sign/")) return { body: [{ path: "sb-1/u/f.webp", signedURL: "/object/sign/scrapbook-media/sb-1/u/f.webp?token=z", error: null }] };
      return undefined;
    });
    const loaded = (await createScrapbookRepository(repoDeps(fetchImpl)).loadComposition("sb-1"))!;
    expect(loaded.pageId).toBe(page.id);
    expect(loaded.canvas).toMatchObject({ background: "#D8E2DC", texture: "lines", frame: "stamp" });
    expect(loaded.elements[0]).toMatchObject({ type: "photo", filter: "noir", frameId: "polaroid", rotation: 3, scale: 1.2, src: "https://demo.supabase.co/storage/v1/object/sign/scrapbook-media/sb-1/u/f.webp?token=z" });
  });

  it("devuelve null si el scrapbook todavía no tiene página", async () => {
    const { fetchImpl } = fakeFetch(() => ({ body: [] }));
    expect(await createScrapbookRepository(repoDeps(fetchImpl)).loadComposition("sb-9")).toBeNull();
  });
});
