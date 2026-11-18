/**
 * Preparación de fotos en cliente para el editor.
 *
 * - Acepta JPG, JPEG, PNG, WEBP, HEIC y HEIF.
 * - Decodifica con el navegador (Safari lee HEIC de forma nativa). Si el
 *   navegador no puede leer un HEIC/HEIF se devuelve un mensaje claro.
 * - Redimensiona y comprime antes de guardarla. En el prototipo el resultado es
 *   una data URL (solo para localStorage); con Supabase el Blob comprimido se
 *   subirá a Storage y en la base de datos solo se guardará la URL/clave.
 */

export const CANVAS_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
export const ACCEPTED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"] as const;
/** Valor para el atributo `accept` (tipos MIME + extensiones, iOS a veces no informa el MIME de HEIC). */
export const IMAGE_INPUT_ACCEPT = `${CANVAS_IMAGE_ACCEPT},${ACCEPTED_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",")}`;

export const MAX_IMAGE_SIDE = 1600;
export const IMAGE_QUALITY = 0.82;
export const MAX_INPUT_BYTES = 40 * 1024 * 1024;

export const HEIC_UNSUPPORTED_MESSAGE =
  "Este navegador no puede leer fotos HEIC/HEIF. Ábrela en Safari o expórtala como JPG (en iPhone: Ajustes › Cámara › Formatos › Más compatible) y vuelve a intentarlo.";

export type ImageFileKind = "standard" | "heic";
export type ImageClassification = { ok: true; kind: ImageFileKind } | { ok: false; message: string };

const extensionOf = (name: string) => name.toLowerCase().split(".").pop() ?? "";

export function classifyImageFile(file: { name: string; type: string; size?: number }): ImageClassification {
  const type = file.type.toLowerCase();
  const ext = extensionOf(file.name);
  if (file.size !== undefined && file.size > MAX_INPUT_BYTES) return { ok: false, message: "La foto pesa demasiado (máximo 40 MB)." };
  if (type === "image/heic" || type === "image/heif" || ext === "heic" || ext === "heif") return { ok: true, kind: "heic" };
  if (["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(type)) return { ok: true, kind: "standard" };
  if (!type && (ACCEPTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return { ok: true, kind: "standard" };
  return { ok: false, message: `“${file.name}” no es un formato admitido. Usa JPG, PNG, WEBP o HEIC.` };
}

/** Tamaño final manteniendo la proporción y sin superar `maxSide`. */
export function fitWithin(width: number, height: number, maxSide = MAX_IMAGE_SIDE) {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const ratio = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageUploadError";
  }
}

export type PreparedImage = {
  src: string;
  width: number;
  height: number;
  mimeType: string;
  originalName: string;
  originalMimeType: string;
  bytes: number;
};

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decodeImage(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      /* algunos navegadores no aceptan opciones o el formato: probamos con <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Decodifica, redimensiona y comprime una foto para colocarla en el lienzo. */
export async function prepareImageForCanvas(file: File, options: { maxSide?: number; quality?: number } = {}): Promise<PreparedImage> {
  const classification = classifyImageFile(file);
  if (!classification.ok) throw new ImageUploadError(classification.message);

  let decoded: Decoded;
  try {
    decoded = await decodeImage(file);
  } catch {
    throw new ImageUploadError(classification.kind === "heic" ? HEIC_UNSUPPORTED_MESSAGE : `No se pudo leer “${file.name}”. Prueba con otra foto.`);
  }

  try {
    const size = fitWithin(decoded.width, decoded.height, options.maxSide ?? MAX_IMAGE_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new ImageUploadError("Tu navegador no permite procesar imágenes.");
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, size.width, size.height);
    const quality = options.quality ?? IMAGE_QUALITY;
    let src = canvas.toDataURL("image/webp", quality);
    let mimeType = "image/webp";
    if (!src.startsWith("data:image/webp")) {
      src = canvas.toDataURL("image/jpeg", quality);
      mimeType = "image/jpeg";
    }
    return {
      src,
      ...size,
      mimeType,
      originalName: file.name,
      originalMimeType: file.type || `image/${extensionOf(file.name)}`,
      bytes: Math.round((src.length - src.indexOf(",") - 1) * 0.75),
    };
  } finally {
    decoded.release();
  }
}
