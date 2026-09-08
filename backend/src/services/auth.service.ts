import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { users, refreshTokens, passwordResetTokens } from "../db/schema";
import { hashPassword, verifyPassword, generateOpaqueToken, hashOpaqueToken } from "../utils/hash";
import { signAccessToken } from "../utils/jwt";
import { parseDurationMs } from "../utils/duration";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";
import { sendEmail } from "../jobs/email.service";
import { welcomeEmail, passwordResetEmail } from "../jobs/emailTemplates";
import { getStoreSettings } from "./settings.service";
import { logger } from "../utils/logger";
import type { RegisterInput, LoginInput } from "../validators/auth.validators";

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: "CUSTOMER" | "ADMIN";
  isActive: boolean;
  createdAt: Date;
}

function toPublicUser(u: typeof users.$inferSelect): PublicUser {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  };
}

async function issueSession(
  user: typeof users.$inferSelect,
  meta: { userAgent?: string; ipAddress?: string }
): Promise<AuthResult> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });

  const { token: refreshToken, tokenHash } = generateOpaqueToken();
  const refreshTokenExpiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN));

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
    expiresAt: refreshTokenExpiresAt,
  });

  return { user: toPublicUser(user), accessToken, refreshToken, refreshTokenExpiresAt };
}

export async function register(
  input: RegisterInput,
  meta: { userAgent?: string; ipAddress?: string }
): Promise<AuthResult> {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) {
    throw AppError.conflict("Ya existe una cuenta registrada con este correo electrónico.", "EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
    })
    .returning();

  const { storeName } = await getStoreSettings();
  await sendEmail({ to: user.email, ...welcomeEmail(storeName, user.firstName) });

  return issueSession(user, meta);
}

export async function login(
  input: LoginInput,
  meta: { userAgent?: string; ipAddress?: string }
): Promise<AuthResult> {
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  // Mensaje genérico a propósito: no revelar si el correo existe o no.
  const invalidCredentialsError = AppError.unauthorized("Correo electrónico o contraseña incorrectos.");

  if (!user) throw invalidCredentialsError;
  if (!user.isActive) throw AppError.forbidden("Esta cuenta ha sido desactivada. Contacta a soporte.");

  const validPassword = await verifyPassword(input.password, user.passwordHash);
  if (!validPassword) throw invalidCredentialsError;

  return issueSession(user, meta);
}

// Ventana de gracia para reutilizar un refresh token recién rotado. La
// rotación es de un solo uso (ver comentario más abajo), pero dos llamadas
// legítimas casi simultáneas con la MISMA cookie SÍ ocurren en la práctica:
// dos pestañas recargando a la vez, o (dentro de una misma pestaña) React
// StrictMode invocando dos veces un efecto que dispara un refresh antes de
// que el frontend pueda coalescerlas (ver `inFlightRefresh` en
// frontend/src/services/auth.service.ts y `refreshPromise` en api.ts — esos
// dos coalescen llamadas *dentro* de un mismo documento/pestaña, pero dos
// pestañas son dos heaps de JS separados y no pueden compartir esa promesa;
// esto solo se puede resolver aquí, en el servidor). Sin esta ventana, la
// llamada perdedora de esa carrera recibía 401 y cerraba una sesión que en
// realidad seguía siendo válida para el usuario legítimo.
//
// Es un trade-off de seguridad deliberado y estándar (el mismo patrón que
// usan Auth0/Okta bajo el nombre "reuse interval"): dentro de esta ventana
// corta, reutilizar un token ya rotado no se trata como señal de robo y
// simplemente emite una sesión nueva más. Fuera de la ventana, la reutilización
// se sigue rechazando igual que antes.
const REFRESH_REUSE_GRACE_MS = 10_000;

export async function refreshSession(
  rawRefreshToken: string,
  meta: { userAgent?: string; ipAddress?: string }
): Promise<AuthResult> {
  const tokenHash = hashOpaqueToken(rawRefreshToken);

  const existing = await db.query.refreshTokens.findFirst({
    where: and(eq(refreshTokens.tokenHash, tokenHash), gt(refreshTokens.expiresAt, new Date())),
  });

  const withinReuseGrace =
    !!existing?.revokedAt && Date.now() - existing.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS;

  if (!existing || (existing.revokedAt && !withinReuseGrace)) {
    throw AppError.unauthorized("Sesión expirada o inválida. Inicia sesión de nuevo.");
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, existing.userId) });
  if (!user || !user.isActive) {
    throw AppError.unauthorized("Sesión expirada o inválida. Inicia sesión de nuevo.");
  }

  // Rotación: el refresh token usado se revoca (si todavía no lo estaba —
  // una reutilización dentro de la ventana de gracia ya lo encontró
  // revocado) y se emite uno nuevo. Si un token robado se reutiliza después
  // de la ventana de gracia, `revokedAt` ya estará seteado desde hace rato y
  // la verificación de arriba lo rechaza — limitando la ventana de uso de
  // un token filtrado a, como mucho, unos segundos más que antes.
  if (!existing.revokedAt) {
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, existing.id));
  }

  return issueSession(user, meta);
}

export async function logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashOpaqueToken(rawRefreshToken);
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  // Siempre se responde "ok" al controller sin importar si el usuario
  // existe (evita que alguien use este endpoint para enumerar correos
  // registrados). Solo si existe se genera y envía el token real.
  if (!user) {
    logger.info("Solicitud de recuperación para correo no registrado (ignorada)", { email });
    return;
  }

  const { token, tokenHash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });

  const resetUrl = `${env.FRONTEND_URL}/reset-password/${token}`;
  const { storeName } = await getStoreSettings();
  await sendEmail({ to: user.email, ...passwordResetEmail(storeName, user.firstName, resetUrl) });
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashOpaqueToken(rawToken);

  const resetToken = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.tokenHash, tokenHash),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, new Date())
    ),
  });

  if (!resetToken) {
    throw AppError.badRequest("El enlace de recuperación es inválido o ya expiró.", "INVALID_RESET_TOKEN");
  }

  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, resetToken.userId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetToken.id));
    // Por seguridad, cambiar la contraseña cierra todas las sesiones activas.
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, resetToken.userId));
  });
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return user ? toPublicUser(user) : null;
}
