import { z } from "zod";
import { sanitizedText } from "../utils/sanitize";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: sanitizedText(z.string().trim().max(2000)).optional(),
  imageUrl: z.string().trim().url().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryIdParamSchema = z.object({ id: z.string().uuid("Id de categoría inválido") });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
