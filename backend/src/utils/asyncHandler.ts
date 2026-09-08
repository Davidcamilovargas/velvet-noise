import { NextFunction, Request, Response } from "express";

/**
 * Envuelve controllers async para que cualquier excepción llegue al
 * middleware de errores en vez de colgar la petición o tirar el proceso.
 */
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(
  fn: T
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
