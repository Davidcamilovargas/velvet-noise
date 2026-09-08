import { NextFunction, Request, Response } from "express";

/**
 * Cache-Control corto para endpoints públicos de catálogo (Fase 16). Solo
 * se aplica cuando la petición NO trae un Authorization header: los
 * controllers de productos/categorías devuelven también los inactivos a un
 * admin autenticado (ver product.controller.ts, category.controller.ts) —
 * si se cacheara esa respuesta con `public`, un proxy/CDN compartido podría
 * servírsela después a un visitante anónimo, filtrando productos inactivos.
 * Sin Authorization header esa rama es inalcanzable (siempre requiere rol
 * ADMIN), así que cachear como `public` ahí es seguro.
 */
export function publicCache(maxAgeSeconds: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.headers.authorization) {
      res.set("Cache-Control", `public, max-age=${maxAgeSeconds}`);
    }
    next();
  };
}
