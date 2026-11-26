import { describe, expect, it } from "vitest";
import { memberInitial } from "./ScrapbookCard";

describe("inicial del avatar de un invitado", () => {
  it("usa la inicial del @usuario si lo tiene", () => {
    expect(memberInitial({ name: "Marta López", username: "lucia_viaja" })).toBe("L");
    expect(memberInitial({ name: "Marta", username: "@ñandú" })).toBe("Ñ");
  });

  it("sin @usuario, usa la inicial del nombre", () => {
    expect(memberInitial({ name: "  élia ramos" })).toBe("É");
  });

  it("sin @usuario ni nombre no hay inicial (se muestra el icono)", () => {
    expect(memberInitial({ name: "" })).toBe("");
    expect(memberInitial(undefined)).toBe("");
  });
});
