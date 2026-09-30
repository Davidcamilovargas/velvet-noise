import { Router } from "express";
import { z } from "zod";
import { validate } from "../middlewares/validate.middleware";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { publicCache } from "../middlewares/cacheControl.middleware";
import { mediaUpload, zipUpload, view360Upload } from "../middlewares/upload.middleware";
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  listProductsQuerySchema,
  reorderImagesSchema,
} from "../validators/product.validators";
import {
  listProductsHandler,
  getProductHandler,
  createProductHandler,
  updateProductHandler,
  setProductStatusHandler,
  deleteProductHandler,
} from "../controllers/product.controller";
import {
  uploadProductImagesHandler,
  uploadProductImagesZipHandler,
  deleteProductImageHandler,
  setPrimaryProductImageHandler,
  reorderProductImagesHandler,
  uploadProduct360FramesHandler,
} from "../controllers/upload.controller";

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

// ---------------------------------------------------------------------------
// AGREGADO: subida real de archivos (fotos/gifs/videos/frames 360°) para la
// galería del producto — reemplaza el flujo antiguo de "escribir un link".
// `mediaUpload`/`zipUpload`/`view360Upload` (Multer) van ANTES de `validate`
// porque leen multipart/form-data, no JSON; los ids en la URL sí se validan
// con Zod como en el resto de rutas.
// ---------------------------------------------------------------------------
productRouter.post(
  "/:id/images/upload",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: productIdParamSchema }),
  mediaUpload,
  uploadProductImagesHandler
);
productRouter.post(
  "/:id/images/upload-zip",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: productIdParamSchema }),
  zipUpload,
  uploadProductImagesZipHandler
);
productRouter.patch(
  "/:id/images/reorder",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: productIdParamSchema, body: reorderImagesSchema }),
  reorderProductImagesHandler
);
productRouter.patch(
  "/:id/images/:imageId/primary",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: productIdParamSchema.extend({ imageId: z.string().uuid() }) }),
  setPrimaryProductImageHandler
);
productRouter.delete(
  "/:id/images/:imageId",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: productIdParamSchema.extend({ imageId: z.string().uuid() }) }),
  deleteProductImageHandler
);
productRouter.post(
  "/:id/view360/upload",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: productIdParamSchema }),
  view360Upload,
  uploadProduct360FramesHandler
);
