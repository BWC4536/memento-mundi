import { describe, expect, it } from "vitest";
import { mapScrollToStickerProgress, resolveStickerProgress } from "./StickerScrollHero";

describe("StickerScrollHero progress", () => {
  it("clamps scroll progress to the video range", () => {
    expect(resolveStickerProgress(-0.2, false)).toBe(0);
    expect(resolveStickerProgress(0.45, false)).toBeCloseTo(0.45);
    expect(resolveStickerProgress(1.8, false)).toBe(1);
  });

  it("freezes the animation at its attached state when motion is reduced", () => {
    expect(resolveStickerProgress(0.8, true)).toBe(0);
  });

  it("finishes the video before the sticky section releases", () => {
    expect(mapScrollToStickerProgress(0.41, false)).toBe(0.5);
    expect(mapScrollToStickerProgress(0.82, false)).toBe(1);
  });
});
