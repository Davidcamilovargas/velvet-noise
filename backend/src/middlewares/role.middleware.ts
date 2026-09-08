import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import type { Role } from "../utils/jwt";

/** Debe usarse SIEMPRE después de `requireAuth` en la cadena de middlewares. */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(AppError.forbidden("No tienes permisos para acceder a este recurso."));
      return;
    }
    next();
  };
}
