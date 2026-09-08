import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { created } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import * as paymentService from "../services/payment.service";

export const createPaymentHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const result = await paymentService.createPaymentForOrder(req.user.sub, req.body.orderId);
  created(res, result);
});

export const wompiWebhookHandler = asyncHandler(async (req: Request, res: Response) => {
  await paymentService.handleWompiWebhook(req.body);
  // Wompi solo necesita un 2xx para no reintentar la entrega; el cuerpo no se usa.
  res.status(200).json({ received: true });
});
