import { z } from "zod";
import { sanitizedText } from "../utils/sanitize";

export const addressBodySchema = z.object({
  label: z.string().trim().min(1, "Ingresa un nombre para la dirección (ej. Casa, Oficina)").max(60).default("Casa"),
  department: z.string().trim().min(1, "El departamento es obligatorio").max(120),
  city: z.string().trim().min(1, "La ciudad es obligatoria").max(120),
  addressLine: sanitizedText(z.string().trim().min(1, "La dirección es obligatoria").max(500)),
  complement: sanitizedText(z.string().trim().max(200)).optional(),
  postalCode: z.string().trim().max(20).optional(),
  isDefault: z.boolean().optional().default(false),
});

export const updateAddressSchema = addressBodySchema.partial();

export const addressIdParamSchema = z.object({ id: z.string().uuid("Id de dirección inválido") });

export type AddressInput = z.infer<typeof addressBodySchema>;
