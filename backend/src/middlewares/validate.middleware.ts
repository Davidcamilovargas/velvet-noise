import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodEffects } from "zod";

type Schema = AnyZodObject | ZodEffects<AnyZodObject>;

/**
 * Valida y sanea `body`/`query`/`params` contra un esquema Zod ANTES de que
 * el controller reciba la petición. Regla de seguridad del proyecto: nunca
 * confiar solo en la validación del frontend (ej. cupones, precios, stock) —
 * este middleware es la puerta real de entrada de datos al sistema.
 * Si la validación falla, delega en errorMiddleware vía `next(error)`, que
 * ya sabe formatear errores ZodError de forma consistente.
 */
export function validate(schema: { body?: Schema; query?: Schema; params?: Schema }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.query) req.query = schema.query.parse(req.query) as typeof req.query;
      if (schema.params) req.params = schema.params.parse(req.params) as typeof req.params;
      next();
    } catch (err) {
      next(err);
    }
  };
}
