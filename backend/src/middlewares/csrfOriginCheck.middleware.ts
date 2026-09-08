import { NextFunction, Request, Response } from "express";
import { allowedOrigins } from "../config/cors";
import { AppError } from "../utils/AppError";

/**
 * Segunda capa de defensa contra CSRF, específica para `/api/auth/refresh`
 * (Fase 14, ver docs/01-arquitectura.md §7 "doble verificación de origen").
 * Es el único endpoint mutante que se autentica solo con una cookie —todos
 * los demás requieren el Authorization header con el access token, que un
 * sitio externo no puede adivinar ni leer entre orígenes—, así que es el
 * único que necesita esta verificación adicional.
 *
 * La cookie de refresh ya se emite con `SameSite=Strict` (ver
 * auth.controller.ts), que en cualquier navegador moderno ya evita que la
 * cookie viaje en una petición disparada desde otro sitio — esto es una
 * capa EXTRA explícita, no la única defensa, para navegadores viejos sin
 * soporte de SameSite o configuraciones no estándar de terceros.
 *
 * Solo se rechaza cuando el navegador SÍ envía `Origin` o `Referer` y no
 * coincide con la allowlist de CORS — clientes que no son navegadores
 * (apps móviles, curl, herramientas de prueba) no siempre los envían, y
 * ese caso ya está cubierto por SameSite=Strict de todas formas.
 */
export function verifyRefreshOrigin(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.get("origin");
  let source: string | undefined = origin ?? undefined;

  if (!source) {
    const referer = req.get("referer");
    if (referer) {
      try {
        source = new URL(referer).origin;
      } catch {
        // Referer malformado — se trata igual que "ausente" en vez de
        // rechazar, ya que SameSite=Strict sigue siendo la defensa real.
        source = undefined;
      }
    }
  }

  if (source && !allowedOrigins.includes(source)) {
    throw AppError.forbidden("Origen no permitido para esta operación.");
  }

  next();
}
