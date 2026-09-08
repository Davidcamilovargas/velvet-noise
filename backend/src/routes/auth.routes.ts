import { Router } from "express";
import { validate } from "../middlewares/validate.middleware";
import { authLimiter, loginPerAccountLimiter, passwordResetLimiter, refreshLimiter } from "../middlewares/rateLimiters";
import { requireAuth } from "../middlewares/auth.middleware";
import { verifyRefreshOrigin } from "../middlewares/csrfOriginCheck.middleware";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../validators/auth.validators";
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  meHandler,
} from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/register", authLimiter, validate({ body: registerSchema }), registerHandler);
authRouter.post("/login", authLimiter, loginPerAccountLimiter, validate({ body: loginSchema }), loginHandler);
authRouter.post("/refresh", refreshLimiter, verifyRefreshOrigin, refreshHandler);
authRouter.post("/logout", logoutHandler);
authRouter.post(
  "/forgot-password",
  passwordResetLimiter,
  validate({ body: forgotPasswordSchema }),
  forgotPasswordHandler
);
authRouter.post("/reset-password", passwordResetLimiter, validate({ body: resetPasswordSchema }), resetPasswordHandler);
authRouter.get("/me", requireAuth, meHandler);
