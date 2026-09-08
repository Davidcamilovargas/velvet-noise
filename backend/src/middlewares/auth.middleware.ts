import { NextFunction, Request, Response } from "express";
import { verifyAccessToken, AccessTokenPayload } from "../utils/jwt";
import { AppError } from "../utils/AppError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/**
 * Exige un access token válido (header `Authorization: Bearer <token>`).
 * Esta es la única fuente de verdad de autenticación en el backend — el
 * frontend puede ocultar botones según el rol, pero eso NUNCA sustituye
 * esta verificación (regla de seguridad §17 del proyecto).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(AppError.unauthorized("Debes iniciar sesión para continuar."));
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(AppError.unauthorized("Tu sesión expiró. Inicia sesión de nuevo."));
  }
}

/**
 * Igual que requireAuth pero no falla si no hay token — útil para rutas que
 * se comportan distinto para invitados vs. usuarios autenticados (ej. carrito).
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = verifyAccessToken(header.slice("Bearer ".length));
    } catch {
      // token inválido/expirado: se trata como invitado, no es un error fatal aquí
    }
  }
  next();
}
