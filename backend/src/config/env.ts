/**
 * Carga y valida las variables de entorno con Zod al arrancar el proceso.
 * Si falta o es inválida una variable requerida, el servidor NO arranca:
 * preferimos fallar rápido en vez de correr con configuración incompleta
 * (por ejemplo, sin JWT_ACCESS_SECRET el sistema de sesiones sería inseguro).
 */
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET debe tener al menos 16 caracteres"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET debe tener al menos 16 caracteres"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  WOMPI_PUBLIC_KEY: z.string().optional().default(""),
  WOMPI_PRIVATE_KEY: z.string().optional().default(""),
  WOMPI_EVENTS_SECRET: z.string().optional().default(""),
  WOMPI_INTEGRITY_SECRET: z.string().optional().default(""),
  WOMPI_API_URL: z.string().default("https://sandbox.wompi.co/v1"),

  EMAIL_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default("Velvet Noise <no-reply@example.com>"),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),

  COOKIE_SECRET: z.string().min(16).optional().default("dev-cookie-secret-change-me-please"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Variables de entorno inválidas:");
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
