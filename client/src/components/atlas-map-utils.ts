export type AtlasPlace = { id: string; city: string; lat: number; lng: number; color: string };

export const MIN_ZOOM = 2;
export const MAX_ZOOM = 10;
export const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** Chincheta de marca (mismo estilo que el resto de la app). */
export function pinHtml(place: Pick<AtlasPlace, "city" | "color">, active: boolean) {
  const size = active ? 42 : 34;
  return `<button type="button" aria-label="Abrir recuerdos de ${escapeHtml(place.city)}" style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;background:transparent;border:0;padding:0;transform:translate(-50%,-100%);">
    <span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border:2px solid #0B2130;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);background:${place.color};box-shadow:3px 3px 0 #0B2130;transition:all .18s ease;"><span style="color:#0B2130;font-size:15px;font-weight:900;transform:rotate(45deg);">✦</span></span>
    <span style="border:2px solid #0B2130;border-radius:999px;background:#EAE7DA;color:#0B2130;padding:3px 7px;font:900 10px/1 'Space Grotesk',sans-serif;white-space:nowrap;box-shadow:2px 2px 0 #0B2130;">${escapeHtml(place.city)}</span>
  </button>`;
}
