import { describe, expect, it } from "vitest";
import { demoScrapbooks } from "./scrapbooks";

describe("demo scrapbooks", () => {
  it("exposes cover, location and collaboration metadata for every card", () => {
    expect(demoScrapbooks.length).toBeGreaterThanOrEqual(3);
    for (const scrapbook of demoScrapbooks) {
      expect(scrapbook.id).toBeTruthy();
      expect(scrapbook.title).toBeTruthy();
      expect(scrapbook.cover).toBeTruthy();
      expect(scrapbook.location).toBeTruthy();
      expect(scrapbook.photos).toBeGreaterThanOrEqual(0);
      expect(scrapbook.invited).toBeGreaterThanOrEqual(0);
    }
  });

  it("uses the uploaded sample as the first scrapbook cover", () => {
    expect(demoScrapbooks[0].cover).toBe("/manus-storage/IMG_0037_694d8611.webp");
  });
});
