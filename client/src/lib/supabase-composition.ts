/**
 * Preparado para Supabase/PostgreSQL (todavía NO conectado).
 *
 * Traduce la composición del editor a filas de `scrapbook_pages` y
 * `scrapbook_elements` (migración docs/supabase/002_scrapbook_editor.sql) y
 * viceversa. Las fotos nunca viajan como bytes: antes de guardar en la base de
 * datos cada data URL del prototipo debe subirse al bucket `scrapbook-media`
 * y sustituirse por su URL/clave (ver `findInlineAssets`).
 */
import {
  isUuid,
  sanitizeComposition,
  type CanvasElement,
  type CanvasElementType,
  type ScrapbookComposition,
} from "./composition";

export const SCRAPBOOK_MEDIA_BUCKET = "scrapbook-media";

/** Ruta recomendada en Storage: <scrapbook-id>/<user-id>/<asset-id>.<ext> (coincide con las políticas RLS). */
export function buildAssetStoragePath(scrapbookId: string, userId: string, assetId: string, mimeType: string) {
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  return `${scrapbookId}/${userId}/${assetId}.${ext}`;
}

export type ScrapbookPageRow = {
  id: string;
  scrapbook_id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  background_json: Record<string, unknown>;
  sort_order: number;
  updated_at: string;
};

export type ScrapbookElementRow = {
  id: string;
  page_id: string;
  scrapbook_id: string;
  created_by: string;
  element_type: CanvasElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  z_index: number;
  content: string | null;
  src: string | null;
  frame_id: string | null;
  filter_name: string;
  locked: boolean;
  visible: boolean;
  style_json: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
  updated_at: string;
};

export type ScrapbookAssetRow = {
  id: string;
  scrapbook_id: string;
  uploaded_by: string;
  storage_path: string;
  public_url: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
};

/** Elementos cuya foto sigue embebida (data:/blob:) y hay que subir a Storage antes de persistir. */
export function findInlineAssets(composition: ScrapbookComposition) {
  return composition.elements.filter((element) => element.src && /^(data|blob):/i.test(element.src));
}

export function compositionToRows(
  composition: ScrapbookComposition,
  ids: { scrapbookId: string; pageId: string; createdBy: string; name?: string; sortOrder?: number },
): { page: ScrapbookPageRow; elements: ScrapbookElementRow[] } {
  const notUuid = composition.elements.filter((element) => !isUuid(element.id));
  if (notUuid.length > 0) {
    throw new Error("Hay elementos con ids antiguos. Usa ensureUuidIds() antes de guardar en Supabase.");
  }
  const inline = findInlineAssets(composition);
  if (inline.length > 0) {
    throw new Error(`Hay ${inline.length} foto(s) sin subir a Storage. Súbelas primero: la base de datos solo guarda URLs.`);
  }
  const { canvas } = composition;
  return {
    page: {
      id: ids.pageId,
      scrapbook_id: ids.scrapbookId,
      name: ids.name ?? "Página 1",
      width: canvas.width,
      height: canvas.height,
      background: canvas.background,
      background_json: { texture: canvas.texture ?? "none", frame: canvas.frame ?? "none", formatId: canvas.formatId, backgroundImage: canvas.backgroundImage },
      sort_order: ids.sortOrder ?? 0,
      updated_at: composition.updatedAt,
    },
    elements: composition.elements.map((element) => ({
      id: element.id,
      page_id: ids.pageId,
      scrapbook_id: ids.scrapbookId,
      created_by: ids.createdBy,
      element_type: element.type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      scale: element.scale,
      z_index: element.z,
      content: element.content ?? null,
      src: element.src ?? null,
      frame_id: element.frameId ?? null,
      filter_name: element.filter ?? "original",
      locked: element.locked ?? false,
      visible: element.visible !== false,
      style_json: { textStyle: element.textStyle, color: element.color, opacity: element.opacity, crop: element.crop },
      metadata_json: { ...element.metadata, sampleId: element.sampleId, asset: element.asset },
      updated_at: composition.updatedAt,
    })),
  };
}

export function rowsToComposition(page: ScrapbookPageRow, rows: ScrapbookElementRow[]): ScrapbookComposition | null {
  const background = page.background_json ?? {};
  return sanitizeComposition({
    canvas: {
      width: page.width,
      height: page.height,
      background: page.background,
      texture: background.texture,
      frame: background.frame,
      formatId: background.formatId,
      backgroundImage: background.backgroundImage,
    },
    elements: rows.map((row): Partial<CanvasElement> => {
      const style = (row.style_json ?? {}) as Record<string, unknown>;
      const metadata = { ...(row.metadata_json ?? {}) } as Record<string, unknown>;
      const { sampleId, asset, ...rest } = metadata;
      return {
        id: row.id,
        type: row.element_type,
        x: row.x,
        y: row.y,
        width: row.width,
        height: row.height,
        rotation: row.rotation,
        scale: row.scale,
        z: row.z_index,
        content: row.content ?? undefined,
        src: row.src ?? undefined,
        frameId: (row.frame_id ?? undefined) as CanvasElement["frameId"],
        filter: row.filter_name as CanvasElement["filter"],
        locked: row.locked,
        visible: row.visible,
        textStyle: style.textStyle as CanvasElement["textStyle"],
        color: style.color as string | undefined,
        opacity: style.opacity as number | undefined,
        crop: style.crop as CanvasElement["crop"],
        sampleId: sampleId as string | undefined,
        asset: asset as CanvasElement["asset"],
        metadata: Object.keys(rest).length ? rest : undefined,
      };
    }),
    updatedAt: page.updated_at,
  });
}
