import { Router } from "express";
import { requireAuth, optionalAuth } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createReviewSchema, listReviewsQuerySchema } from "../validators/review.validators";
import { listReviewsHandler, createReviewHandler } from "../controllers/review.controller";

/**
 * Rutas públicas/de cliente de reseñas. La moderación (listar todas,
 * aprobar/rechazar, borrar) es exclusiva del panel admin y vive bajo
 * /api/admin/reviews (admin.routes.ts) — ver review.controller.ts, que
 * comparten el mismo service.
 */
export const reviewRouter = Router();

reviewRouter.get("/", optionalAuth, validate({ query: listReviewsQuerySchema }), listReviewsHandler);
reviewRouter.post("/", requireAuth, validate({ body: createReviewSchema }), createReviewHandler);
