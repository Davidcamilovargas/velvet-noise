import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { isProduction } from "../config/env";

function correlationId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Middleware global de errores. Reglas duras:
 * - Nunca se devuelve stack trace, variables de entorno, ni mensajes crudos
 *   de librerías (ej. errores de Prisma) al cliente.
 * - Los errores "esperados" (AppError, Zod) sí devuelven un mensaje claro y
 *   accionable ("El producto ya no tiene suficiente stock").
 * - Todo error se loguea con un id de correlación que también se muestra al
 *   usuario, para poder buscarlo en los logs si contacta a soporte.
 */
export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const cid = correlationId();

  if (err instanceof ZodError) {
    logger.warn("Error de validación", { cid, path: req.path, issues: err.issues });
    res.status(422).json({
      error: {
        message: "Los datos enviados no son válidos.",
        code: "VALIDATION_ERROR",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        correlationId: cid,
      },
    });
    return;
  }

  // AGREGADO: Multer lanza sus propios errores (archivo muy grande,
  // demasiados archivos, etc.) que no son AppError ni ZodError — sin esto
  // caían al bloque genérico de abajo y el admin veía "error inesperado" en
  // vez de un mensaje claro sobre qué límite pasó.
  if (err instanceof MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "El archivo es demasiado grande."
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Se enviaron demasiados archivos a la vez."
          : "No se pudo procesar el archivo subido.";
    logger.warn(message, { cid, path: req.path, multerCode: err.code });
    res.status(400).json({ error: { message, code: err.code, correlationId: cid } });
    return;
  }

  if (err instanceof AppError) {
    logger.warn(err.message, { cid, path: req.path, statusCode: err.statusCode, code: err.code });
    res.status(err.statusCode).json({
      error: { message: err.message, code: err.code, correlationId: cid },
    });
    return;
  }

  // Error no esperado (bug, fallo de infraestructura, etc.)
  logger.error("Error no controlado", err, { cid, path: req.path });
  res.status(500).json({
    error: {
      message: "Ocurrió un error inesperado. Si el problema persiste, contacta a soporte.",
      code: "INTERNAL_ERROR",
      correlationId: cid,
      ...(isProduction ? {} : { debug: err instanceof Error ? err.message : String(err) }),
    },
  });
}
