import { z } from "zod";

export const createPaymentSchema = z.object({
  orderId: z.string().uuid("Id de pedido inválido"),
});

// El webhook de Wompi no sigue nuestras convenciones internas de naming
// (camelCase/snake_case mezclado según el producto) y su forma puede variar
// entre tipos de evento — se valida solo la envoltura mínima indispensable
// para verificar la firma; el resto se interpreta de forma tolerante dentro
// del servicio (ver wompi.service.ts).
export const wompiWebhookSchema = z.object({
  event: z.string(),
  data: z.record(z.unknown()),
  signature: z.object({
    properties: z.array(z.string()).min(1),
    checksum: z.string().min(1),
  }),
  timestamp: z.number(),
  environment: z.string().optional(),
});
