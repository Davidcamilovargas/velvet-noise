import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  addCartItemSchema,
  updateCartItemSchema,
  cartItemIdParamSchema,
  applyCouponSchema,
  mergeCartSchema,
} from "../validators/cart.validators";
import {
  getCartHandler,
  addCartItemHandler,
  updateCartItemHandler,
  removeCartItemHandler,
  applyCouponHandler,
  removeCouponHandler,
  mergeCartHandler,
} from "../controllers/cart.controller";

export const cartRouter = Router();

// El carrito de invitado vive en el navegador (ver frontend/src/store/cart.store.ts);
// el carrito respaldado por base de datos existe solo para usuarios autenticados.
cartRouter.use(requireAuth);

cartRouter.get("/", getCartHandler);
cartRouter.post("/items", validate({ body: addCartItemSchema }), addCartItemHandler);
cartRouter.put("/items/:itemId", validate({ params: cartItemIdParamSchema, body: updateCartItemSchema }), updateCartItemHandler);
cartRouter.delete("/items/:itemId", validate({ params: cartItemIdParamSchema }), removeCartItemHandler);
cartRouter.post("/coupon", validate({ body: applyCouponSchema }), applyCouponHandler);
cartRouter.delete("/coupon", removeCouponHandler);
cartRouter.post("/merge", validate({ body: mergeCartSchema }), mergeCartHandler);
