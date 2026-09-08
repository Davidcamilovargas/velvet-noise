import { z } from "zod";

export const addCartItemSchema = z.object({
  productId: z.string().uuid("Producto inválido"),
  variantId: z.string().uuid("Variante inválida").optional(),
  quantity: z.number().int().min(1, "La cantidad debe ser al menos 1"),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, "La cantidad debe ser al menos 1"),
});

export const cartItemIdParamSchema = z.object({ itemId: z.string().uuid("Id de ítem inválido") });

export const applyCouponSchema = z.object({ code: z.string().trim().min(1, "Ingresa un código de cupón") });

export const mergeCartSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      variantId: z.string().uuid().nullable().optional(),
      quantity: z.number().int().min(1),
    })
  ),
});
