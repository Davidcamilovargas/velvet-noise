import { Resend } from "resend";
import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Envío de correo transaccional. Se implementa completo desde ya (no es un
 * mock) usando Resend — cuando EMAIL_API_KEY esté configurada, el correo se
 * envía de verdad. Sin la clave (ej. en este entorno de desarrollo, donde
 * el usuario todavía no la ha generado), el contenido se registra en el log
 * del servidor para poder seguir probando el flujo completo (por ejemplo,
 * copiar el enlace de recuperación de contraseña) sin bloquear el
 * desarrollo. Las plantillas HTML completas para cada tipo de correo se
 * construyen en la Fase 13; aquí se define la interfaz que todas usarán.
 */
const resendClient = env.EMAIL_API_KEY ? new Resend(env.EMAIL_API_KEY) : null;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  if (!resendClient) {
    logger.warn("EMAIL_API_KEY no configurada — correo NO enviado, se muestra el contenido para desarrollo", {
      to,
      subject,
      html,
    });
    return;
  }

  try {
    await resendClient.emails.send({ from: env.EMAIL_FROM, to, subject, html });
    logger.info("Correo enviado", { to, subject });
  } catch (error) {
    // Un fallo de envío de correo NO debe tumbar la operación de negocio que
    // lo disparó (ej. el registro del usuario sí debe completarse aunque el
    // correo de bienvenida falle) — se loguea y se sigue.
    logger.error("Fallo al enviar correo", error, { to, subject });
  }
}
