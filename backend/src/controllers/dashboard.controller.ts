import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/apiResponse";
import { getDashboardSummary } from "../services/dashboard.service";

export const getDashboardHandler = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await getDashboardSummary());
});
