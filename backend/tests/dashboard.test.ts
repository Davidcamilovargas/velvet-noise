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
  inventoryMovements,
  payments,
  webhookEvents,
  auditLogs,
} from "../src/db/schema";
import { hashPassword } from "../src/utils/hash";
import { env } from "../src/config/env";

const app = createApp();
const suffix = Date.now();
const customerEmail = `dash-customer-${suffix}@example.com`;

let customerToken: string;
let adminAuthToken: string;
let categoryId: string;
const productIds: string[] = [];
const orderIds: string[] = [];

async function adminToken(): Promise<string> {
  const adminEmail = `dash-admin-${suffix}@example.com`;
  const passwordHash = await hashPassword("Passw0rd1");
  const existing = await db.query.users.findFirst({ where: eq(users.email, adminEmail) });
  if (!existing) {
    await db.insert(users).values({ email: adminEmail, passwordHash, firstName: "A", lastName: "B", role: "ADMIN" });
  }
  const res = await request(app).post("/api/auth/login").send({ email: adminEmail, password: "Passw0rd1" });
  return res.body.data.accessToken;
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function signWompiEvent(properties: string[], data: Record<string, unknown>, timestamp: number): string {
  const concatenated = properties.map((p) => String(getByPath(data, p) ?? "")).join("");
  return crypto.createHash("sha256").update(`${concatenated}${timestamp}${env.WOMPI_EVENTS_SECRET}`).digest("hex");
}

async function payOrder(orderId: string, reference: string, transactionId: string): Promise<void> {
  const timestamp = Date.now();
  const data = { transaction: { id: transactionId, status: "APPROVED", reference } };
  const properties = ["transaction.id", "transaction.status", "transaction.reference"];
  const event = { event: "transaction.updated", data, signature: { properties, checksum: signWompiEvent(properties, data, timestamp) }, timestamp };
  const res = await request(app).post("/api/payments/webhook/wompi").send(event);
  expect(res.status).toBe(200);
}

async function createProductWithStock(name: string, stock: number, price: number, minStock = 5) {
  const res = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${adminAuthToken}`)
    .send({ name, description: "desc", price, sku: `${name.replace(/\s+/g, "-")}-${suffix}`, categoryId, stock, minStock });
  productIds.push(res.body.data.id);
  return { productId: res.body.data.id as string, variantId: res.body.data.variants[0].id as string };
}

async function createAndPayOrder(productId: string, variantId: string): Promise<string> {
  await request(app).post("/api/cart/items").set("Authorization", `Bearer ${customerToken}`).send({ productId, variantId, quantity: 1 });
  const orderRes = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ shippingMethod: "PICKUP", customerPhone: "3001112233" });
  const orderId = orderRes.body.data.id as string;
  orderIds.push(orderId);
  const payRes = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customerToken}`).send({ orderId });
  await payOrder(orderId, payRes.body.data.reference, `tx-dash-${suffix}-${orderId.slice(0, 8)}`);
  return orderId;
}

describe("Dashboard administrativo (Fase 11)", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword("Passw0rd1");
    await db.insert(users).values({ email: customerEmail, passwordHash, firstName: "Dash", lastName: "Test", role: "CUSTOMER" });
    const login = await request(app).post("/api/auth/login").send({ email: customerEmail, password: "Passw0rd1" });
    customerToken = login.body.data.accessToken;
    adminAuthToken = await adminToken();

    const [category] = await db.insert(categories).values({ name: `Cat Dash ${suffix}`, slug: `cat-dash-${suffix}` }).returning();
    categoryId = category.id;
  });

  afterAll(async () => {
    for (const id of orderIds) {
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
    const customer = await db.query.users.findFirst({ where: eq(users.email, customerEmail) });
    if (customer) await db.delete(carts).where(eq(carts.userId, customer.id));
    await db.delete(users).where(eq(users.email, customerEmail));
    // Ver comentario equivalente en cart.test.ts: los productos creados como
    // admin dejaron registros de auditoría (Fase 12).
    const dashAdmin = await db.query.users.findFirst({ where: eq(users.email, `dash-admin-${suffix}@example.com`) });
    if (dashAdmin) await db.delete(auditLogs).where(eq(auditLogs.userId, dashAdmin.id));
    await db.delete(users).where(eq(users.email, `dash-admin-${suffix}@example.com`));
    await pool.end();
  });

  it("rechaza acceso sin autenticación y sin rol ADMIN", async () => {
    const noAuth = await request(app).get("/api/admin/dashboard");
    expect(noAuth.status).toBe(401);

    const asCustomer = await request(app).get("/api/admin/dashboard").set("Authorization", `Bearer ${customerToken}`);
    expect(asCustomer.status).toBe(403);
  });

  it("refleja pedidos reales pagados: ingresos, conteos y top de productos", async () => {
    const before = await request(app).get("/api/admin/dashboard").set("Authorization", `Bearer ${adminAuthToken}`);
    const revenueBefore = before.body.data.totalRevenue;
    const ordersBefore = before.body.data.totalOrders;

    const { productId, variantId } = await createProductWithStock("Producto Dashboard Top", 10, 40000);
    await createAndPayOrder(productId, variantId);
    await createAndPayOrder(productId, variantId); // segundo pedido del mismo producto -> debe sumar en topProducts

    // un tercer pedido que se queda SIN pagar (paymentStatus PENDING)
    await request(app).post("/api/cart/items").set("Authorization", `Bearer ${customerToken}`).send({ productId, variantId, quantity: 1 });
    const pendingOrderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingMethod: "PICKUP", customerPhone: "3001112233" });
    orderIds.push(pendingOrderRes.body.data.id);

    const after = await request(app).get("/api/admin/dashboard").set("Authorization", `Bearer ${adminAuthToken}`);
    expect(after.status).toBe(200);
    const summary = after.body.data;

    // 2 pedidos pagados de 40.000 + 19% de impuesto (store_settings.taxPercentage por defecto) + envío $0 (PICKUP)
    expect(summary.totalRevenue - revenueBefore).toBeCloseTo(2 * 40000 * 1.19, 5);
    expect(summary.totalOrders - ordersBefore).toBe(3);
    expect(summary.pendingPaymentOrders).toBeGreaterThanOrEqual(1);

    const topEntry = summary.topProducts.find((p: { productId: string }) => p.productId === productId);
    expect(topEntry).toBeTruthy();
    expect(topEntry.quantitySold).toBeGreaterThanOrEqual(2);

    const recentIds = summary.recentOrders.map((o: { id: string }) => o.id);
    expect(orderIds.some((id) => recentIds.includes(id))).toBe(true);

    // la serie de los últimos 14 días debe incluir hoy con al menos las ventas de arriba
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayEntry = summary.salesLast14Days.find((d: { date: string }) => d.date === todayKey);
    expect(todayEntry).toBeTruthy();
    expect(todayEntry.total).toBeGreaterThanOrEqual(2 * 40000 * 1.19 - 1);
  });

  it("marca productos con stock bajo o igual al mínimo configurado", async () => {
    const { variantId } = await createProductWithStock("Producto Stock Bajo", 2, 15000, 5);

    const res = await request(app).get("/api/admin/dashboard").set("Authorization", `Bearer ${adminAuthToken}`);
    const lowStockEntry = res.body.data.lowStockItems.find((i: { variantId: string }) => i.variantId === variantId);
    expect(lowStockEntry).toBeTruthy();
    expect(lowStockEntry.stock).toBe(2);
  });
});
