import { z } from "zod";
import { sanitizedText } from "../utils/sanitize";

const shippingMethodSchema = z.enum(["STANDARD", "EXPRESS", "PICKUP"]);

const newAddressSchema = z.object({
  label: z.string().trim().min(1).max(60).default("Casa"),
  department: z.string().trim().min(1, "El departamento es obligatorio").max(120),
  city: z.string().trim().min(1, "La ciudad es obligatoria").max(120),
  addressLine: sanitizedText(z.string().trim().min(1, "La dirección es obligatoria").max(500)),
  complement: sanitizedText(z.string().trim().max(200)).optional(),
  postalCode: z.string().trim().max(20).optional(),
  saveAddress: z.boolean().optional().default(true),
});

export const createOrderSchema = z
  .object({
    shippingMethod: shippingMethodSchema,
    addressId: z.string().uuid("Dirección inválida").optional(),
    newAddress: newAddressSchema.optional(),
    customerPhone: z.string().trim().min(7, "Ingresa un teléfono de contacto válido").max(30),
    notes: sanitizedText(z.string().trim().max(500)).optional(),
  })
  .refine((data) => data.shippingMethod === "PICKUP" || !!data.addressId || !!data.newAddress, {
    message: "Selecciona o agrega una dirección de envío.",
    path: ["addressId"],
  });

export const orderIdParamSchema = z.object({ id: z.string().uuid("Id de pedido inválido") });

const orderStatusSchema = z.enum(["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]);

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
  carrier: sanitizedText(z.string().trim().max(100)).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  reason: sanitizedText(z.string().trim().max(500)).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
