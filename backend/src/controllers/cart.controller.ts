import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import * as cartService from "../services/cart.service";

function requireUserId(req: Request): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const getCartHandler = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.getCart(requireUserId(req));
  ok(res, cart);
});

export const addCartItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.addItemToCart(requireUserId(req), req.body);
  ok(res, cart, 201);
});

export const updateCartItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.updateCartItemQuantity(requireUserId(req), req.params.itemId, req.body.quantity);
  ok(res, cart);
});

export const removeCartItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.removeCartItem(requireUserId(req), req.params.itemId);
  ok(res, cart);
});

export const applyCouponHandler = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.applyCoupon(requireUserId(req), req.body.code);
  ok(res, cart);
});

export const removeCouponHandler = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.removeCoupon(requireUserId(req));
  ok(res, cart);
});

export const mergeCartHandler = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.mergeGuestCart(requireUserId(req), req.body.items);
  ok(res, cart);
});
