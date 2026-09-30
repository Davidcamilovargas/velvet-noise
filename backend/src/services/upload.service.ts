/**
 * Sube archivos reales (fotos, gifs, videos, frames de 360°) a Cloudinary,
 * organizados en carpetas por categoría, y guarda el resultado en la base
 * de datos (product_images / product_view_360_frames).
 *
 * Por qué por categoría y no por producto: el admin pidió que las carpetas
 * de Cloudinary queden organizadas "según las categorías" — así, aunque
 * cada foto queda igual asociada a SU producto en la base de datos (eso no
 * cambia), el árbol de carpetas en Cloudinary se ve ordenado por categoría
 * en vez de una carpeta plana con miles de archivos sueltos.
 */
import AdmZip from "adm-zip";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { products, productImages, productView360Frames, categories } from "../db/schema";
import { cloudinary, isCloudinaryConfigured } from "../config/cloudinary";
import { slugify } from "../utils/slugify";
import { AppError } from "../utils/AppError";

const ALLOWED_ZIP_ENTRY_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function assertCloudinaryConfigured(): void {
  if (!isCloudinaryConfigured) {
    throw AppError.badRequest(
      "La subida de archivos no está configurada todavía: faltan las credenciales de Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) en el servidor.",
      "CLOUDINARY_NOT_CONFIGURED"
    );
  }
}

async function getProductWithCategory(productId: string) {
  const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
  if (!product) throw AppError.notFound("Producto no encontrado.");
  const category = await db.query.categories.findFirst({ where: eq(categories.id, product.categoryId) });
  return { product, categorySlug: category?.slug ?? "sin-categoria" };
}

/** Carpeta destino en Cloudinary: velvet-noise/<categoria>/<producto>. */
function buildFolder(categorySlug: string, productSlug: string): string {
  return `velvet-noise/${categorySlug}/${productSlug}`;
}

function isVideoMime(mimetype: string): boolean {
  return mimetype.startsWith("video/");
}

function uploadBuffer(
  buffer: Buffer,
  folder: string,
  resourceType: "image" | "video"
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary no devolvió resultado."));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(buffer);
  });
}

/** Sube una o varias fotos/gifs/videos y los agrega a la galería del producto. */
export async function uploadProductImages(
  productId: string,
  files: Express.Multer.File[]
): Promise<Array<typeof productImages.$inferSelect>> {
  assertCloudinaryConfigured();
  if (files.length === 0) throw AppError.badRequest("No se recibió ningún archivo.");

  const { product, categorySlug } = await getProductWithCategory(productId);
  const folder = buildFolder(categorySlug, product.slug);

  const existing = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId));
  let nextPosition = existing.length === 0 ? 0 : Math.max(...existing.map((i) => i.position)) + 1;
  const hasPrimaryAlready = existing.some((i) => i.isPrimary);

  const inserted: Array<typeof productImages.$inferSelect> = [];
  for (const file of files) {
    const resourceType = isVideoMime(file.mimetype) ? "video" : "image";
    const { url, publicId } = await uploadBuffer(file.buffer, folder, resourceType);
    const [row] = await db
      .insert(productImages)
      .values({
        productId,
        url,
        cloudinaryPublicId: publicId,
        mediaType: resourceType === "video" ? "VIDEO" : "IMAGE",
        position: nextPosition,
        // La primera foto que sube un producto que todavía no tiene ninguna
        // queda como principal automáticamente; el admin puede cambiarla
        // después desde el panel.
        isPrimary: !hasPrimaryAlready && inserted.length === 0,
      })
      .returning();
    inserted.push(row);
    nextPosition++;
  }

  return inserted;
}

/**
 * Sube un .zip con varias fotos de una vez (Fase 2 — bulk upload). Cada
 * entrada válida adentro del .zip se sube igual que una foto individual;
 * las entradas que no son imágenes (carpetas, .DS_Store, PDFs sueltos,
 * etc.) se ignoran en silencio en vez de fallar todo el lote.
 */
export async function uploadProductImagesFromZip(
  productId: string,
  zipBuffer: Buffer
): Promise<Array<typeof productImages.$inferSelect>> {
  assertCloudinaryConfigured();

  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    throw AppError.badRequest("El archivo .zip está corrupto o no se pudo leer.", "INVALID_ZIP");
  }

  const entries = zip.getEntries().filter((entry) => {
    if (entry.isDirectory) return false;
    const name = entry.entryName.toLowerCase();
    const ext = name.slice(name.lastIndexOf("."));
    // Ignora archivos ocultos de macOS (__MACOSX/, .DS_Store) que casi
    // siempre terminan metidos en un .zip armado desde Finder.
    if (name.includes("__macosx/") || name.endsWith(".ds_store")) return false;
    return ALLOWED_ZIP_ENTRY_EXTENSIONS.has(ext);
  });

  if (entries.length === 0) {
    throw AppError.badRequest("El .zip no contiene fotos válidas (jpg, png, webp o gif).", "EMPTY_ZIP");
  }

  const pseudoFiles: Express.Multer.File[] = entries.map((entry) => {
    const name = entry.entryName.toLowerCase();
    const mimetype = name.endsWith(".png")
      ? "image/png"
      : name.endsWith(".webp")
        ? "image/webp"
        : name.endsWith(".gif")
          ? "image/gif"
          : "image/jpeg";
    return {
      buffer: entry.getData(),
      mimetype,
      originalname: entry.entryName,
    } as Express.Multer.File;
  });

  return uploadProductImages(productId, pseudoFiles);
}

/** Sube los frames de la vista 360° interactiva, en el orden en que llegaron. */
export async function uploadProduct360Frames(
  productId: string,
  files: Express.Multer.File[]
): Promise<Array<typeof productView360Frames.$inferSelect>> {
  assertCloudinaryConfigured();
  if (files.length === 0) throw AppError.badRequest("No se recibió ningún archivo.");

  const { product, categorySlug } = await getProductWithCategory(productId);
  const folder = `${buildFolder(categorySlug, product.slug)}/360`;

  // AGREGADO: cada subida de 360° reemplaza la anterior por completo — no
  // tendría sentido mezclar dos vueltas distintas de frames para el mismo
  // producto. Se borran de Cloudinary los frames viejos antes de insertar
  // los nuevos.
  const existing = await db
    .select()
    .from(productView360Frames)
    .where(eq(productView360Frames.productId, productId));
  await Promise.all(
    existing
      .filter((frame) => frame.cloudinaryPublicId)
      .map((frame) => cloudinary.uploader.destroy(frame.cloudinaryPublicId as string).catch(() => undefined))
  );
  await db.delete(productView360Frames).where(eq(productView360Frames.productId, productId));

  const inserted: Array<typeof productView360Frames.$inferSelect> = [];
  for (const [index, file] of files.entries()) {
    const { url, publicId } = await uploadBuffer(file.buffer, folder, "image");
    const [row] = await db
      .insert(productView360Frames)
      .values({ productId, url, cloudinaryPublicId: publicId, frameIndex: index })
      .returning();
    inserted.push(row);
  }

  return inserted;
}

/** Borra una foto/gif/video de la galería, incluyendo el archivo real en Cloudinary. */
export async function deleteProductImage(productId: string, imageId: string): Promise<void> {
  const image = await db.query.productImages.findFirst({
    where: and(eq(productImages.id, imageId), eq(productImages.productId, productId)),
  });
  if (!image) throw AppError.notFound("Foto no encontrada.");

  if (image.cloudinaryPublicId) {
    await cloudinary.uploader
      .destroy(image.cloudinaryPublicId, { resource_type: image.mediaType === "VIDEO" ? "video" : "image" })
      .catch(() => undefined); // si ya no existe en Cloudinary, no bloquea el borrado en la base de datos
  }
  await db.delete(productImages).where(eq(productImages.id, imageId));

  // Si la foto borrada era la principal, la siguiente en orden pasa a serlo
  // — así el producto nunca se queda sin foto principal mientras tenga al
  // menos una foto.
  if (image.isPrimary) {
    const remaining = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId));
    const next = remaining.sort((a, b) => a.position - b.position)[0];
    if (next) {
      await db.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, next.id));
    }
  }
}

/** Marca una foto como principal (y desmarca cualquier otra que lo fuera). */
export async function setPrimaryProductImage(productId: string, imageId: string): Promise<void> {
  const image = await db.query.productImages.findFirst({
    where: and(eq(productImages.id, imageId), eq(productImages.productId, productId)),
  });
  if (!image) throw AppError.notFound("Foto no encontrada.");

  await db.transaction(async (tx) => {
    await tx.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));
    await tx.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, imageId));
  });
}

/** Reordena las fotos de la galería según el orden de ids que manda el admin. */
export async function reorderProductImages(productId: string, orderedImageIds: string[]): Promise<void> {
  const existing = await db.select().from(productImages).where(eq(productImages.productId, productId));
  const existingIds = new Set(existing.map((i) => i.id));
  if (orderedImageIds.length !== existing.length || !orderedImageIds.every((id) => existingIds.has(id))) {
    throw AppError.badRequest("La lista de orden no coincide con las fotos actuales del producto.", "INVALID_ORDER");
  }

  await db.transaction(async (tx) => {
    for (const [index, imageId] of orderedImageIds.entries()) {
      await tx.update(productImages).set({ position: index }).where(eq(productImages.id, imageId));
    }
  });
}

// Se re-exporta por si en el futuro se necesita generar un slug de carpeta
// fuera de este módulo (ej. al renombrar categorías).
export { slugify };
