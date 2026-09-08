import { Response } from "express";

/**
 * Formato de respuesta consistente para todos los endpoints exitosos, para
 * que el frontend pueda parsear respuestas sin adivinar la forma caso a
 * caso. Los errores usan el formato definido en middlewares/error.middleware.ts.
 */
export function ok<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ data });
}

export function okPaginated<T>(
  res: Response,
  data: T[],
  pagination: { page: number; pageSize: number; total: number }
): Response {
  return res.status(200).json({
    data,
    pagination: { ...pagination, totalPages: Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) },
  });
}

export function created<T>(res: Response, data: T): Response {
  return ok(res, data, 201);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}
