import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { orders, orderItems, payments, inventory, inventoryMovements, webhookEvents } from "../db/schema";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { env } from "../config/env";
import { sendEmail } from "../jobs/email.service";
import { paymentApprovedEmail, paymentDeclinedEmail, orderCancelledStockUnavailableEmail } from "../jobs/emailTemplates";
import { getStoreSettings } from "./settings.service";
import {
  computeIntegritySignature,
  generatePaymentReference,
  verifyWebhookSignature,
  type WompiWebhookEvent,
} from "./wompi.service";

export interface CreatePaymentResult {
  publicKey: string;
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
  redirectUrl: string;
  customerEmail: string;
}

/**
 * Prepara un nuevo intento de pago con Wompi para un pedido propio. No se
 * llama a ninguna API de Wompi aquí: se calcula la firma de integridad y se
 * registra el intento — es el navegador quien abre el widget de Wompi
 * directamente con estos datos (ver frontend/src/services/payment.service.ts).
 */
export async function createPaymentForOrder(userId: string, orderId: string): Promise<CreatePaymentResult> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order || order.userId !== userId) throw AppError.notFound("Pedido no encontrado.");

  if (order.paymentStatus === "APPROVED") {
    throw AppError.conflict("Este pedido ya fue pagado.", "ORDER_ALREADY_PAID");
  }
  if (order.status === "CANCELLED") {
    throw AppError.conflict("Este pedido fue cancelado y ya no admite pagos.", "ORDER_CANCELLED");
  }

  if (!env.WOMPI_PUBLIC_KEY || !env.WOMPI_INTEGRITY_SECRET) {
    // No es un error del cliente: es configuración pendiente del comercio.
    // Se distingue explícitamente para no confundirlo con un fallo del
    // usuario (ver docs/03-api.md, Fase 10, "Configuración pendiente").
    throw new AppError(
      "Los pagos con Wompi todavía no están configurados en este entorno (faltan las llaves en .env).",
      503,
      "WOMPI_NOT_CONFIGURED"
    );
  }

  const reference = generatePaymentReference(order.orderNumber);
  const amountInCents = Math.round(Number(order.total) * 100);
  const signature = computeIntegritySignature({ reference, amountInCents, currency: order.currency });

  await db.insert(payments).values({
    orderId: order.id,
    provider: "WOMPI",
    reference,
    amount: order.total,
    currency: order.currency,
    status: "PENDING",
  });

  return {
    publicKey: env.WOMPI_PUBLIC_KEY,
    reference,
    amountInCents,
    currency: order.currency,
    signature,
    redirectUrl: `${env.FRONTEND_URL}/orders/${order.id}`,
    customerEmail: order.customerEmail,
  };
}

function mapWompiStatus(wompiStatus: string): "APPROVED" | "DECLINED" {
  // VOIDED (solo tarjetas) y ERROR se tratan como intento fallido: el
  // cliente puede simplemente intentar un pago nuevo (nueva `reference`).
  return wompiStatus === "APPROVED" ? "APPROVED" : "DECLINED";
}

/**
 * Procesa un webhook de Wompi de forma segura e idempotente:
 *  1. Verifica la firma (nunca se confía en el body sin validar quién lo envió).
 *  2. Registra el evento en `webhook_events`; si ya se procesó antes (mismo
 *     id de transacción + mismo estado), el índice único lo rechaza y se
 *     responde 200 sin reprocesar — así una reentrega de Wompi (reintenta
 *     hasta 3 veces si no recibe 2xx) nunca aplica el mismo cambio dos veces.
 *  3. Si el pago fue APROBADO, descuenta inventario de forma ATÓMICA con
 *     bloqueo de fila (`SELECT ... FOR UPDATE`) dentro de una transacción,
 *     para que dos pagos que llegan casi al mismo tiempo por el último
 *     mismo producto nunca dejen el stock en negativo (el punto más
 *     riesgoso del proyecto, ver docs/01-arquitectura.md §9).
 */
export async function handleWompiWebhook(rawEvent: unknown): Promise<void> {
  const event = rawEvent as WompiWebhookEvent;

  if (!verifyWebhookSignature(event)) {
    logger.warn("Webhook de Wompi con firma inválida — descartado.", { event: event?.event });
    throw AppError.unauthorized("Firma de webhook inválida.");
  }

  if (event.event !== "transaction.updated") {
    // Evento reconocido pero no relevante para este flujo (ej. otros tipos
    // que Wompi pueda agregar en el futuro) — se responde 200 sin acción.
    logger.info("Webhook de Wompi ignorado (tipo no manejado).", { event: event.event });
    return;
  }

  const transaction = (event.data as { transaction?: Record<string, unknown> }).transaction;
  const transactionId = transaction?.id as string | undefined;
  const transactionStatus = transaction?.status as string | undefined;
  const reference = transaction?.reference as string | undefined;

  if (!transactionId || !transactionStatus || !reference) {
    logger.warn("Webhook de Wompi con forma inesperada — descartado.", { event: event.event });
    return;
  }

  // Idempotencia: (provider, eventId) es único. `eventId` combina la
  // transacción Y su estado porque una misma transacción puede pasar por
  // varios estados (PENDING -> APPROVED) y cada transición sí debe
  // procesarse — lo que nunca debe repetirse es la MISMA transición.
  const eventId = `${transactionId}:${transactionStatus}`;
  try {
    await db.insert(webhookEvents).values({
      provider: "WOMPI",
      eventId,
      eventType: event.event,
      payload: event as unknown as object,
    });
  } catch (err) {
    // Drizzle envuelve el error real de Postgres en `.cause` (ver
    // drizzle-orm/errors.js DrizzleQueryError) — el código de violación de
    // restricción única (23505) vive ahí, no en el error de nivel superior.
    const pgCode = (err as { cause?: { code?: string } } | undefined)?.cause?.code ?? (err as { code?: string } | undefined)?.code;
    const alreadyProcessed = pgCode === "23505";
    if (alreadyProcessed) {
      logger.info("Webhook de Wompi duplicado — ya procesado, no se repite.", { eventId });
      return;
    }
    throw err;
  }

  const payment = await db.query.payments.findFirst({ where: eq(payments.reference, reference) });
  if (!payment) {
    logger.warn("Webhook de Wompi para una referencia desconocida — ignorado.", { reference });
    return;
  }

  const newStatus = mapWompiStatus(transactionStatus);

  await db
    .update(payments)
    .set({ providerTransactionId: transactionId, status: newStatus, rawResponse: transaction as object })
    .where(eq(payments.id, payment.id));

  if (newStatus !== "APPROVED") {
    const [declinedOrder] = await db
      .update(orders)
      .set({ paymentStatus: newStatus })
      .where(eq(orders.id, payment.orderId))
      .returning();
    if (declinedOrder) {
      const { storeName } = await getStoreSettings();
      await sendEmail({ to: declinedOrder.customerEmail, ...paymentDeclinedEmail(storeName, declinedOrder) });
    }
    return;
  }

  await approveOrderPayment(payment.orderId, payment.id);
}

/**
 * Confirma el pago de un pedido: descuenta inventario de forma atómica y
 * marca el pedido como PAID. Si el stock ya no alcanza (dos compradores
 * pagaron casi simultáneamente por las últimas unidades — la ventana que
 * el checkout de la Fase 9 deliberadamente no cierra, ver docs/03-api.md),
 * el pedido se cancela en vez de sobrevender; el dinero ya capturado por
 * Wompi queda señalado para reembolso manual desde el panel admin
 * (Fase 12) — este proyecto no ejecuta reembolsos automáticos todavía,
 * ver la limitación documentada en docs/03-api.md (Fase 10).
 */
type ApprovePaymentOutcome =
  | { type: "order_missing" }
  | { type: "already_processed" }
  | { type: "oversold"; order: typeof orders.$inferSelect }
  | { type: "approved"; order: typeof orders.$inferSelect; items: (typeof orderItems.$inferSelect)[] };

async function approveOrderPayment(orderId: string, paymentId: string): Promise<void> {
  const outcome = await db.transaction(async (tx): Promise<ApprovePaymentOutcome> => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderId), with: { items: true } });
    if (!order) {
      logger.error("Webhook de Wompi aprobado para un pedido que ya no existe.", undefined, { orderId });
      return { type: "order_missing" };
    }
    if (order.paymentStatus === "APPROVED") return { type: "already_processed" }; // ya se procesó (defensa extra además de webhook_events)

    // Primera pasada: bloquea TODAS las filas de inventario involucradas
    // (FOR UPDATE) y verifica que alcancen, antes de escribir nada. Bloquear
    // primero y escribir después evita dejar el pedido a medio descontar si
    // un producto de varios sí alcanza y otro no.
    const lockedRows: { variantId: string; inventoryId: string; stock: number }[] = [];
    let hasEnoughStock = true;
    for (const item of order.items) {
      if (!item.variantId) continue;
      const [invRow] = await tx
        .select({ id: inventory.id, stock: inventory.stock })
        .from(inventory)
        .where(eq(inventory.variantId, item.variantId))
        .for("update");
      if (!invRow || invRow.stock < item.quantity) {
        hasEnoughStock = false;
        break;
      }
      lockedRows.push({ variantId: item.variantId, inventoryId: invRow.id, stock: invRow.stock });
    }

    if (!hasEnoughStock) {
      await tx
        .update(orders)
        .set({ status: "CANCELLED", paymentStatus: "APPROVED", paidPaymentId: paymentId })
        .where(eq(orders.id, orderId));
      logger.error(
        "Pago aprobado pero el stock ya no alcanza — pedido cancelado, requiere reembolso manual.",
        undefined,
        { orderId, paymentId }
      );
      return { type: "oversold", order };
    }

    for (const item of order.items) {
      if (!item.variantId) continue;
      const locked = lockedRows.find((r) => r.variantId === item.variantId)!;
      await tx
        .update(inventory)
        .set({ stock: sql`${inventory.stock} - ${item.quantity}` })
        .where(eq(inventory.variantId, item.variantId));
      await tx.insert(inventoryMovements).values({
        inventoryId: locked.inventoryId,
        type: "SALE",
        quantity: -item.quantity,
        reason: `Pago aprobado, pedido ${order.orderNumber}`,
        orderId: order.id,
      });
    }

    await tx
      .update(orders)
      .set({ status: "PAID", paymentStatus: "APPROVED", paidPaymentId: paymentId })
      .where(eq(orders.id, orderId));

    return { type: "approved", order, items: order.items };
  });

  // Los correos se envían DESPUÉS de que la transacción ya confirmó (nunca
  // dentro de ella — no hay que mantener una conexión de base de datos
  // abierta esperando una llamada de red al proveedor de correo).
  if (outcome.type === "approved" || outcome.type === "oversold") {
    const { storeName } = await getStoreSettings();
    if (outcome.type === "approved") {
      await sendEmail({ to: outcome.order.customerEmail, ...paymentApprovedEmail(storeName, outcome.order, outcome.items) });
    } else {
      await sendEmail({ to: outcome.order.customerEmail, ...orderCancelledStockUnavailableEmail(storeName, outcome.order) });
    }
  }
}
