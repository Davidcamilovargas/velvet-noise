import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createCouponSchema, updateCouponSchema, couponIdParamSchema, validateCouponSchema } from "../validators/coupon.validators";
import {
  listCouponsHandler,
  createCouponHandler,
  updateCouponHandler,
  setCouponStatusHandler,
  deleteCouponHandler,
  validateCouponHandler,
} from "../controllers/coupon.controller";

export const couponRouter = Router();

couponRouter.post("/validate", requireAuth, validate({ body: validateCouponSchema }), validateCouponHandler);

couponRouter.get("/", requireAuth, requireRole("ADMIN"), listCouponsHandler);
couponRouter.post("/", requireAuth, requireRole("ADMIN"), validate({ body: createCouponSchema }), createCouponHandler);
couponRouter.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: couponIdParamSchema, body: updateCouponSchema }),
  updateCouponHandler
);
couponRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("ADMIN"),
  validate({ params: couponIdParamSchema, body: z.object({ isActive: z.boolean() }) }),
  setCouponStatusHandler
);
couponRouter.delete("/:id", requireAuth, requireRole("ADMIN"), validate({ params: couponIdParamSchema }), deleteCouponHandler);
