/**
 * Error de aplicación "esperado" (ej. "stock insuficiente", "credenciales
 * inválidas"). Se distingue de errores de programación/infra: el mensaje de
 * AppError SÍ es seguro de mostrar al usuario final.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational = true;
  public readonly code?: string;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code?: string): AppError {
    return new AppError(message, 400, code);
  }
  static unauthorized(message = "No autenticado"): AppError {
    return new AppError(message, 401, "UNAUTHORIZED");
  }
  static forbidden(message = "No tienes permisos para esta acción"): AppError {
    return new AppError(message, 403, "FORBIDDEN");
  }
  static notFound(message = "Recurso no encontrado"): AppError {
    return new AppError(message, 404, "NOT_FOUND");
  }
  static conflict(message: string, code?: string): AppError {
    return new AppError(message, 409, code);
  }
}
