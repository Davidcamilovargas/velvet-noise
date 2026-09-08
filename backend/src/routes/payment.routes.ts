import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createPaymentSchema, wompiWebhookSchema } from "../validators/payment.validators";
import { createPaymentHandler, wompiWebhookHandler } from "../controllers/payment.controller";

export const paymentRouter = Router();

paymentRouter.post("/create", requireAuth, validate({ body: createPaymentSchema }), createPaymentHandler);

// Público a propósito: lo llama Wompi, no un navegador con sesión — la
// autenticidad se garantiza verificando la firma del payload, no con JWT
// (ver wompi.service.ts::verifyWebhookSignature).
paymentRouter.post("/webhook/wompi", validate({ body: wompiWebhookSchema }), wompiWebhookHandler);
