import { z } from "zod";
import { sanitizedText } from "../utils/sanitize";

const shippingMethodOverrideSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  price: z.number().nonnegative().optional(),
  etaDays: z.number().int().nonnegative().optional(),
});

export const updateSettingsSchema = z.object({
  storeName: sanitizedText(z.string().trim().min(1).max(160)).optional(),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  contactPhone: z.string().trim().max(30).optional(),
  address: sanitizedText(z.string().trim().max(500)).optional(),
  currency: z.string().trim().length(3).optional(),
  taxPercentage: z.number().nonnegative().max(100).optional(),
  shippingMethods: z
    .object({
      STANDARD: shippingMethodOverrideSchema.optional(),
      EXPRESS: shippingMethodOverrideSchema.optional(),
      PICKUP: shippingMethodOverrideSchema.optional(),
    })
    .optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
