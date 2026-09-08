import type { orderItems, orders, shipments } from "../db/schema";
import { env } from "../config/env";
import { formatCurrency } from "../utils/format";

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;
type ShipmentRow = typeof shipments.$inferSelect;

export interface EmailContent {
  subject: string;
  html: string;
}

/**
 * Escapa HTML para cualquier valor que se interpole en una plantilla de
 * correo. A diferencia de la UI de React (que escapa automáticamente al
 * renderizar), estas plantillas arman el HTML con template literals a
 * mano — un nombre, comentario o dato de envío con caracteres como `<` o
 * `&` (nombre real de un cliente, nombre de producto, transportadora,
 * número de guía) se insertaría tal cual en el correo sin esto. Se aplica
 * a TODO valor dinámico, sea o no directamente controlado por el usuario
 * (defensa en profundidad: un producto lo crea un admin, pero un admin no
 * debería poder romper el correo de un cliente por accidente tampoco).
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Envoltorio HTML compartido por todas las plantillas — así cada plantilla
 * solo escribe su contenido específico y el look-and-feel (encabezado con
 * el nombre real de la tienda, pie de página) queda consistente en todos
 * los correos transaccionales. `storeName` se recibe como parámetro (no se
 * importa `settings.service.ts` aquí) para no crear una dependencia
 * circular entre `jobs/` y `services/`, y porque cada llamador ya tiene la
 * configuración de la tienda a mano cuando dispara el correo.
 */
function wrap(storeName: string, bodyHtml: string): string {
  const safeStoreName = esc(storeName);
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
      <div style="padding: 24px 0; border-bottom: 2px solid #f1f5f9;">
        <span style="font-size: 20px; font-weight: 700; color: #4f46e5;">${safeStoreName}</span>
      </div>
      <div style="padding: 24px 0;">
        ${bodyHtml}
      </div>
      <div style="padding: 24px 0; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8;">
        <p>Este es un correo automático de ${safeStoreName}. Si tienes alguna pregunta, responde directamente a este correo.</p>
      </div>
    </div>
  `;
}

function itemsTable(items: OrderItemRow[]): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${esc(item.productNameSnapshot)} <span style="color: #94a3b8;">× ${item.quantity}</span></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${formatCurrency(item.subtotal)}</td>
        </tr>`
    )
    .join("");
  return `<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">${rows}</table>`;
}

function totalsTable(order: OrderRow): string {
  const rows: [string, string][] = [
    ["Subtotal", formatCurrency(order.subtotal)],
    ...(Number(order.discountTotal) > 0 ? ([["Descuento", `-${formatCurrency(order.discountTotal)}`]] as [string, string][]) : []),
    ["Envío", Number(order.shippingTotal) === 0 ? "Gratis" : formatCurrency(order.shippingTotal)],
    ["Impuestos", formatCurrency(order.taxTotal)],
  ];
  const rowsHtml = rows
    .map(([label, value]) => `<tr><td style="padding: 2px 0; color: #64748b;">${label}</td><td style="padding: 2px 0; text-align: right; color: #64748b;">${value}</td></tr>`)
    .join("");
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 8px 0 16px;">
      ${rowsHtml}
      <tr><td style="padding: 8px 0 0; font-weight: 700; border-top: 1px solid #e2e8f0;">Total</td><td style="padding: 8px 0 0; text-align: right; font-weight: 700; border-top: 1px solid #e2e8f0;">${formatCurrency(order.total)}</td></tr>
    </table>
  `;
}

function orderUrl(orderId: string): string {
  return `${env.FRONTEND_URL}/orders/${orderId}`;
}

function button(url: string, label: string): string {
  return `<a href="${esc(url)}" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">${esc(label)}</a>`;
}

/** Se envía al crear un pedido (`status: PENDING`), antes de que se confirme el pago. */
export function orderConfirmationEmail(storeName: string, order: OrderRow, items: OrderItemRow[]): EmailContent {
  const body = `
    <p>Hola ${esc(order.customerFirstName)},</p>
    <p>Recibimos tu pedido <strong>${esc(order.orderNumber)}</strong>. En cuanto se confirme el pago, empezamos a prepararlo.</p>
    ${itemsTable(items)}
    ${totalsTable(order)}
    ${button(orderUrl(order.id), "Ver mi pedido")}
  `;
  return { subject: `Recibimos tu pedido ${order.orderNumber}`, html: wrap(storeName, body) };
}

/** Se envía cuando el webhook de Wompi aprueba el pago y el pedido pasa a `PAID`. */
export function paymentApprovedEmail(storeName: string, order: OrderRow, items: OrderItemRow[]): EmailContent {
  const body = `
    <p>Hola ${esc(order.customerFirstName)},</p>
    <p>¡Tu pago del pedido <strong>${esc(order.orderNumber)}</strong> fue aprobado! Ya estamos preparando tu pedido.</p>
    ${itemsTable(items)}
    ${totalsTable(order)}
    ${button(orderUrl(order.id), "Ver mi pedido")}
  `;
  return { subject: `Pago aprobado — pedido ${order.orderNumber}`, html: wrap(storeName, body) };
}

/** Se envía cuando el webhook de Wompi marca el intento como `DECLINED`. */
export function paymentDeclinedEmail(storeName: string, order: OrderRow): EmailContent {
  const body = `
    <p>Hola ${esc(order.customerFirstName)},</p>
    <p>El pago de tu pedido <strong>${esc(order.orderNumber)}</strong> no pudo procesarse. Tu pedido sigue reservado — puedes intentar pagar de nuevo con otro medio de pago cuando quieras.</p>
    ${button(orderUrl(order.id), "Reintentar el pago")}
  `;
  return { subject: `No pudimos procesar tu pago — pedido ${order.orderNumber}`, html: wrap(storeName, body) };
}

/**
 * Caso especial documentado desde la Fase 10: el pago llegó aprobado por
 * Wompi, pero el stock ya no alcanzaba (dos compradores llegaron casi al
 * mismo tiempo por las últimas unidades) — el pedido se cancela automática-
 * mente y el dinero queda pendiente de reembolso manual. Este correo es la
 * comunicación real al cliente de ese caso, para que no se quede
 * preguntándose qué pasó con su pago.
 */
export function orderCancelledStockUnavailableEmail(storeName: string, order: OrderRow): EmailContent {
  const body = `
    <p>Hola ${esc(order.customerFirstName)},</p>
    <p>Tu pago del pedido <strong>${esc(order.orderNumber)}</strong> sí se procesó correctamente, pero justo se agotó el inventario de uno o más productos antes de que pudiéramos confirmar tu pedido.</p>
    <p>Lamentamos el inconveniente — vamos a reembolsarte el valor completo (${formatCurrency(order.total)}) a tu medio de pago original. Si no ves el reembolso en los próximos días hábiles, contáctanos respondiendo este correo.</p>
  `;
  return { subject: `Tu pedido ${order.orderNumber} no se pudo completar — reembolso en camino`, html: wrap(storeName, body) };
}

/** Se envía cuando un admin cancela o marca como reembolsado un pedido que ya estaba pagado. */
export function orderCancelledOrRefundedEmail(storeName: string, order: OrderRow, status: "CANCELLED" | "REFUNDED"): EmailContent {
  const wasPaid = order.paymentStatus === "APPROVED";
  const refundNote =
    status === "REFUNDED" || (status === "CANCELLED" && wasPaid)
      ? `<p>El valor de ${formatCurrency(order.total)} será reembolsado a tu medio de pago original.</p>`
      : "";
  const body = `
    <p>Hola ${esc(order.customerFirstName)},</p>
    <p>Tu pedido <strong>${esc(order.orderNumber)}</strong> fue ${status === "REFUNDED" ? "reembolsado" : "cancelado"}.</p>
    ${refundNote}
    ${button(orderUrl(order.id), "Ver mi pedido")}
  `;
  return {
    subject: `Pedido ${order.orderNumber} ${status === "REFUNDED" ? "reembolsado" : "cancelado"}`,
    html: wrap(storeName, body),
  };
}

/** Se envía cuando un admin cambia el estado del pedido a `SHIPPED`. */
export function orderShippedEmail(storeName: string, order: OrderRow, shipment: ShipmentRow): EmailContent {
  const trackingLine = shipment.trackingNumber
    ? `<p>Transportadora: <strong>${esc(shipment.carrier ?? "—")}</strong><br/>Número de guía: <strong>${esc(shipment.trackingNumber)}</strong></p>`
    : "";
  const body = `
    <p>Hola ${esc(order.customerFirstName)},</p>
    <p>Tu pedido <strong>${esc(order.orderNumber)}</strong> va en camino.</p>
    ${trackingLine}
    ${button(orderUrl(order.id), "Ver mi pedido")}
  `;
  return { subject: `Tu pedido ${order.orderNumber} fue enviado`, html: wrap(storeName, body) };
}

/** Se envía cuando un admin cambia el estado del pedido a `DELIVERED`. */
export function orderDeliveredEmail(storeName: string, order: OrderRow): EmailContent {
  const body = `
    <p>Hola ${esc(order.customerFirstName)},</p>
    <p>Tu pedido <strong>${esc(order.orderNumber)}</strong> fue entregado. ¡Esperamos que lo disfrutes!</p>
    <p>Si tienes un momento, nos encantaría que dejaras una reseña del producto.</p>
    ${button(orderUrl(order.id), "Ver mi pedido")}
  `;
  return { subject: `Tu pedido ${order.orderNumber} fue entregado`, html: wrap(storeName, body) };
}

/** Se envía al cliente cuando un admin aprueba su reseña y esta ya es pública. */
export function reviewApprovedEmail(storeName: string, firstName: string, productName: string, productUrl: string): EmailContent {
  const body = `
    <p>Hola ${esc(firstName)},</p>
    <p>Tu reseña de <strong>${esc(productName)}</strong> fue aprobada y ya es visible para otros compradores. ¡Gracias por tomarte el tiempo de compartir tu opinión!</p>
    ${button(productUrl, "Ver el producto")}
  `;
  return { subject: `Tu reseña de ${productName} ya es pública`, html: wrap(storeName, body) };
}

/** Se envía cuando un admin desactiva la cuenta de un cliente. */
export function accountDeactivatedEmail(storeName: string, firstName: string): EmailContent {
  const body = `
    <p>Hola ${esc(firstName)},</p>
    <p>Tu cuenta en ${esc(storeName)} fue desactivada por un administrador. Si crees que esto es un error, contáctanos respondiendo este correo.</p>
  `;
  return { subject: `Tu cuenta en ${storeName} fue desactivada`, html: wrap(storeName, body) };
}

export function welcomeEmail(storeName: string, firstName: string): EmailContent {
  const body = `
    <p>Hola ${esc(firstName)}, ¡bienvenido a ${esc(storeName)}!</p>
    <p>Tu cuenta fue creada exitosamente. Ya puedes explorar el catálogo, guardar direcciones y hacer seguimiento de tus pedidos desde tu perfil.</p>
    ${button(env.FRONTEND_URL, "Ir a la tienda")}
  `;
  return { subject: `¡Bienvenido a ${storeName}!`, html: wrap(storeName, body) };
}

export function passwordResetEmail(storeName: string, firstName: string, resetUrl: string): EmailContent {
  const body = `
    <p>Hola ${esc(firstName)},</p>
    <p>Haz clic en el siguiente botón para restablecer tu contraseña (válido por 1 hora):</p>
    ${button(resetUrl, "Restablecer contraseña")}
    <p style="margin-top: 16px; color: #64748b; font-size: 13px;">Si no solicitaste esto, puedes ignorar este correo — tu contraseña actual sigue siendo válida.</p>
  `;
  return { subject: `Recupera tu contraseña — ${storeName}`, html: wrap(storeName, body) };
}
