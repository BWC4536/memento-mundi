import { describe, expect, it } from "vitest";
import { authorInitials, authorName, avatarTint, compactCount, mediaAspect, timeAgoShort, tokenizeCaption } from "./format";
import { applySocialEvent, matchesQuery } from "./sync";
import type { SocialPost } from "./types";

const post = (id: string, authorId = "a1"): SocialPost => ({
  id,
  caption: null,
  created_at: "2026-11-25T10:00:00Z",
  author: { id: authorId, username: null, display_name: null, avatar_url: null },
  place: null,
  media: [],
  like_count: 0,
  comment_count: 0,
  liked: false,
  saved: false,
  following_author: false,
  preview_comments: [],
});

describe("formato de la red social", () => {
  it("nombres e iniciales con o sin @usuario", () => {
    expect(authorName({ username: "lucia.viaja", display_name: "Lucía" })).toBe("lucia.viaja");
    expect(authorName({ username: null, display_name: "Arturo" })).toBe("Arturo");
    expect(authorName(null)).toBe("viajero");
    expect(authorInitials({ username: "noa.mapas", display_name: null })).toBe("NM");
    expect(authorInitials({ username: null, display_name: "Inés Rubio" })).toBe("IR");
    expect(avatarTint("abc")).toBe(avatarTint("abc"));
  });

  it("tiempo relativo corto", () => {
    const now = new Date("2026-11-25T12:00:00Z");
    expect(timeAgoShort("2026-11-25T11:59:30Z", now)).toBe("ahora");
    expect(timeAgoShort("2026-11-25T11:55:00Z", now)).toBe("5 min");
    expect(timeAgoShort("2026-11-25T09:00:00Z", now)).toBe("3 h");
    expect(timeAgoShort("2026-11-22T12:00:00Z", now)).toBe("3 d");
    expect(timeAgoShort("2026-10-28T12:00:00Z", now)).toBe("4 sem");
    expect(timeAgoShort("2024-03-05T12:00:00Z", now)).toBe("5 mar 2024");
  });

  it("contadores compactos", () => {
    expect(compactCount(999)).toBe("999");
    expect(compactCount(1234)).toBe("1,2 mil");
    expect(compactCount(15_400)).toBe("15 mil");
    expect(compactCount(2_300_000)).toBe("2,3 M");
  });

  it("limita la proporción del carrusel entre 4:5 y 1,91:1", () => {
    expect(mediaAspect({ width: 1080, height: 1920 })).toBe(0.8);
    expect(mediaAspect({ width: 3000, height: 1000 })).toBe(1.91);
    expect(mediaAspect({ width: 1200, height: 800 })).toBe(1.5);
    expect(mediaAspect({ width: null, height: null })).toBe(0.8);
  });

  it("resalta #hashtags y @menciones", () => {
    expect(tokenizeCaption("Hola #Panamá con @ines.ensal.")).toEqual([
      { text: "Hola " },
      { text: "#Panamá", tag: true },
      { text: " con " },
      { text: "@ines.ensal", tag: true },
      { text: "." },
    ]);
  });
});

describe("sincronización entre listas", () => {
  it("aplica likes, borrados y seguimientos", () => {
    const posts = [post("p1", "a1"), post("p2", "a2"), post("p3", "a1")];
    expect(applySocialEvent(posts, { type: "post-patch", id: "p2", patch: { liked: true, like_count: 1 } })[1]).toMatchObject({ liked: true, like_count: 1 });
    expect(applySocialEvent(posts, { type: "post-deleted", id: "p1" }).map((item) => item.id)).toEqual(["p2", "p3"]);
    expect(applySocialEvent(posts, { type: "follow", userId: "a1", following: true }).map((item) => item.following_author)).toEqual([true, false, true]);
  });
});

describe("listas y privacidad", () => {
  const mine = { ...post("p1", "me"), visibility: "private" as const };
  const other = post("p2", "otro");

  it("lo privado solo entra en la pestaña propia o en mi perfil", () => {
    expect(matchesQuery({ scope: "mine" }, mine, "me")).toBe(true);
    expect(matchesQuery({ authorId: "me" }, mine, "me")).toBe(true);
    expect(matchesQuery({ scope: "all" }, mine, "me")).toBe(false);
    expect(matchesQuery({ scope: "following" }, mine, "me")).toBe(false);
  });

  it("la pestaña propia nunca muestra posts de otros y respeta el filtro", () => {
    expect(matchesQuery({ scope: "mine" }, other, "me")).toBe(false);
    expect(matchesQuery({ scope: "mine", visibility: "public" }, mine, "me")).toBe(false);
    expect(matchesQuery({ scope: "mine", visibility: "private" }, mine, "me")).toBe(true);
  });
});
