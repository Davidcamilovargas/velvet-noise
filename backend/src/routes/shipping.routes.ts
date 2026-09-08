import { Router } from "express";
import { listShippingMethodsHandler } from "../controllers/shipping.controller";

export const shippingRouter = Router();

// Público: el checkout necesita mostrar las opciones y precios de envío
// antes de que el usuario confirme el pedido (y ya se filtró por invitado
// vs. autenticado en la propia página, ver frontend/src/pages/Checkout.tsx).
shippingRouter.get("/", listShippingMethodsHandler);
