import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/apiResponse";
import { writeAuditLog } from "../utils/auditLog";
import * as inventoryService from "../services/inventory.service";
import type { ListInventoryQuery } from "../validators/inventory.validators";

export const listInventoryHandler = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await inventoryService.listInventory(req.query as unknown as ListInventoryQuery));
});

export const adjustInventoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const updated = await inventoryService.adjustInventory(req.params.id, req.body, req.user!.sub);
  await writeAuditLog(req, {
    action: "INVENTORY_ADJUSTED",
    resource: "inventory",
    resourceId: req.params.id,
    metadata: { quantity: req.body.quantity, reason: req.body.reason, newStock: updated.stock },
  });
  ok(res, updated);
});

export const listInventoryMovementsHandler = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await inventoryService.listInventoryMovements(req.params.id));
});
