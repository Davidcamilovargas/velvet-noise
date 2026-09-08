import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Genera un token opaco aleatorio (refresh token, reset de contraseña).
 * Se devuelve el valor en claro UNA vez (para enviarlo por email o cookie)
 * y su hash SHA-256 es lo único que se persiste en la base de datos — así,
 * si la base de datos se filtra, los tokens no son directamente utilizables.
 */
export function generateOpaqueToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(48).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
