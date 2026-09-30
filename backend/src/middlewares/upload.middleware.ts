/**
 * Configuración de Multer para recibir archivos reales desde el panel de
 * admin (fotos, gifs, videos cortos, frames de 360°, o un .zip con varios).
 *
 * Se usa `memoryStorage`: los archivos quedan en memoria (`file.buffer`) en
 * vez de escribirse al disco del backend — que en Render es efímero y de
 * todas formas los archivos van a Cloudinary, no al disco local.
 */
import multer from "multer";
import { AppError } from "../utils/AppError";

// Límite generoso pero acotado: fotos de producto normales pesan unos pocos
// MB; un video corto puede llegar a 40-50MB. Un .zip con muchas fotos puede
// pesar más, por eso el límite del .zip es más alto (ver zipUpload abajo).
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_ZIP_SIZE_BYTES = 200 * 1024 * 1024; // 200MB

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const ALLOWED_ZIP_TYPES = new Set(["application/zip", "application/x-zip-compressed", "application/octet-stream"]);

function mediaFileFilter(
  req: unknown,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
): void {
  if (ALLOWED_IMAGE_TYPES.has(file.mimetype) || ALLOWED_VIDEO_TYPES.has(file.mimetype)) {
    callback(null, true);
    return;
  }
  callback(new AppError("Tipo de archivo no permitido. Usa jpg, png, webp, gif, mp4 o webm.", 400, "INVALID_FILE_TYPE"));
}

// AGREGADO: acepta uno o varios archivos de imagen/gif/video en el mismo
// campo "files" (así el admin puede subir foto por foto o seleccionar
// varias a la vez desde el explorador de archivos).
export const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 30 },
  fileFilter: mediaFileFilter,
}).array("files", 30);

// AGREGADO: subida de un único .zip con muchas fotos adentro (Fase 2 —
// bulk upload). El contenido interno del .zip se valida archivo por
// archivo al descomprimirlo (ver upload.service.ts), no aquí — aquí solo
// se filtra por el tipo del .zip mismo, que a veces llega como
// "application/octet-stream" según el navegador/SO del admin, por eso la
// lista de tipos permitidos para el .zip es más flexible.
export const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ZIP_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    const looksLikeZip = ALLOWED_ZIP_TYPES.has(file.mimetype) || file.originalname.toLowerCase().endsWith(".zip");
    if (looksLikeZip) {
      callback(null, true);
      return;
    }
    callback(new AppError("El archivo debe ser un .zip", 400, "INVALID_FILE_TYPE"));
  },
}).single("file");

// AGREGADO: subida de los frames de la vista 360° — igual que mediaUpload
// pero solo imágenes (un 360° no lleva videos) y con más margen de
// cantidad (una vuelta completa puede tener 24-72 frames).
export const view360Upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 120 },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new AppError("Los frames de la vista 360° deben ser imágenes (jpg, png o webp).", 400, "INVALID_FILE_TYPE"));
  },
}).array("files", 120);
