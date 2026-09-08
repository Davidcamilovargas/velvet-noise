import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[a-z]/, "Debe incluir al menos una letra minúscula")
  .regex(/[A-Z]/, "Debe incluir al menos una letra mayúscula")
  .regex(/[0-9]/, "Debe incluir al menos un número");

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo electrónico inválido"),
  password: passwordSchema,
  firstName: z.string().trim().min(1, "El nombre es requerido").max(120),
  lastName: z.string().trim().min(1, "El apellido es requerido").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, "Teléfono inválido")
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo electrónico inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo electrónico inválido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Token inválido"),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
