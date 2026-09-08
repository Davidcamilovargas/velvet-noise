import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { auditLogs, users } from "../db/schema";

/**
 * Lectura de auditoría para el panel admin. Se llama `auditLogQuery` (no
 * `auditLog`, ya ocupado por `utils/auditLog.ts`, que ESCRIBE los registros)
 * para que el nombre del archivo no sugiera que este es el punto de escritura.
 */
export async function listAuditLogs(filters: { resource?: string; limit?: number } = {}) {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resource: auditLogs.resource,
      resourceId: auditLogs.resourceId,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      adminEmail: users.email,
      adminFirstName: users.firstName,
      adminLastName: users.lastName,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(filters.resource ? eq(auditLogs.resource, filters.resource) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(filters.limit ?? 200);

  return rows;
}
