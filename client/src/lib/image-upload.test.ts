import { describe, expect, it } from "vitest";
import { CANVAS_IMAGE_ACCEPT, classifyImageFile, fitWithin, HEIC_UNSUPPORTED_MESSAGE, IMAGE_INPUT_ACCEPT } from "./image-upload";

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
