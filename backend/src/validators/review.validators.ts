import { z } from "zod";
import { sanitizedText } from "../utils/sanitize";

export const createReviewSchema = z.object({
  productId: z.string().uuid("Producto inválido"),
  rating: z.number().int().min(1, "La calificación mínima es 1").max(5, "La calificación máxima es 5"),
  comment: sanitizedText(z.string().trim().min(5, "Cuéntanos un poco más en tu reseña").max(2000)),
});

export const listReviewsQuerySchema = z.object({
  productId: z.string().uuid().optional(),
});

export const listAdminReviewsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "all"]).optional().default("pending"),
});

export const reviewIdParamSchema = z.object({ id: z.string().uuid("Id de reseña inválido") });

export const setReviewStatusSchema = z.object({ isApproved: z.boolean() });

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ListAdminReviewsQuery = z.infer<typeof listAdminReviewsQuerySchema>;
