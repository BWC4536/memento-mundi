/**
 * Preparación de fotos en cliente para el editor.
 *
 * - Acepta JPG, JPEG, PNG, WEBP, HEIC y HEIF.
 * - Decodifica con el navegador (Safari lee HEIC de forma nativa). Si el
 *   navegador no puede, convierte el HEIC/HEIF a JPEG en el cliente con
 *   `heic-to` (libheif en WebAssembly), que se carga solo cuando hace falta.
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
  "No se pudo convertir esta foto HEIC/HEIF. Puede estar dañada o usar una variante no compatible. Expórtala como JPG (en iPhone: Ajustes › Cámara › Formatos › Más compatible) y vuelve a intentarlo.";

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

/** Detecta HEIC/HEIF por los bytes del contenedor (caja "ftyp"), aunque la extensión mienta. */
export function looksLikeHeic(header: Uint8Array) {
  if (header.length < 12) return false;
  const ascii = (start: number, end: number) => String.fromCharCode(...Array.from(header.subarray(start, end)));
  return ascii(4, 8) === "ftyp" && HEIC_BRANDS.has(ascii(8, 12).replace(/\u0000/g, " ").trim());
}

async function readHeader(file: Blob) {
  try {
    return new Uint8Array(await file.slice(0, 12).arrayBuffer());
  } catch {
    return new Uint8Array();
  }
}

/** Conversión HEIC → JPEG en el navegador. La librería (~3 MB) se descarga solo la primera vez que se necesita. */
export async function convertHeicToJpeg(file: Blob): Promise<Blob> {
  const { heicTo } = await import("heic-to");
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
}

export type DecodeStrategy<T> = {
  decode: (blob: Blob) => Promise<T>;
  convertHeic: (blob: Blob) => Promise<Blob>;
  onConverting?: () => void;
};

/**
 * Intenta leer la foto con el navegador; si no puede y es HEIC/HEIF, la
 * convierte a JPEG y la vuelve a leer. Separado para poder testearlo.
 */
export async function decodeWithHeicFallback<T>(file: Blob, kind: ImageFileKind, strategy: DecodeStrategy<T>): Promise<{ decoded: T; converted: boolean }> {
  try {
    return { decoded: await strategy.decode(file), converted: false };
  } catch (nativeError) {
    const isHeic = kind === "heic" || looksLikeHeic(await readHeader(file));
    if (!isHeic) throw nativeError;
  }
  strategy.onConverting?.();
  let converted: Blob;
  try {
    converted = await strategy.convertHeic(file);
  } catch {
    throw new ImageUploadError(HEIC_UNSUPPORTED_MESSAGE);
  }
  try {
    return { decoded: await strategy.decode(converted), converted: true };
  } catch {
    throw new ImageUploadError(HEIC_UNSUPPORTED_MESSAGE);
  }
}

export type ImageFileKind = "standard" | "heic";

export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageUploadError";
  }
}
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


export type PreparedImage = {
  src: string;
  width: number;
  height: number;
  mimeType: string;
  originalName: string;
  originalMimeType: string;
  /** true si era HEIC/HEIF y se convirtió en el navegador. */
  convertedFromHeic: boolean;
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
export async function prepareImageForCanvas(
  file: File,
  options: { maxSide?: number; quality?: number; onConverting?: () => void; convertHeic?: (blob: Blob) => Promise<Blob> } = {},
): Promise<PreparedImage> {
  const classification = classifyImageFile(file);
  if (!classification.ok) throw new ImageUploadError(classification.message);

  let decoded: Decoded;
  let converted = false;
  try {
    const result = await decodeWithHeicFallback(file, classification.kind, {
      decode: decodeImage,
      convertHeic: options.convertHeic ?? convertHeicToJpeg,
      onConverting: options.onConverting,
    });
    decoded = result.decoded;
    converted = result.converted;
  } catch (error) {
    if (error instanceof ImageUploadError) throw error;
    throw new ImageUploadError(`No se pudo leer “${file.name}”. Prueba con otra foto.`);
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
      convertedFromHeic: converted,
      bytes: Math.round((src.length - src.indexOf(",") - 1) * 0.75),
    };
  } finally {
    decoded.release();
  }
}
