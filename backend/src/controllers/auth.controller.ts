import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import { isProduction } from "../config/env";
import * as authService from "../services/auth.service";
import type { AuthResult } from "../services/auth.service";

const REFRESH_COOKIE_NAME = "refreshToken";

function setRefreshCookie(res: Response, result: AuthResult): void {
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/api/auth",
    expires: result.refreshTokenExpiresAt,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
}

function requestMeta(req: Request): { userAgent?: string; ipAddress?: string } {
  return { userAgent: req.headers["user-agent"], ipAddress: req.ip };
}

function respondWithSession(res: Response, result: AuthResult, statusCode = 200): void {
  setRefreshCookie(res, result);
  ok(res, { user: result.user, accessToken: result.accessToken }, statusCode);
}

export const registerHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body, requestMeta(req));
  respondWithSession(res, result, 201);
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body, requestMeta(req));
  respondWithSession(res, result);
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawToken) throw AppError.unauthorized("No hay sesión activa.");

  const result = await authService.refreshSession(rawToken, requestMeta(req));
  respondWithSession(res, result);
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (rawToken) await authService.logout(rawToken);
  clearRefreshCookie(res);
  ok(res, { message: "Sesión cerrada correctamente." });
});

export const forgotPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email);
  // Respuesta genérica siempre — no confirma si el correo existe.
  ok(res, { message: "Si el correo existe en nuestro sistema, recibirás instrucciones para recuperar tu contraseña." });
});

export const resetPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);
  ok(res, { message: "Contraseña actualizada correctamente. Ya puedes iniciar sesión." });
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const user = await authService.getUserById(req.user.sub);
  if (!user) throw AppError.notFound("Usuario no encontrado.");
  ok(res, user);
});
