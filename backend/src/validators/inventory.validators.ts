import { z } from "zod";
import { sanitizedText } from "../utils/sanitize";

export const inventoryIdParamSchema = z.object({ id: z.string().uuid("Id de inventario inválido") });

export const listInventoryQuerySchema = z.object({
  search: z.string().trim().optional(),
  lowStockOnly: z.coerce.boolean().optional(),
});

export const adjustInventorySchema = z.object({
  // Delta con signo: positivo repone stock (ej. llegó mercancía), negativo
  // lo retira (ej. producto dañado encontrado en bodega). Nunca es un valor
  // absoluto — así el ajuste queda registrado como un movimiento auditable
  // en vez de sobreescribir el número sin dejar rastro de cuánto cambió.
  quantity: z.number().int().refine((n) => n !== 0, "La cantidad no puede ser cero"),
  reason: sanitizedText(z.string().trim().min(1, "Indica el motivo del ajuste").max(500)),
});

export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;
export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;
