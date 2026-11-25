import { describe, expect, it } from "vitest";
import { DEFAULT_TILE_URL, MAX_ZOOM, MIN_ZOOM, OSM_ATTRIBUTION, pinHtml } from "./atlas-map-utils";

describe("mapa del atlas", () => {
  it("usa OpenStreetMap con su atribución obligatoria", () => {
    expect(DEFAULT_TILE_URL).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(OSM_ATTRIBUTION).toContain("OpenStreetMap");
    expect(OSM_ATTRIBUTION).toContain("openstreetmap.org/copyright");
    expect([MIN_ZOOM, MAX_ZOOM]).toEqual([2, 10]);
  });

  it("dibuja la chincheta con el color y la ciudad, y escapa el texto", () => {
    const html = pinHtml({ city: "Barcelona", color: "#FA9223" }, false);
    expect(html).toContain("background:#FA9223");
    expect(html).toContain("Abrir recuerdos de Barcelona");
    expect(pinHtml({ city: "<img src=x onerror=alert(1)>", color: "#fff" }, true)).not.toContain("<img");
    expect(pinHtml({ city: "A", color: "#fff" }, true)).toContain("width:42px");
    expect(pinHtml({ city: "A", color: "#fff" }, false)).toContain("width:34px");
  });
});
