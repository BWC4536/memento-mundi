import { describe, expect, it, vi } from "vitest";
import { CANVAS_IMAGE_ACCEPT, classifyImageFile, decodeWithHeicFallback, fitWithin, HEIC_UNSUPPORTED_MESSAGE, IMAGE_INPUT_ACCEPT, looksLikeHeic } from "./image-upload";

describe("fotos aceptadas", () => {
  it("acepta JPG, JPEG, PNG, WEBP, HEIC y HEIF", () => {
    expect(CANVAS_IMAGE_ACCEPT.split(",")).toEqual(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
    expect(IMAGE_INPUT_ACCEPT).toContain(".heic");
    expect(classifyImageFile({ name: "a.jpg", type: "image/jpeg" })).toEqual({ ok: true, kind: "standard" });
    expect(classifyImageFile({ name: "a.jpeg", type: "" })).toEqual({ ok: true, kind: "standard" });
    expect(classifyImageFile({ name: "a.png", type: "image/png" })).toEqual({ ok: true, kind: "standard" });
    expect(classifyImageFile({ name: "a.webp", type: "image/webp" })).toEqual({ ok: true, kind: "standard" });
    expect(classifyImageFile({ name: "IMG_0001.HEIC", type: "" })).toEqual({ ok: true, kind: "heic" });
    expect(classifyImageFile({ name: "foto.heif", type: "image/heif" })).toEqual({ ok: true, kind: "heic" });
  });

  it("rechaza otros formatos con un mensaje claro en español", () => {
    const result = classifyImageFile({ name: "video.mov", type: "video/quicktime" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("JPG, PNG, WEBP o HEIC");
    expect(HEIC_UNSUPPORTED_MESSAGE).toMatch(/HEIC/);
  });

  it("reduce las fotos grandes manteniendo la proporción", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1000, 4000, 1600)).toEqual({ width: 400, height: 1600 });
  });
});

const heicHeader = (brand: string) => new Uint8Array([0, 0, 0, 24, ...Array.from("ftyp" + brand, (char) => char.charCodeAt(0))]);

describe("conversión HEIC en el navegador", () => {
  it("reconoce HEIC/HEIF por los bytes aunque la extensión diga otra cosa", () => {
    expect(looksLikeHeic(heicHeader("heic"))).toBe(true);
    expect(looksLikeHeic(heicHeader("mif1"))).toBe(true);
    expect(looksLikeHeic(heicHeader("isom"))).toBe(false);
    expect(looksLikeHeic(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
  });

  it("usa la lectura nativa cuando el navegador entiende HEIC (Safari)", async () => {
    const convertHeic = vi.fn();
    const result = await decodeWithHeicFallback(new Blob(["x"]), "heic", { decode: async () => "nativo", convertHeic });
    expect(result).toEqual({ decoded: "nativo", converted: false });
    expect(convertHeic).not.toHaveBeenCalled();
  });

  it("convierte a JPEG cuando el navegador no puede leer el HEIC", async () => {
    const original = new Blob([heicHeader("heic")], { type: "image/heic" });
    const jpeg = new Blob(["jpeg"], { type: "image/jpeg" });
    const onConverting = vi.fn();
    const decode = vi.fn(async (blob: Blob) => {
      if (blob.type === "image/heic") throw new Error("formato no soportado");
      return "decodificado";
    });
    const result = await decodeWithHeicFallback(original, "heic", { decode, convertHeic: async () => jpeg, onConverting });
    expect(result).toEqual({ decoded: "decodificado", converted: true });
    expect(decode).toHaveBeenLastCalledWith(jpeg);
    expect(onConverting).toHaveBeenCalledOnce();
  });

  it("detecta un HEIC con extensión .jpg y también lo convierte", async () => {
    const disguised = new Blob([heicHeader("heix")], { type: "image/jpeg" });
    const result = await decodeWithHeicFallback(disguised, "standard", {
      decode: async (blob) => {
        if (blob === disguised) throw new Error("no");
        return "ok";
      },
      convertHeic: async () => new Blob(["jpeg"]),
    });
    expect(result.converted).toBe(true);
  });

  it("da un mensaje claro si la conversión falla y no oculta otros errores", async () => {
    await expect(
      decodeWithHeicFallback(new Blob([heicHeader("heic")]), "heic", {
        decode: async () => {
          throw new Error("no");
        },
        convertHeic: async () => {
          throw new Error("libheif");
        },
      }),
    ).rejects.toThrow(HEIC_UNSUPPORTED_MESSAGE);
    const broken = new Error("jpg roto");
    await expect(
      decodeWithHeicFallback(new Blob([new Uint8Array([0xff, 0xd8])]), "standard", {
        decode: async () => {
          throw broken;
        },
        convertHeic: async () => new Blob(),
      }),
    ).rejects.toBe(broken);
  });
});
