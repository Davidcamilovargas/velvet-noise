import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { created, ok } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import { writeAuditLog } from "../utils/auditLog";
import * as orderService from "../services/order.service";

function requireUser(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const createOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const order = await orderService.createOrderFromCart(user.sub, req.body);
  created(res, order);
});

export const listOrdersHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { status, search } = req.query as { status?: string; search?: string };
  ok(res, await orderService.listOrders(user.sub, user.role, { status, search }));
});

export const getOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  ok(res, await orderService.getOrderById(user.sub, req.params.id, user.role));
});

export const updateOrderStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.updateOrderStatus(req.params.id, req.body);
  await writeAuditLog(req, {
    action: "ORDER_STATUS_UPDATED",
    resource: "order",
    resourceId: req.params.id,
    metadata: { newStatus: req.body.status, orderNumber: order.orderNumber },
  });
  ok(res, order);
});
