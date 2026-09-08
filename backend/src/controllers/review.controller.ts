import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { created, ok, noContent } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import { writeAuditLog } from "../utils/auditLog";
import * as reviewService from "../services/review.service";
import type { ListAdminReviewsQuery } from "../validators/review.validators";

export const listReviewsHandler = asyncHandler(async (req: Request, res: Response) => {
  const productId = req.query.productId as string | undefined;
  if (!productId) throw AppError.badRequest("Falta el parámetro productId.");
  ok(res, await reviewService.listApprovedReviews(productId));
});

export const createReviewHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const review = await reviewService.createReview(req.user.sub, req.body);
  created(res, review);
});

export const listReviewsForAdminHandler = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await reviewService.listReviewsForAdmin(req.query as unknown as ListAdminReviewsQuery));
});

export const setReviewStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviewService.setReviewStatus(req.params.id, req.body.isApproved);
  await writeAuditLog(req, {
    action: req.body.isApproved ? "REVIEW_APPROVED" : "REVIEW_REJECTED",
    resource: "review",
    resourceId: req.params.id,
  });
  ok(res, review);
});

export const deleteReviewHandler = asyncHandler(async (req: Request, res: Response) => {
  await reviewService.deleteReview(req.params.id);
  await writeAuditLog(req, { action: "REVIEW_DELETED", resource: "review", resourceId: req.params.id });
  noContent(res);
});
