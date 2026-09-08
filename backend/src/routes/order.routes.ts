import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createOrderSchema, orderIdParamSchema, updateOrderStatusSchema } from "../validators/order.validators";
import { createOrderHandler, listOrdersHandler, getOrderHandler, updateOrderStatusHandler } from "../controllers/order.controller";

export const orderRouter = Router();

orderRouter.use(requireAuth);

orderRouter.post("/", validate({ body: createOrderSchema }), createOrderHandler);
orderRouter.get("/", listOrdersHandler);
orderRouter.get("/:id", validate({ params: orderIdParamSchema }), getOrderHandler);

// Gestión administrativa (Fase 12): solo ADMIN puede cambiar el estado de
// un pedido. `getOrderHandler`/`listOrdersHandler` de arriba ya sirven tanto
// al cliente (solo sus propios pedidos) como al admin (todos) según el rol.
orderRouter.put(
  "/:id/status",
  requireRole("ADMIN"),
  validate({ params: orderIdParamSchema, body: updateOrderStatusSchema }),
  updateOrderStatusHandler
);
