import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app";
import { db, pool } from "../src/db/client";
import {
  users,
  categories,
  products,
  carts,
  orders,
  couponUsages,
  inventory,
  inventoryMovements,
  payments,
  webhookEvents,
  auditLogs,
} from "../src/db/schema";
import { hashPassword } from "../src/utils/hash";
import { env } from "../src/config/env";

const app = createApp();
const suffix = Date.now();
const customerEmail = `payment-customer-${suffix}@example.com`;
const customer2Email = `payment-customer2-${suffix}@example.com`;

let customerToken: string;
let customer2Token: string;
let categoryId: string;
const productIds: string[] = [];
const orderIds: string[] = [];

async function adminToken(): Promise<string> {
  const adminEmail = `payment-admin-${suffix}@example.com`;
  const passwordHash = await hashPassword("Passw0rd1");
  const existing = await db.query.users.findFirst({ where: eq(users.email, adminEmail) });
  if (!existing) {
    await db.insert(users).values({ email: adminEmail, passwordHash, firstName: "A", lastName: "B", role: "ADMIN" });
  }
  const res = await request(app).post("/api/auth/login").send({ email: adminEmail, password: "Passw0rd1" });
  return res.body.data.accessToken;
}

async function createProductWithStock(name: string, stock: number, price = 30000) {
  const res = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${await adminToken()}`)
    .send({ name, description: "desc", price, sku: `${name.replace(/\s+/g, "-")}-${suffix}`, categoryId, stock });
  productIds.push(res.body.data.id);
  return { productId: res.body.data.id as string, variantId: res.body.data.variants[0].id as string };
}

/** Firma un evento de webhook igual que Wompi lo haría, usando el events
 * secret que ESTE backend tiene configurado (ver backend/.env) — replica
 * exactamente el algoritmo verificado en wompi.service.ts a partir de la
 * documentación oficial de Wompi. */
function signWompiEvent(properties: string[], data: Record<string, unknown>, timestamp: number): string {
  function getByPath(obj: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
  const concatenated = properties.map((p) => String(getByPath(data, p) ?? "")).join("");
  const raw = `${concatenated}${timestamp}${env.WOMPI_EVENTS_SECRET}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function buildTransactionEvent(reference: string, transactionId: string, status: string) {
  const timestamp = Date.now();
  const data = { transaction: { id: transactionId, status, reference, amount_in_cents: 30000 * 119 } };
  const properties = ["transaction.id", "transaction.status", "transaction.reference"];
  return {
    event: "transaction.updated",
    data,
    signature: { properties, checksum: signWompiEvent(properties, data, timestamp) },
    timestamp,
    environment: "test",
  };
}

async function checkoutOneUnit(token: string, productId: string, variantId: string): Promise<string> {
  await request(app).post("/api/cart/items").set("Authorization", `Bearer ${token}`).send({ productId, variantId, quantity: 1 });
  const res = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${token}`)
    .send({ shippingMethod: "PICKUP", customerPhone: "3001112233" });
  orderIds.push(res.body.data.id);
  return res.body.data.id as string;
}

describe("Pagos (Wompi) — firma de integridad y webhooks idempotentes", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword("Passw0rd1");
    await db
      .insert(users)
      .values([
        { email: customerEmail, passwordHash, firstName: "Pay", lastName: "Test", role: "CUSTOMER" },
        { email: customer2Email, passwordHash, firstName: "Pay2", lastName: "Test", role: "CUSTOMER" },
      ]);
    const login1 = await request(app).post("/api/auth/login").send({ email: customerEmail, password: "Passw0rd1" });
    customerToken = login1.body.data.accessToken;
    const login2 = await request(app).post("/api/auth/login").send({ email: customer2Email, password: "Passw0rd1" });
    customer2Token = login2.body.data.accessToken;

    const [category] = await db.insert(categories).values({ name: `Cat Pay ${suffix}`, slug: `cat-pay-${suffix}` }).returning();
    categoryId = category.id;
  });

  afterAll(async () => {
    for (const id of orderIds) {
      // Igual que coupon_usages (ver checkout.test.ts): ninguna de estas
      // tablas tiene ON DELETE CASCADE hacia orders a propósito (un pedido
      // real nunca se borra) — en la prueba sí, así que se limpia primero.
      await db.delete(couponUsages).where(eq(couponUsages.orderId, id));
      await db.delete(inventoryMovements).where(eq(inventoryMovements.orderId, id));
      await db.delete(payments).where(eq(payments.orderId, id));
      await db.delete(orders).where(eq(orders.id, id));
    }
    await db.delete(webhookEvents).where(eq(webhookEvents.provider, "WOMPI"));
    for (const id of productIds) {
      await db.delete(products).where(eq(products.id, id));
    }
    await db.delete(categories).where(eq(categories.id, categoryId));
    const c1 = await db.query.users.findFirst({ where: eq(users.email, customerEmail) });
    if (c1) await db.delete(carts).where(eq(carts.userId, c1.id));
    const c2 = await db.query.users.findFirst({ where: eq(users.email, customer2Email) });
    if (c2) await db.delete(carts).where(eq(carts.userId, c2.id));
    await db.delete(users).where(eq(users.email, customerEmail));
    await db.delete(users).where(eq(users.email, customer2Email));
    // Ver comentario equivalente en cart.test.ts: los productos creados como
    // admin dejaron registros de auditoría (Fase 12).
    const paymentAdmin = await db.query.users.findFirst({ where: eq(users.email, `payment-admin-${suffix}@example.com`) });
    if (paymentAdmin) await db.delete(auditLogs).where(eq(auditLogs.userId, paymentAdmin.id));
    await db.delete(users).where(eq(users.email, `payment-admin-${suffix}@example.com`));
    await pool.end();
  });

  it("crea un intento de pago con firma de integridad correcta (SHA256 verificable)", async () => {
    const { productId, variantId } = await createProductWithStock("Producto Pago Simple", 5);
    const orderId = await checkoutOneUnit(customerToken, productId, variantId);

    const res = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customerToken}`).send({ orderId });
    expect(res.status).toBe(201);
    const { reference, amountInCents, currency, signature, publicKey } = res.body.data;
    expect(publicKey).toBe(env.WOMPI_PUBLIC_KEY);
    expect(currency).toBe("COP");

    const expected = crypto.createHash("sha256").update(`${reference}${amountInCents}${currency}${env.WOMPI_INTEGRITY_SECRET}`).digest("hex");
    expect(signature).toBe(expected);

    const payment = await db.query.payments.findFirst({ where: eq(payments.reference, reference) });
    expect(payment?.status).toBe("PENDING");
  });

  it("rechaza un webhook con firma inválida y no cambia nada", async () => {
    const { productId, variantId } = await createProductWithStock("Producto Pago Firma Mala", 3);
    const orderId = await checkoutOneUnit(customerToken, productId, variantId);
    const createRes = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customerToken}`).send({ orderId });
    const { reference } = createRes.body.data;

    const event = buildTransactionEvent(reference, `tx-${suffix}-bad`, "APPROVED");
    event.signature.checksum = "0".repeat(64); // firma manipulada

    const res = await request(app).post("/api/payments/webhook/wompi").send(event);
    expect(res.status).toBe(401);

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    expect(order?.paymentStatus).toBe("PENDING");
  });

  it("aprueba un pago real vía webhook: descuenta inventario, marca el pedido como pagado", async () => {
    const { productId, variantId } = await createProductWithStock("Producto Pago Aprobado", 4);
    const orderId = await checkoutOneUnit(customerToken, productId, variantId);
    const createRes = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customerToken}`).send({ orderId });
    const { reference } = createRes.body.data;
    const transactionId = `tx-${suffix}-approved`;

    const event = buildTransactionEvent(reference, transactionId, "APPROVED");
    const res = await request(app).post("/api/payments/webhook/wompi").send(event);
    expect(res.status).toBe(200);

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    expect(order?.status).toBe("PAID");
    expect(order?.paymentStatus).toBe("APPROVED");

    const stockRow = await db.query.inventory.findFirst({ where: eq(inventory.variantId, variantId) });
    expect(stockRow?.stock).toBe(3); // 4 - 1

    const movement = await db.query.inventoryMovements.findFirst({ where: eq(inventoryMovements.orderId, orderId) });
    expect(movement?.type).toBe("SALE");
    expect(movement?.quantity).toBe(-1);
  });

  it("un webhook duplicado (misma transacción, mismo estado) es idempotente — no descuenta stock dos veces", async () => {
    const { productId, variantId } = await createProductWithStock("Producto Pago Duplicado", 4);
    const orderId = await checkoutOneUnit(customerToken, productId, variantId);
    const createRes = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customerToken}`).send({ orderId });
    const { reference } = createRes.body.data;

    const event = buildTransactionEvent(reference, `tx-${suffix}-dup`, "APPROVED");
    const first = await request(app).post("/api/payments/webhook/wompi").send(event);
    expect(first.status).toBe(200);
    const second = await request(app).post("/api/payments/webhook/wompi").send(event); // reentrega idéntica
    expect(second.status).toBe(200);

    const stockRow = await db.query.inventory.findFirst({ where: eq(inventory.variantId, variantId) });
    expect(stockRow?.stock).toBe(3); // sigue siendo 4 - 1, no 4 - 2

    const movements = await db.query.inventoryMovements.findMany({ where: eq(inventoryMovements.orderId, orderId) });
    expect(movements).toHaveLength(1);
  });

  it("un pago rechazado (DECLINED) no descuenta inventario", async () => {
    const { productId, variantId } = await createProductWithStock("Producto Pago Rechazado", 2);
    const orderId = await checkoutOneUnit(customerToken, productId, variantId);
    const createRes = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customerToken}`).send({ orderId });
    const { reference } = createRes.body.data;

    const event = buildTransactionEvent(reference, `tx-${suffix}-declined`, "DECLINED");
    const res = await request(app).post("/api/payments/webhook/wompi").send(event);
    expect(res.status).toBe(200);

    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    expect(order?.status).toBe("PENDING");
    expect(order?.paymentStatus).toBe("DECLINED");

    const stockRow = await db.query.inventory.findFirst({ where: eq(inventory.variantId, variantId) });
    expect(stockRow?.stock).toBe(2); // sin cambios
  });

  it("no permite pagar dos veces un pedido ya aprobado", async () => {
    const { productId, variantId } = await createProductWithStock("Producto Pago Repetido", 3);
    const orderId = await checkoutOneUnit(customerToken, productId, variantId);
    const createRes = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customerToken}`).send({ orderId });
    const event = buildTransactionEvent(createRes.body.data.reference, `tx-${suffix}-once`, "APPROVED");
    await request(app).post("/api/payments/webhook/wompi").send(event);

    const retry = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customerToken}`).send({ orderId });
    expect(retry.status).toBe(409);
    expect(retry.body.error.code).toBe("ORDER_ALREADY_PAID");
  });

  it("CONCURRENCIA: dos pagos aprobados casi al mismo tiempo por el último único stock nunca sobrevenden", async () => {
    const { productId, variantId } = await createProductWithStock("Producto Última Unidad", 1);

    const orderA = await checkoutOneUnit(customerToken, productId, variantId);
    const orderB = await checkoutOneUnit(customer2Token, productId, variantId);

    const payA = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customerToken}`).send({ orderId: orderA });
    const payB = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customer2Token}`).send({ orderId: orderB });

    const eventA = buildTransactionEvent(payA.body.data.reference, `tx-${suffix}-race-a`, "APPROVED");
    const eventB = buildTransactionEvent(payB.body.data.reference, `tx-${suffix}-race-b`, "APPROVED");

    // Ambos webhooks llegan PRÁCTICAMENTE al mismo tiempo — es exactamente
    // el escenario que el bloqueo de fila (FOR UPDATE) en payment.service.ts
    // debe resolver sin dejar el stock en negativo.
    const [resA, resB] = await Promise.all([
      request(app).post("/api/payments/webhook/wompi").send(eventA),
      request(app).post("/api/payments/webhook/wompi").send(eventB),
    ]);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const finalOrderA = await db.query.orders.findFirst({ where: eq(orders.id, orderA) });
    const finalOrderB = await db.query.orders.findFirst({ where: eq(orders.id, orderB) });
    const statuses = [finalOrderA?.status, finalOrderB?.status].sort();
    // Exactamente uno se pagó de verdad; el otro se cancela porque el stock
    // ya no alcanzaba (el pago quedó aprobado del lado de Wompi, pero el
    // pedido no se puede cumplir — requiere reembolso manual, ver
    // payment.service.ts).
    expect(statuses).toEqual(["CANCELLED", "PAID"]);

    const stockRow = await db.query.inventory.findFirst({ where: eq(inventory.variantId, variantId) });
    expect(stockRow?.stock).toBe(0); // nunca negativo, descontado exactamente una vez
  });
});
