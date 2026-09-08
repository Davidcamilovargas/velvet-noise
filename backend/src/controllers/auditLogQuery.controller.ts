import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/apiResponse";
import { listAuditLogs } from "../services/auditLogQuery.service";

export const listAuditLogsHandler = asyncHandler(async (req: Request, res: Response) => {
  const resource = req.query.resource as string | undefined;
  ok(res, await listAuditLogs({ resource }));
});
