import { z } from "zod";

export const customerIdParamSchema = z.object({ id: z.string().uuid("Id de cliente inválido") });

export const listCustomersQuerySchema = z.object({
  search: z.string().trim().optional(),
});

export const setCustomerStatusSchema = z.object({ isActive: z.boolean() });

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
