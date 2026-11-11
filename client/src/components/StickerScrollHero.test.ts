import { describe, expect, it } from "vitest";
import { INTRO_SCROLL_PX, advanceIntroProgress, frameIndexFor, resolveStickerProgress } from "./StickerScrollHero";

describe("StickerScrollHero progress", () => {
  it("clamps scroll progress to the video range", () => {
    expect(resolveStickerProgress(-0.2, false)).toBe(0);
    expect(resolveStickerProgress(0.45, false)).toBeCloseTo(0.45);
    expect(resolveStickerProgress(1.8, false)).toBe(1);
  });

  it("freezes the animation at its attached state when motion is reduced", () => {
    expect(resolveStickerProgress(0.8, true)).toBe(0);
  });

  it("advances with the scroll gesture and rewinds when scrolling up", () => {
    expect(advanceIntroProgress(0, INTRO_SCROLL_PX / 2)).toBeCloseTo(0.5);
    expect(advanceIntroProgress(0.5, -INTRO_SCROLL_PX / 4)).toBeCloseTo(0.25);
  });

  it("maps progress to the nearest frame of the sequence", () => {
    expect(frameIndexFor(0, 192)).toBe(0);
    expect(frameIndexFor(0.5, 192)).toBe(96);
    expect(frameIndexFor(1, 192)).toBe(191);
    expect(frameIndexFor(1.4, 192)).toBe(191);
  });

  it("never leaves the 0-1 range", () => {
    expect(advanceIntroProgress(0.9, INTRO_SCROLL_PX)).toBe(1);
    expect(advanceIntroProgress(0.1, -INTRO_SCROLL_PX)).toBe(0);
  });
});
