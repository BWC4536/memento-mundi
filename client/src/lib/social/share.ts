/** Enlaces compartibles de la comunidad. */
export const postUrl = (id: string) => `${window.location.origin}/explore/p/${encodeURIComponent(id)}`;
export const placeUrl = (slug: string) => `${window.location.origin}/explore/lugar/${encodeURIComponent(slug)}`;
export const profileUrl = (id: string) => `${window.location.origin}/explore/u/${encodeURIComponent(id)}`;

/** Comparte con la hoja nativa del móvil; si no existe, copia el enlace. */
export async function shareLink(url: string, title: string, text?: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
