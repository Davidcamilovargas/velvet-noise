import { Router } from "express";
import { validate } from "../middlewares/validate.middleware";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { publicCache } from "../middlewares/cacheControl.middleware";
import { createCategorySchema, updateCategorySchema, categoryIdParamSchema } from "../validators/category.validators";
import {
  listCategoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
} from "../controllers/category.controller";

export const categoryRouter = Router();

// Las categorías cambian con menos frecuencia que el stock/precio de un
// producto — cache algo más largo (5 min) es seguro. Ver
// middlewares/cacheControl.middleware.ts para las condiciones de seguridad.
categoryRouter.get("/", optionalAuth, publicCache(300), listCategoriesHandler);
categoryRouter.post("/", requireAuth, requireRole("ADMIN"), validate({ body: createCategorySchema }), createCategoryHandler);
categoryRouter.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: categoryIdParamSchema, body: updateCategorySchema }),
  updateCategoryHandler
);
categoryRouter.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: categoryIdParamSchema }),
  deleteCategoryHandler
);
