/**
 * Integración con Wompi (pasarela de pago principal, Colombia — ver
 * docs/01-arquitectura.md). Este archivo NUNCA llama directamente a la API
 * de Wompi para crear una transacción: el flujo elegido es el "Widget
 * Checkout", donde el navegador del cliente abre el widget alojado por
 * Wompi (con la llave PÚBLICA + una firma de integridad calculada aquí) y
 * es Wompi quien procesa la tarjeta en su propia infraestructura — nuestro
 * backend nunca ve ni toca datos de tarjeta (regla de seguridad §14 del
 * proyecto).
 *
 * Lo que este servicio sí hace, con criptografía real (no simulada):
 *  1. Calcular la "signature:integrity" que el widget exige para abrir el
 *     checkout (evita que alguien manipule el monto/la referencia desde el
 *     navegador).
 *  2. Verificar la firma de los webhooks entrantes de Wompi antes de
 *     confiar en su contenido.
 *
 * Fuente (verificada por WebFetch contra la documentación oficial de Wompi
 * el día de esta implementación, no memorizada de entrenamiento):
 *  - Integridad del widget: SHA256("{reference}{amountInCents}{currency}{integritySecret}")
 *    https://docs.wompi.co/en/docs/colombia/widget-checkout-web/
 *  - Firma de eventos/webhooks: SHA256 de la concatenación, EN ORDEN, de los
 *    valores de `signature.properties` (rutas dentro de `data`) + el
 *    `timestamp` del evento + el secreto de eventos, comparado contra
 *    `signature.checksum` (también disponible en el header `X-Event-Checksum`).
 *    https://docs.wompi.co/en/docs/colombia/eventos-pagos-a-terceros/
 */
import crypto from "node:crypto";
import { env } from "../config/env";

export interface IntegritySignatureInput {
  reference: string;
  amountInCents: number;
  currency: string;
}

/** Firma que el frontend debe enviar al widget de Wompi para abrir el checkout. */
export function computeIntegritySignature({ reference, amountInCents, currency }: IntegritySignatureInput): string {
  const raw = `${reference}${amountInCents}${currency}${env.WOMPI_INTEGRITY_SECRET}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Extrae un valor anidado de un objeto a partir de una ruta tipo "transaction.id". */
function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export interface WompiEventSignature {
  properties: string[];
  checksum: string;
}

export interface WompiWebhookEvent {
  event: string;
  data: Record<string, unknown>;
  signature: WompiEventSignature;
  timestamp: number;
  sentAt?: string;
  sent_at?: string;
  environment?: string;
}

/**
 * Verifica la autenticidad de un webhook de Wompi. Nunca se asume que
 * `signature.properties` es una lista fija (la documentación de Wompi
 * advierte explícitamente que puede cambiar) — se recalcula dinámicamente
 * a partir de las propiedades que el propio evento indica.
 */
export function verifyWebhookSignature(event: WompiWebhookEvent): boolean {
  if (!event?.signature?.properties?.length || !event.signature.checksum || !event.timestamp) return false;

  const concatenatedValues = event.signature.properties.map((path) => String(getByPath(event.data, path) ?? "")).join("");
  const raw = `${concatenatedValues}${event.timestamp}${env.WOMPI_EVENTS_SECRET}`;
  const expected = crypto.createHash("sha256").update(raw).digest("hex");

  // Comparación en tiempo constante para no filtrar el checksum válido por
  // temporización (mismo cuidado que con el hash de contraseñas/tokens).
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(event.signature.checksum, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export function generatePaymentReference(orderNumber: string): string {
  return `${orderNumber}-${crypto.randomBytes(4).toString("hex")}`;
}
