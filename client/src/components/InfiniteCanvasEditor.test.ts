import { describe, expect, it } from "vitest";
import { CANVAS_IMAGE_ACCEPT } from "./InfiniteCanvasEditor";
import { clampCanvasZoom, clampElementScale, clampRotation, LIMITS } from "@/lib/composition";

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
    expect(LIMITS.canvasZoom).toEqual({ min: 0.5, max: 2.5 });
    expect(LIMITS.elementScale).toEqual({ min: 0.25, max: 3 });
    expect(LIMITS.rotation).toEqual({ min: -180, max: 180 });
    expect(clampCanvasZoom(0.1)).toBe(0.5);
    expect(clampCanvasZoom(4)).toBe(2.5);
    expect(clampElementScale(1.7 + 3)).toBe(3);
    expect(clampElementScale(0.1)).toBe(0.25);
    expect(clampRotation(-2 + 15)).toBe(13);
  });
});
