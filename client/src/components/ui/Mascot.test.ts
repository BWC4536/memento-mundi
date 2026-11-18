import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MASCOT_NAMES, MASCOT_SIZES, mascotSrc } from "./Mascot";

const PUBLIC_DIR = path.resolve(process.cwd(), "client/public");

describe("mascota", () => {
  it("cada nombre del catálogo tiene su PNG en public/mascota", () => {
    const missing = MASCOT_NAMES.filter((name) => !existsSync(path.join(PUBLIC_DIR, mascotSrc(name))));
    expect(missing).toEqual([]);
    expect(MASCOT_NAMES).toHaveLength(39);
  });

  it("usa la escala de tamaños acordada", () => {
    expect(MASCOT_SIZES).toEqual({ sm: 96, md: 160, lg: 240, xl: 320 });
  });
});
