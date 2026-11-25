import { describe, expect, it } from "vitest";
import { paletteColor, scrapbooksToPlaces } from "./scrapbook-map";
import type { Scrapbook } from "./scrapbooks";

const book = (id: string, extra: Partial<Scrapbook> = {}): Scrapbook => ({
  id,
  title: id,
  location: "Ciudad de Panamá, Panamá",
  country: "Panamá",
  cover: "",
  photos: 0,
  invited: 0,
  updated: "",
  palette: "bg-[#d7dfd6]",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  latitude: 8.9824,
  longitude: -79.5199,
  ...extra,
});

describe("chinchetas de scrapbooks", () => {
  it("usa el color de la paleta de la tarjeta y cae al naranja si no hay", () => {
    expect(paletteColor("bg-[#e7d8c2]")).toBe("#e7d8c2");
    expect(paletteColor("bg-orange")).toBe("#FA9223");
    expect(paletteColor(undefined)).toBe("#FA9223");
  });

  it("incluye los míos con coordenadas (también privados) y los públicos ajenos sin duplicar", () => {
    const places = scrapbooksToPlaces(
      [book("panama", { isPublic: false }), book("sin-sitio", { latitude: undefined, longitude: undefined })],
      [book("panama", { isPublic: true }), book("ajeno", { isPublic: true, latitude: 40.4, longitude: -3.7 })],
    );
    expect(places.map((place) => [place.id, place.mine])).toEqual([
      ["panama", true],
      ["ajeno", false],
    ]);
    expect(places[0]).toMatchObject({ city: "panama", lat: 8.9824, lng: -79.5199, country: "Panamá", color: "#d7dfd6" });
  });
});
