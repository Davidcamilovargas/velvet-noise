import { Request } from "express";
import rateLimit from "express-rate-limit";
import { envInt } from "../utils/envInt";

/**
 * Los límites son configurables por variable de entorno (con los mismos
 * valores por defecto que tenía el código antes de esta fase, así que el
 * comportamiento en producción no cambia si no se define nada) — esto
 * permite que un entorno de desarrollo/CI que ejecuta la suite E2E real
 * (Fase 15, `frontend/e2e/`) desde una sola IP pueda subir el límite sin
 * tocar el código ni debilitar el valor por defecto que sí protege producción.
 */

/**
 * Límites específicos para rutas sensibles a fuerza bruta. El límite global
 * (app.ts) ya cubre abuso genérico; estos son más estrictos y se aplican
 * solo en las rutas que lo necesitan (login, forgot-password, register).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: envInt("AUTH_RATE_LIMIT_MAX", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { message: "Demasiados intentos. Espera unos minutos antes de volver a intentar.", code: "RATE_LIMITED" },
  },
});

/**
 * Límite adicional SOLO para /auth/login que combina IP + el correo
 * intentado (Fase 14, ver docs/01-arquitectura.md §7 "rate limiting
 * específico por IP+email") — el límite de arriba (`authLimiter`, por IP)
 * ya frena a un atacante desde una sola IP, pero no evita que alguien
 * distribuya intentos de fuerza bruta contra UNA cuenta específica desde
 * muchas IPs distintas. Combinar ambos en la clave detiene ese caso sin
 * penalizar a otros usuarios que comparten IP (una oficina, un NAT) e
 * intentan iniciar sesión con SUS PROPIAS cuentas al mismo tiempo.
 */
export const loginPerAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: envInt("LOGIN_PER_ACCOUNT_RATE_LIMIT_MAX", 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `${req.ip}:${String(req.body?.email ?? "").toLowerCase()}`,
  message: {
    error: { message: "Demasiados intentos para esta cuenta. Espera unos minutos antes de volver a intentar.", code: "RATE_LIMITED" },
  },
});

/**
 * /auth/refresh no tenía ningún límite propio — es público (solo lo protege
 * la cookie httpOnly), así que sin esto quedaba expuesto a ser golpeado sin
 * límite. Fuerza bruta contra el valor del token en sí es inviable (token
 * opaco de 48 bytes aleatorios, ver utils/hash.ts), pero el límite igual
 * frena abuso/DoS genérico contra el endpoint.
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: envInt("REFRESH_RATE_LIMIT_MAX", 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { message: "Demasiadas solicitudes. Espera unos minutos antes de volver a intentar.", code: "RATE_LIMITED" },
  },
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: envInt("PASSWORD_RESET_RATE_LIMIT_MAX", 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: "Demasiadas solicitudes de recuperación de contraseña. Intenta de nuevo más tarde.",
      code: "RATE_LIMITED",
    },
  },
});
