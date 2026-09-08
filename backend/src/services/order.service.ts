import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  addresses,
  carts,
  cartItems,
  coupons,
  couponUsages,
  inventory,
  inventoryMovements,
  orderItems,
  orders,
  shipments,
  storeSettings,
  users,
} from "../db/schema";
import { AppError } from "../utils/AppError";
import type { Role } from "../utils/jwt";
import { getCart } from "./cart.service";
import { getShippingCost } from "./shipping.service";
import { getStoreSettings } from "./settings.service";
import { sendEmail } from "../jobs/email.service";
import { orderConfirmationEmail, orderShippedEmail, orderDeliveredEmail, orderCancelledOrRefundedEmail } from "../jobs/emailTemplates";
import { logger } from "../utils/logger";
import type { CreateOrderInput, UpdateOrderStatusInput } from "../validators/order.validators";

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${y}${m}${d}-${random}`;
}

function money(n: number): string {
  return n.toFixed(2);
}

interface ResolvedAddress {
  addressId: string | null;
  snapshot: Record<string, unknown>;
}

async function resolveShippingAddress(userId: string, input: CreateOrderInput): Promise<ResolvedAddress> {
  if (input.shippingMethod === "PICKUP") {
    const settings = await db.query.storeSettings.findFirst({ where: eq(storeSettings.id, 1) });
    return {
      addressId: null,
      snapshot: {
        pickup: true,
        storeAddress: settings?.address ?? "Te confirmaremos la dirección de recogida por correo electrónico.",
      },
    };
  }

  if (input.addressId) {
    const existing = await db.query.addresses.findFirst({
      where: and(eq(addresses.id, input.addressId), eq(addresses.userId, userId)),
    });
    if (!existing) throw AppError.notFound("La dirección seleccionada no existe.");
    return {
      addressId: existing.id,
      snapshot: {
        label: existing.label,
        department: existing.department,
        city: existing.city,
        addressLine: existing.addressLine,
        complement: existing.complement,
        postalCode: existing.postalCode,
      },
    };
  }

  if (input.newAddress) {
    const { saveAddress, ...addressFields } = input.newAddress;
    if (saveAddress) {
      const [created] = await db
        .insert(addresses)
        .values({ userId, ...addressFields })
        .returning();
      return { addressId: created.id, snapshot: { ...addressFields } };
    }
    return { addressId: null, snapshot: { ...addressFields } };
  }

  // No debería llegar aquí: el validator (createOrderSchema.refine) ya exige
  // addressId o newAddress salvo para PICKUP.
  throw AppError.badRequest("Selecciona o agrega una dirección de envío.");
}

/**
 * Crea un pedido REAL a partir del carrito del usuario. Punto de diseño
 * importante (ver docs/01-arquitectura.md §10 y docs/03-api.md): el
 * inventario NO se descuenta aquí. El pedido queda en estado PENDING /
 * paymentStatus PENDING; el descuento atómico de stock (con bloqueo de fila
 * para evitar sobreventa entre compradores concurrentes) ocurre en la Fase
 * 10 cuando el pago se CONFIRMA — descontar en el checkout reservaría stock
 * indefinidamente para pedidos que nunca se pagan. Lo que sí se valida aquí,
 * dos veces (antes y dentro de la transacción), es que el stock ACTUAL
 * alcance para lo que el carrito pide, para no dejar pasar un pedido
 * imposible de cumplir.
 */
export async function createOrderFromCart(userId: string, input: CreateOrderInput) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw AppError.unauthorized();

  const cart = await getCart(userId);
  if (cart.items.length === 0) throw AppError.badRequest("Tu carrito está vacío.");

  const staleItem = cart.items.find((item) => item.exceedsStock);
  if (staleItem) {
    throw AppError.conflict(
      `El stock de "${staleItem.productName}" cambió desde que lo agregaste. Revisa tu carrito antes de continuar.`,
      "CART_STOCK_CHANGED"
    );
  }

  const { addressId, snapshot } = await resolveShippingAddress(userId, input);
  const shippingTotal = await getShippingCost(input.shippingMethod);
  const total = cart.subtotal - cart.discountTotal + cart.taxTotal + shippingTotal;

  const couponId = cart.couponCode
    ? (await db.query.coupons.findFirst({ where: eq(coupons.code, cart.couponCode) }))?.id ?? null
    : null;

  const orderId = await db.transaction(async (tx) => {
    // Revalidación final DENTRO de la transacción: cierra la ventana entre
    // el chequeo de arriba (getCart) y esta escritura. Este es solo un
    // pre-chequeo de lectura (el descuento atómico real, con bloqueo de
    // fila `.for("update")`, ocurre después al aprobar el pago — ver
    // payment.service.ts), así que una sola consulta por lote en vez de una
    // por línea del carrito (Fase 16) no cambia ninguna garantía de
    // concurrencia, solo evita N ida-vueltas a la base de datos.
    const variantIds = cart.items.map((item) => item.variantId).filter((id): id is string => !!id);
    const stockByVariant = variantIds.length
      ? new Map(
          (
            await tx
              .select({ variantId: inventory.variantId, stock: inventory.stock })
              .from(inventory)
              .where(inArray(inventory.variantId, variantIds))
          ).map((row) => [row.variantId, row.stock])
        )
      : new Map<string | null, number>();

    for (const item of cart.items) {
      if (!item.variantId) continue;
      const stock = stockByVariant.get(item.variantId);
      if (stock === undefined || item.quantity > stock) {
        throw AppError.conflict(
          `El stock de "${item.productName}" cambió desde que lo agregaste. Revisa tu carrito antes de continuar.`,
          "CART_STOCK_CHANGED"
        );
      }
    }

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber: generateOrderNumber(),
        userId,
        status: "PENDING",
        subtotal: money(cart.subtotal),
        discountTotal: money(cart.discountTotal),
        shippingTotal: money(shippingTotal),
        taxTotal: money(cart.taxTotal),
        total: money(total),
        couponId,
        shippingMethod: input.shippingMethod,
        customerFirstName: user.firstName,
        customerLastName: user.lastName,
        customerEmail: user.email,
        customerPhone: input.customerPhone,
        shippingAddressId: addressId,
        addressSnapshot: snapshot,
        paymentStatus: "PENDING",
      })
      .returning();

    await tx.insert(orderItems).values(
      cart.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        variantId: item.variantId,
        productNameSnapshot: item.productName,
        skuSnapshot: item.sku,
        unitPrice: money(item.unitPrice),
        quantity: item.quantity,
        subtotal: money(item.subtotal),
      }))
    );

    // El cupón se considera "usado" al crear el pedido (no al pagarlo) —
    // así un mismo cupón no se puede aplicar a dos pedidos simultáneos del
    // mismo usuario más allá de su límite, aunque ninguno se haya pagado
    // todavía. Ver docs/03-api.md (sección COUPONS) para la razón de este
    // diseño.
    if (couponId) {
      await tx.insert(couponUsages).values({ couponId, userId, orderId: order.id });
    }

    await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    await tx.update(carts).set({ couponId: null }).where(eq(carts.id, cart.id));

    return order.id as string;
  });

  const created = await getOrderById(userId, orderId, user.role);

  // El correo se envía DESPUÉS de que la transacción ya confirmó — un fallo
  // al enviarlo (sendEmail nunca lanza, ver jobs/email.service.ts) nunca
  // debe impedir que el pedido, que ya se creó con éxito, se devuelva al
  // cliente.
  const { storeName } = await getStoreSettings();
  await sendEmail({ to: created.customerEmail, ...orderConfirmationEmail(storeName, created, created.items) });

  return created;
}

export async function getOrderById(userId: string, orderId: string, role: Role) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true, shipments: true },
  });
  if (!order) throw AppError.notFound("Pedido no encontrado.");
  if (role !== "ADMIN" && order.userId !== userId) {
    // 404 (no 403): no se confirma a otro usuario que el pedido existe.
    throw AppError.notFound("Pedido no encontrado.");
  }
  return order;
}

export async function listOrders(
  userId: string,
  role: Role,
  filters: { status?: string; search?: string } = {}
) {
  const rows = await db.query.orders.findMany({
    where: role === "ADMIN" ? undefined : eq(orders.userId, userId),
    with: { items: true, shipments: true },
    orderBy: [desc(orders.createdAt)],
  });

  // El filtrado admin (estado/búsqueda) se hace en memoria: el catálogo de
  // pedidos de esta tienda no justifica todavía mover esto a SQL (mismo
  // criterio que listProducts en product.service.ts).
  let filtered = rows;
  if (filters.status) filtered = filtered.filter((o) => o.status === filters.status);
  if (filters.search) {
    const term = filters.search.trim().toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(term) ||
        o.customerEmail.toLowerCase().includes(term) ||
        `${o.customerFirstName} ${o.customerLastName}`.toLowerCase().includes(term)
    );
  }
  return filtered;
}

const PAID_STATUSES = new Set(["PAID", "PROCESSING", "SHIPPED", "DELIVERED"]);

// Transiciones de estado permitidas desde el panel admin. PAID normalmente
// lo asigna el webhook de Wompi (Fase 10), no un admin — pero se permite
// aquí también para pedidos con pago manual/offline (regla del proyecto:
// nunca simular, así que un admin real necesita poder reflejar un pago que
// ocurrió fuera del sistema, ej. transferencia bancaria confirmada a mano).
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "SHIPPED", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

/**
 * Cambia el estado de un pedido desde el panel admin. Dos efectos reales
 * (no simulados) según la transición:
 *
 * 1. SHIPPED/DELIVERED: crea o actualiza el registro de `shipments` del
 *    pedido (transportadora, número de guía, fechas).
 * 2. CANCELLED/REFUNDED viniendo de un estado con `paymentStatus: APPROVED`
 *    (el pago ya había descontado inventario en la Fase 10): se devuelve el
 *    stock atómicamente (mismo patrón de bloqueo de fila que payment.service.ts)
 *    y se registra un movimiento RETURN por línea, auditable.
 */
export async function updateOrderStatus(orderId: string, input: UpdateOrderStatusInput) {
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { items: true } });
  if (!existing) throw AppError.notFound("Pedido no encontrado.");

  if (existing.status === input.status) {
    throw AppError.badRequest("El pedido ya está en ese estado.", "ORDER_STATUS_UNCHANGED");
  }

  const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(input.status)) {
    throw AppError.badRequest(
      `No se puede pasar un pedido de "${existing.status}" a "${input.status}".`,
      "ORDER_STATUS_TRANSITION_INVALID"
    );
  }

  const shouldRestock =
    ["CANCELLED", "REFUNDED"].includes(input.status) &&
    existing.paymentStatus === "APPROVED" &&
    PAID_STATUSES.has(existing.status);

  await db.transaction(async (tx) => {
    await tx.update(orders).set({ status: input.status }).where(eq(orders.id, orderId));

    if (shouldRestock) {
      for (const item of existing.items) {
        if (!item.variantId) continue;
        // Bloquea la fila de inventario antes de devolver el stock, igual
        // que al descontarlo — así una cancelación y otra operación
        // concurrente sobre la misma variante nunca se pisan.
        const [invRow] = await tx
          .select({ id: inventory.id })
          .from(inventory)
          .where(eq(inventory.variantId, item.variantId))
          .for("update");
        if (!invRow) continue;
        await tx
          .update(inventory)
          .set({ stock: sql`${inventory.stock} + ${item.quantity}` })
          .where(eq(inventory.id, invRow.id));
        await tx.insert(inventoryMovements).values({
          inventoryId: invRow.id,
          type: "RETURN",
          quantity: item.quantity,
          reason: `Pedido ${existing.orderNumber} pasó a ${input.status} desde el panel admin — stock devuelto.`,
          orderId,
        });
      }
    }

    if (input.status === "SHIPPED" || input.status === "DELIVERED") {
      const existingShipment = await tx.query.shipments.findFirst({ where: eq(shipments.orderId, orderId) });
      const now = new Date();
      if (existingShipment) {
        await tx
          .update(shipments)
          .set({
            status: input.status,
            carrier: input.carrier ?? existingShipment.carrier,
            trackingNumber: input.trackingNumber ?? existingShipment.trackingNumber,
            shippedAt: existingShipment.shippedAt ?? (input.status === "SHIPPED" ? now : null),
            deliveredAt: input.status === "DELIVERED" ? now : existingShipment.deliveredAt,
          })
          .where(eq(shipments.id, existingShipment.id));
      } else {
        await tx.insert(shipments).values({
          orderId,
          carrier: input.carrier,
          trackingNumber: input.trackingNumber,
          status: input.status,
          shippedAt: input.status === "SHIPPED" ? now : null,
          deliveredAt: input.status === "DELIVERED" ? now : null,
        });
      }
    }
  });

  const updated = await getOrderById(existing.userId, orderId, "ADMIN");

  // Notificación al cliente del cambio de estado, siempre después de que la
  // transacción ya confirmó (ver el mismo razonamiento en
  // createOrderFromCart). No todos los estados generan un correo — PENDING
  // y PROCESSING son transiciones internas sin nada nuevo que comunicarle
  // al cliente en este proyecto.
  const { storeName } = await getStoreSettings();
  if (input.status === "SHIPPED" || input.status === "DELIVERED") {
    const shipment = updated.shipments[0];
    if (input.status === "SHIPPED" && shipment) {
      await sendEmail({ to: updated.customerEmail, ...orderShippedEmail(storeName, updated, shipment) });
    } else if (input.status === "DELIVERED") {
      await sendEmail({ to: updated.customerEmail, ...orderDeliveredEmail(storeName, updated) });
    } else {
      logger.error("Pedido pasó a SHIPPED sin un registro de envío asociado — no se envió correo.", undefined, { orderId });
    }
  } else if (input.status === "CANCELLED" || input.status === "REFUNDED") {
    await sendEmail({ to: updated.customerEmail, ...orderCancelledOrRefundedEmail(storeName, updated, input.status) });
  }

  return updated;
}
