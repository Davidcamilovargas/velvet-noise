import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/apiResponse";
import { getShippingMethods } from "../services/shipping.service";

export const listShippingMethodsHandler = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await getShippingMethods());
});
