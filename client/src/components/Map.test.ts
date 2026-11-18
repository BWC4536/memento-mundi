import { describe, expect, it } from "vitest";
import { getMapsScriptUrl } from "./Map";

describe("carga de Google Maps", () => {
  it("usa el script oficial de Google cuando hay clave propia", () => {
    const url = getMapsScriptUrl({ googleKey: "AIza-test", forgeKey: "forge", proxyUrl: "https://proxy.test/v1/maps/proxy" })!;
    expect(url.startsWith("https://maps.googleapis.com/maps/api/js?key=AIza-test")).toBe(true);
    expect(url).toContain("libraries=marker");
    expect(url).toContain("loading=async");
  });

  it("recurre al proxy de Manus solo si no hay clave de Google", () => {
    expect(getMapsScriptUrl({ forgeKey: "forge", proxyUrl: "https://proxy.test/v1/maps/proxy" })).toBe(
      "https://proxy.test/v1/maps/proxy/maps/api/js?key=forge&v=weekly&libraries=marker,places,geocoding,geometry",
    );
  });

  it("sin ninguna clave no intenta cargar el mapa", () => {
    expect(getMapsScriptUrl({})).toBeNull();
  });
});
