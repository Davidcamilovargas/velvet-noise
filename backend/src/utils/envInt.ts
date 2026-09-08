/**
 * Lee un entero positivo desde una variable de entorno cruda (no pasa por
 * el esquema estricto de `config/env.ts` porque son perillas opcionales de
 * ajuste fino, no configuración requerida para arrancar) con un valor por
 * defecto — usado por los rate limiters (`middlewares/rateLimiters.ts`,
 * `app.ts`) para que sus límites sean configurables por entorno sin cambiar
 * el comportamiento por defecto en producción si la variable no existe.
 */
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
