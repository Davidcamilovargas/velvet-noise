import { Router } from "express";
import { z } from "zod";
import { validate } from "../middlewares/validate.middleware";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { publicCache } from "../middlewares/cacheControl.middleware";
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  listProductsQuerySchema,
} from "../validators/product.validators";
import {
  listProductsHandler,
  getProductHandler,
  createProductHandler,
  updateProductHandler,
  setProductStatusHandler,
  deleteProductHandler,
} from "../controllers/product.controller";

export const productRouter = Router();

// Cache-Control corto (60s) solo para peticiones anónimas — ver
// middlewares/cacheControl.middleware.ts para por qué es seguro aquí y no
// en ninguna ruta que pueda devolver datos distintos por usuario.
productRouter.get("/", optionalAuth, publicCache(60), validate({ query: listProductsQuerySchema }), listProductsHandler);
productRouter.get("/:idOrSlug", optionalAuth, publicCache(60), getProductHandler);

productRouter.post("/", requireAuth, requireRole("ADMIN"), validate({ body: createProductSchema }), createProductHandler);
productRouter.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: productIdParamSchema, body: updateProductSchema }),
  updateProductHandler
);
productRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: productIdParamSchema, body: z.object({ isActive: z.boolean() }) }),
  setProductStatusHandler
);
productRouter.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: productIdParamSchema }),
  deleteProductHandler
);
