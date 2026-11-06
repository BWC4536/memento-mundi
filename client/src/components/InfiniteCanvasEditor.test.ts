import { describe, expect, it } from "vitest";
import { CANVAS_IMAGE_ACCEPT, clampCanvasZoom, rotateCanvasElement, scaleCanvasElement } from "./InfiniteCanvasEditor";

describe("infinite canvas uploads", () => {
  it("accepts the scrapbook image formats requested by the product", () => {
    expect(CANVAS_IMAGE_ACCEPT.split(",")).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ]);
  });

  it("keeps canvas transforms within safe editor limits", () => {
    expect(clampCanvasZoom(0.1)).toBe(0.55);
    expect(clampCanvasZoom(4)).toBe(1.6);
    expect(rotateCanvasElement(-2, 15)).toBe(13);
    expect(scaleCanvasElement(1.7, 0.3)).toBe(1.8);
    expect(scaleCanvasElement(0.4, -0.2)).toBe(0.35);
  });
});
