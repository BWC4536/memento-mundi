import { describe, expect, it } from "vitest";
import { transitionScrapbookMode } from "./scrapbook-flow";

describe("scrapbook photo flow", () => {
  it("keeps photo, fullscreen and editor actions separate", () => {
    expect(transitionScrapbookMode("photo", "view")).toBe("fullscreen");
    expect(transitionScrapbookMode("fullscreen", "close-view")).toBe("photo");
    expect(transitionScrapbookMode("photo", "edit")).toBe("editing");
    expect(transitionScrapbookMode("editing", "close-edit")).toBe("photo");
  });

  it("opens scanner from photo or editing without changing other modes", () => {
    expect(transitionScrapbookMode("photo", "scan")).toBe("scanning");
    expect(transitionScrapbookMode("editing", "scan")).toBe("scanning");
    expect(transitionScrapbookMode("fullscreen", "scan")).toBe("fullscreen");
    expect(transitionScrapbookMode("scanning", "close-scan")).toBe("photo");
  });
});
