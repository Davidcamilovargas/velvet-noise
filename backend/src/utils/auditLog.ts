import { Request } from "express";
import { db } from "../db/client";
import { auditLogs } from "../db/schema";
import { logger } from "./logger";

/**
 * Registra una acción administrativa sensible (crear/editar/borrar un
 * recurso, cambiar el estado de un pedido, desactivar un cliente, etc.)
 * para la sección de auditoría del panel admin (Fase 12, regla de
 * trazabilidad §21 del proyecto).
 *
 * Deliberadamente NUNCA lanza: una falla al escribir el log de auditoría
 * (ej. un problema transitorio de conexión) no debe impedir que la acción
 * real del administrador se complete — se registra el error y se sigue.
 */
export async function writeAuditLog(
  req: Request,
  entry: { action: string; resource: string; resourceId?: string | null; metadata?: Record<string, unknown> }
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: req.user?.sub ?? null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata ?? null,
      ipAddress: req.ip ?? null,
    });
  } catch (error) {
    logger.error("No se pudo escribir el registro de auditoría", error, { entry });
  }
}
