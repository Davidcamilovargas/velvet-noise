import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok, created, noContent } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import * as addressService from "../services/address.service";

function requireUserId(req: Request): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const listAddressesHandler = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await addressService.listAddresses(requireUserId(req)));
});

export const createAddressHandler = asyncHandler(async (req: Request, res: Response) => {
  created(res, await addressService.createAddress(requireUserId(req), req.body));
});

export const updateAddressHandler = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await addressService.updateAddress(requireUserId(req), req.params.id, req.body));
});

export const deleteAddressHandler = asyncHandler(async (req: Request, res: Response) => {
  await addressService.deleteAddress(requireUserId(req), req.params.id);
  noContent(res);
});
