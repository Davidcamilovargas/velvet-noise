import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/apiResponse";
import { writeAuditLog } from "../utils/auditLog";
import * as customerService from "../services/customer.service";
import type { ListCustomersQuery } from "../validators/customer.validators";

export const listCustomersHandler = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await customerService.listCustomers(req.query as unknown as ListCustomersQuery));
});

export const getCustomerHandler = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await customerService.getCustomerById(req.params.id));
});

export const setCustomerStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const updated = await customerService.setCustomerStatus(req.params.id, req.body.isActive);
  await writeAuditLog(req, {
    action: req.body.isActive ? "CUSTOMER_ACTIVATED" : "CUSTOMER_DEACTIVATED",
    resource: "customer",
    resourceId: req.params.id,
    metadata: { email: updated.email },
  });
  ok(res, updated);
});
