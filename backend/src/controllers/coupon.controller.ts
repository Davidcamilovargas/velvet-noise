import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok, created, noContent } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import { writeAuditLog } from "../utils/auditLog";
import * as couponService from "../services/coupon.service";

export const listCouponsHandler = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await couponService.listCoupons());
});

export const createCouponHandler = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await couponService.createCoupon(req.body);
  await writeAuditLog(req, { action: "COUPON_CREATED", resource: "coupon", resourceId: coupon.id, metadata: { code: coupon.code } });
  created(res, coupon);
});

export const updateCouponHandler = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await couponService.updateCoupon(req.params.id, req.body);
  await writeAuditLog(req, { action: "COUPON_UPDATED", resource: "coupon", resourceId: req.params.id, metadata: req.body });
  ok(res, coupon);
});

export const setCouponStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await couponService.setCouponStatus(req.params.id, req.body.isActive);
  await writeAuditLog(req, {
    action: req.body.isActive ? "COUPON_ACTIVATED" : "COUPON_DEACTIVATED",
    resource: "coupon",
    resourceId: req.params.id,
  });
  ok(res, coupon);
});

export const deleteCouponHandler = asyncHandler(async (req: Request, res: Response) => {
  await couponService.deleteCoupon(req.params.id);
  await writeAuditLog(req, { action: "COUPON_DELETED", resource: "coupon", resourceId: req.params.id });
  noContent(res);
});

export const validateCouponHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized("Inicia sesión para aplicar un cupón.");
  const evaluation = await couponService.evaluateCoupon(req.body.code, req.body.subtotal, req.user.sub);
  ok(res, { code: evaluation.coupon.code, discountAmount: evaluation.discountAmount });
});
