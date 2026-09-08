import { z } from "zod";

export const createCouponSchema = z
  .object({
    code: z.string().trim().min(3).max(60),
    discountType: z.enum(["PERCENTAGE", "FIXED"]),
    percentage: z.number().positive().max(100).optional(),
    fixedAmount: z.number().positive().optional(),
    startsAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
    expiresAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
    maxUses: z.number().int().positive().nullable().optional(),
    maxUsesPerUser: z.number().int().positive().optional(),
    minPurchase: z.number().positive().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => (data.discountType === "PERCENTAGE" ? data.percentage != null : data.fixedAmount != null), {
    message: "Debes indicar el porcentaje o el valor fijo del descuento según el tipo elegido.",
  });

export const updateCouponSchema = z.object({
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  percentage: z.number().positive().max(100).optional(),
  fixedAmount: z.number().positive().optional(),
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(1)).optional(),
  expiresAt: z.string().datetime({ offset: true }).or(z.string().min(1)).optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  maxUsesPerUser: z.number().int().positive().optional(),
  minPurchase: z.number().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const couponIdParamSchema = z.object({ id: z.string().uuid("Id de cupón inválido") });

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1),
  subtotal: z.number().nonnegative(),
});

export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
