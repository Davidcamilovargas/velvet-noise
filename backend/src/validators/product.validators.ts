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

const imageSchema = z.object({
  url: z.string().trim().url(),
  altText: z.string().trim().max(200).optional(),
  isPrimary: z.boolean().optional().default(false),
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

export const updateProductSchema = createProductSchema.partial();

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
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(60).optional().default(12),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
