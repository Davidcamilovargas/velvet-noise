import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/apiResponse";
import { writeAuditLog } from "../utils/auditLog";
import * as settingsService from "../services/settings.service";

export const getSettingsHandler = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await settingsService.getStoreSettings());
});

export const updateSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
  const updated = await settingsService.updateStoreSettings(req.body);
  await writeAuditLog(req, { action: "SETTINGS_UPDATED", resource: "store_settings", resourceId: "1", metadata: req.body });
  ok(res, updated);
});
