import { z } from "zod";
import { sanitizedText } from "../utils/sanitize";

const variantSchema = z.object({
  color: z.string().trim().max(60).optional(),
  size: z.string().trim().max(30).optional(),
  sku: z.string().trim().max(80).optional(),
  priceOverride: z.number().positive().optional(),
  imageUrl: z.string().trim().url().optional(),
  stock: z.number().int().min(0),
});

// CORREGIDO: antes exigía z.string().url(), que rechaza rutas relativas como
// "/products/foto.jpg" (así están guardadas casi todas las fotos del
// catálogo sembrado). Ahora acepta ambas: una URL completa (https://... —
// lo que devuelve Cloudinary al subir un archivo real) o una ruta que
// empiece con "/". No se acepta ningún otro esquema (javascript:, data:).
const productImageUrlSchema = z
  .string()
  .trim()
  .min(1, "La URL de la imagen es obligatoria")
  .refine((val) => val.startsWith("/") || /^https?:\/\//i.test(val), {
    message: 'Debe empezar con "/" (ej: /products/foto.jpg) o ser una URL completa (http/https)',
  });

const imageSchema = z.object({
  url: productImageUrlSchema,
  altText: z.string().trim().max(200).optional(),
  isPrimary: z.boolean().optional().default(false),
});

// AGREGADO: valida el body de "reordenar galería" — una lista de ids de
// fotos en el nuevo orden deseado. La validación de que la lista realmente
// corresponda a las fotos actuales del producto se hace en
// upload.service.ts (ahí sí se puede comparar contra la base de datos).
export const reorderImagesSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: sanitizedText(z.string().trim().min(1)),
  price: z.number().positive("El precio debe ser mayor a 0"),
  compareAtPrice: z.number().positive().optional(),
  sku: z.string().trim().max(80).optional(),
  categoryId: z.string().uuid("Categoría inválida"),
  isActive: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
  weightKg: z.number().positive().optional(),
  lengthCm: z.number().positive().optional(),
  widthCm: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  minStock: z.number().int().min(0).optional().default(5),
  stock: z.number().int().min(0).optional(),
  images: z.array(imageSchema).optional().default([]),
  variants: z.array(variantSchema).optional().default([]),
});

// CORREGIDO: antes updateProductSchema heredaba el .default([]) de "images"
// vía .partial(), así que si el panel de admin no mandaba fotos, Zod las
// convertía en [] de todas formas — y el servicio no podía distinguir "no
// toqué las fotos" de "quiero dejarlo sin fotos". Aquí se sobreescribe
// "images" sin default para que quede en `undefined` cuando no se manda.
// Ver product.service.ts#updateProduct.
export const updateProductSchema = createProductSchema.partial().extend({
  images: z.array(imageSchema).optional(),
});

export const productIdParamSchema = z.object({ id: z.string().uuid("Id de producto inválido") });

export const listProductsQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(), // slug
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["price_asc", "price_desc", "newest", "popularity"]).optional().default("newest"),
  inStock: z.coerce.boolean().optional(),
  onSale: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  // Uno o varios valores separados por coma: "S,M" o "Negro,Vino".
  size: z.string().trim().max(200).optional(),
  color: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(60).optional().default(12),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
