import { api } from "./api";
import type { AuditLogEntry } from "../types/api";

export async function fetchAuditLogs(resource?: string): Promise<AuditLogEntry[]> {
  const res = await api.get<{ data: AuditLogEntry[] }>("/admin/audit-logs", { params: { resource } });
  return res.data.data;
}
