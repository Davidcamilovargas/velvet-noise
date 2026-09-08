/**
 * Logger centralizado. En producción nunca se debe hacer console.log directo
 * en controllers/services: todo pasa por aquí para poder controlar qué se
 * expone (nunca stack traces al cliente, sí en el log interno con un id de
 * correlación).
 */
import { isProduction } from "../config/env";

type LogMeta = Record<string, unknown> | undefined;

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string, meta?: LogMeta): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: "info", time: timestamp(), message, ...meta }));
  },
  warn(message: string, meta?: LogMeta): void {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({ level: "warn", time: timestamp(), message, ...meta }));
  },
  error(message: string, error?: unknown, meta?: LogMeta): void {
    const errorInfo =
      error instanceof Error
        ? { errorMessage: error.message, stack: isProduction ? undefined : error.stack }
        : { errorMessage: error };
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", time: timestamp(), message, ...errorInfo, ...meta }));
  },
};
