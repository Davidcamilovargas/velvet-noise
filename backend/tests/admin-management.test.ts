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
  shipments,
  reviews,
  coupons,
  auditLogs,
} from "../src/db/schema";
import { hashPassword } from "../src/utils/hash";
import { env } from "../src/config/env";

const app = createApp();
const suffix = Date.now();
const customerEmail = `admin-mgmt-customer-${suffix}@example.com`;
const adminEmail = `admin-mgmt-admin-${suffix}@example.com`;

let customerId: string;
let customerToken: string;
let adminToken: string;
let categoryId: string;
const productIds: string[] = [];
const orderIds: string[] = [];
const couponIds: string[] = [];

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
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name, description: "desc", price, sku: `${name.replace(/\s+/g, "-")}-${suffix}`, categoryId, stock, minStock });
  productIds.push(res.body.data.id);
  return { productId: res.body.data.id as string, variantId: res.body.data.variants[0].id as string };
}

async function createAndPayOrder(productId: string, variantId: string): Promise<string> {
  await request(app).post("/api/cart/items").set("Authorization", `Bearer ${customerToken}`).send({ productId, variantId, quantity: 1 });
  const orderRes = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ shippingMethod: "STANDARD", newAddress: { department: "Antioquia", city: "Medellín", addressLine: "Calle 1 #2-3", saveAddress: false }, customerPhone: "3001112233" });
  const orderId = orderRes.body.data.id as string;
  orderIds.push(orderId);
  const payRes = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customerToken}`).send({ orderId });
  await payOrder(orderId, payRes.body.data.reference, `tx-admgmt-${suffix}-${orderId.slice(0, 8)}`);
  return orderId;
}

describe("Panel administrativo: gestión (Fase 12)", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword("Passw0rd1");
    const [customer] = await db
      .insert(users)
      .values({ email: customerEmail, passwordHash, firstName: "Cliente", lastName: "Gestión", role: "CUSTOMER" })
      .returning();
    customerId = customer.id;
    const login = await request(app).post("/api/auth/login").send({ email: customerEmail, password: "Passw0rd1" });
    customerToken = login.body.data.accessToken;

    await db.insert(users).values({ email: adminEmail, passwordHash, firstName: "Admin", lastName: "Gestión", role: "ADMIN" });
    const adminLogin = await request(app).post("/api/auth/login").send({ email: adminEmail, password: "Passw0rd1" });
    adminToken = adminLogin.body.data.accessToken;

    const [category] = await db.insert(categories).values({ name: `Cat Admin ${suffix}`, slug: `cat-admin-${suffix}` }).returning();
    categoryId = category.id;
  });

  afterAll(async () => {
    await db.delete(reviews).where(eq(reviews.userId, customerId));
    for (const id of couponIds) {
      await db.delete(couponUsages).where(eq(couponUsages.couponId, id));
      await db.delete(coupons).where(eq(coupons.id, id));
    }
    for (const id of orderIds) {
      await db.delete(couponUsages).where(eq(couponUsages.orderId, id));
      await db.delete(inventoryMovements).where(eq(inventoryMovements.orderId, id));
      await db.delete(shipments).where(eq(shipments.orderId, id));
      await db.delete(payments).where(eq(payments.orderId, id));
      await db.delete(orders).where(eq(orders.id, id));
    }
    await db.delete(webhookEvents).where(eq(webhookEvents.provider, "WOMPI"));
    for (const id of productIds) {
      await db.delete(products).where(eq(products.id, id));
    }
    await db.delete(categories).where(eq(categories.id, categoryId));
    await db.delete(auditLogs).where(eq(auditLogs.userId, (await db.query.users.findFirst({ where: eq(users.email, adminEmail) }))!.id));
    await db.delete(carts).where(eq(carts.userId, customerId));
    await db.delete(users).where(eq(users.email, customerEmail));
    await db.delete(users).where(eq(users.email, adminEmail));
    await pool.end();
  });

  describe("Pedidos: cambio de estado admin", () => {
    it("rechaza transiciones inválidas y aplica las válidas, con auditoría", async () => {
      const { productId, variantId } = await createProductWithStock("Producto Estado Pedido", 10, 30000);
      const orderId = await createAndPayOrder(productId, variantId);

      // el pedido queda PAID tras el webhook -> intentar volver a PENDING debe fallar
      const invalid = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "PENDING" });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe("ORDER_STATUS_TRANSITION_INVALID");

      // transición válida PAID -> PROCESSING
      const toProcessing = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "PROCESSING" });
      expect(toProcessing.status).toBe(200);
      expect(toProcessing.body.data.status).toBe("PROCESSING");

      // PROCESSING -> SHIPPED con guía real: debe crear un registro de shipment
      const toShipped = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "SHIPPED", carrier: "Servientrega", trackingNumber: "SV123456" });
      expect(toShipped.status).toBe(200);
      expect(toShipped.body.data.shipments).toHaveLength(1);
      expect(toShipped.body.data.shipments[0]).toMatchObject({ carrier: "Servientrega", trackingNumber: "SV123456", status: "SHIPPED" });
      expect(toShipped.body.data.shipments[0].shippedAt).toBeTruthy();

      // no clientes/otros roles pueden cambiar el estado
      const asCustomer = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ status: "DELIVERED" });
      expect(asCustomer.status).toBe(403);

      // se registró en el log de auditoría
      const logs = await request(app).get("/api/admin/audit-logs?resource=order").set("Authorization", `Bearer ${adminToken}`);
      expect(logs.status).toBe(200);
      expect(logs.body.data.some((l: { resourceId: string }) => l.resourceId === orderId)).toBe(true);
    });

    it("devuelve el stock automáticamente al cancelar un pedido ya pagado", async () => {
      const { productId, variantId } = await createProductWithStock("Producto Cancelación Restock", 5, 20000);
      const orderId = await createAndPayOrder(productId, variantId);

      const invBefore = await db.query.inventory.findFirst({ where: eq(inventory.variantId, variantId) });
      expect(invBefore!.stock).toBe(4); // 5 - 1 vendido

      const cancel = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "CANCELLED", reason: "Cliente se arrepintió" });
      expect(cancel.status).toBe(200);
      expect(cancel.body.data.status).toBe("CANCELLED");

      const invAfter = await db.query.inventory.findFirst({ where: eq(inventory.variantId, variantId) });
      expect(invAfter!.stock).toBe(5); // se devolvió la unidad

      const movement = await db.query.inventoryMovements.findFirst({
        where: eq(inventoryMovements.orderId, orderId),
        orderBy: (m, { desc }) => desc(m.createdAt),
      });
      expect(movement?.type).toBe("RETURN");
    });
  });

  describe("Inventario", () => {
    it("lista inventario y ajusta stock con un delta auditable, sin permitir negativos", async () => {
      const { variantId } = await createProductWithStock("Producto Inventario Ajuste", 3, 10000, 5);
      const invRow = await db.query.inventory.findFirst({ where: eq(inventory.variantId, variantId) });

      const list = await request(app).get("/api/admin/inventory").set("Authorization", `Bearer ${adminToken}`);
      expect(list.status).toBe(200);
      expect(list.body.data.some((i: { id: string }) => i.id === invRow!.id)).toBe(true);

      // stock 3 <= min 5 -> debe aparecer en el filtro de stock bajo
      const lowStockList = await request(app).get("/api/admin/inventory?lowStockOnly=true").set("Authorization", `Bearer ${adminToken}`);
      expect(lowStockList.status).toBe(200);
      expect(lowStockList.body.data.some((i: { id: string }) => i.id === invRow!.id)).toBe(true);

      const tooMuch = await request(app)
        .patch(`/api/admin/inventory/${invRow!.id}/adjust`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ quantity: -10, reason: "Prueba de límite" });
      expect(tooMuch.status).toBe(400);
      expect(tooMuch.body.error.code).toBe("INVENTORY_NEGATIVE_STOCK");

      const adjust = await request(app)
        .patch(`/api/admin/inventory/${invRow!.id}/adjust`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ quantity: 7, reason: "Llegó mercancía nueva" });
      expect(adjust.status).toBe(200);
      expect(adjust.body.data.stock).toBe(10);

      const movements = await request(app)
        .get(`/api/admin/inventory/${invRow!.id}/movements`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(movements.status).toBe(200);
      expect(movements.body.data[0]).toMatchObject({ type: "ADJUSTMENT", quantity: 7 });
    });
  });

  describe("Clientes", () => {
    it("lista clientes con sus totales reales y permite desactivarlos (bloquea el login)", async () => {
      const list = await request(app).get("/api/admin/customers").set("Authorization", `Bearer ${adminToken}`);
      expect(list.status).toBe(200);
      const entry = list.body.data.find((c: { id: string }) => c.id === customerId);
      expect(entry).toBeTruthy();
      expect(entry.orderCount).toBeGreaterThanOrEqual(0);

      const detail = await request(app).get(`/api/admin/customers/${customerId}`).set("Authorization", `Bearer ${adminToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.email).toBe(customerEmail);
      expect(detail.body.data.orders.length).toBeGreaterThan(0);
      expect(detail.body.data.passwordHash).toBeUndefined();

      const deactivate = await request(app)
        .patch(`/api/admin/customers/${customerId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });
      expect(deactivate.status).toBe(200);
      expect(deactivate.body.data.isActive).toBe(false);

      const blockedLogin = await request(app).post("/api/auth/login").send({ email: customerEmail, password: "Passw0rd1" });
      expect(blockedLogin.status).toBe(403);

      // se reactiva para no romper el resto de la suite si algo más depende de este cliente
      const reactivate = await request(app)
        .patch(`/api/admin/customers/${customerId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: true });
      expect(reactivate.status).toBe(200);

      const allowedLogin = await request(app).post("/api/auth/login").send({ email: customerEmail, password: "Passw0rd1" });
      expect(allowedLogin.status).toBe(200);
      customerToken = allowedLogin.body.data.accessToken;
    });
  });

  describe("Configuración de la tienda", () => {
    it("devuelve valores por defecto y persiste actualizaciones reales", async () => {
      const before = await request(app).get("/api/admin/settings").set("Authorization", `Bearer ${adminToken}`);
      expect(before.status).toBe(200);
      expect(Number(before.body.data.taxPercentage)).toBe(19);

      const update = await request(app)
        .put("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ storeName: "Tienda de Prueba Admin", taxPercentage: 15, contactEmail: "soporte@tienda-prueba.test" });
      expect(update.status).toBe(200);
      expect(update.body.data.storeName).toBe("Tienda de Prueba Admin");
      expect(Number(update.body.data.taxPercentage)).toBe(15);

      const after = await request(app).get("/api/admin/settings").set("Authorization", `Bearer ${adminToken}`);
      expect(after.body.data.storeName).toBe("Tienda de Prueba Admin");

      // el carrito real ahora debe calcular impuestos con la nueva tasa configurada
      const { productId, variantId } = await createProductWithStock("Producto Tasa Nueva", 5, 100000);
      await request(app).post("/api/cart/items").set("Authorization", `Bearer ${customerToken}`).send({ productId, variantId, quantity: 1 });
      const cart = await request(app).get("/api/cart").set("Authorization", `Bearer ${customerToken}`);
      expect(cart.body.data.taxTotal).toBeCloseTo(100000 * 0.15, 5);

      // se restaura el 19% para no afectar el resto de la suite
      await request(app)
        .put("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ taxPercentage: 19 });
      await db.delete(carts).where(eq(carts.userId, customerId));
    });
  });

  describe("Reseñas", () => {
    it("un cliente crea una reseña (queda pendiente), un admin la aprueba y el promedio del producto se recalcula", async () => {
      const { productId, variantId } = await createProductWithStock("Producto Con Reseñas", 5, 20000);

      // Solo se puede reseñar un producto realmente comprado y pagado (ver
      // review.service.ts, Fase 13) — sin un pedido pagado de por medio,
      // POST /api/reviews rechaza con 400 VERIFIED_PURCHASE_REQUIRED.
      const noPurchase = await request(app)
        .post("/api/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ productId, rating: 5, comment: "No debería poder reseñar esto todavía." });
      expect(noPurchase.status).toBe(400);
      expect(noPurchase.body.error.code).toBe("VERIFIED_PURCHASE_REQUIRED");

      await createAndPayOrder(productId, variantId);

      const create = await request(app)
        .post("/api/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ productId, rating: 5, comment: "Excelente producto, superó mis expectativas." });
      expect(create.status).toBe(201);
      expect(create.body.data.isApproved).toBe(false);

      const duplicate = await request(app)
        .post("/api/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ productId, rating: 4, comment: "Repetido, no debería dejarse." });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe("REVIEW_ALREADY_EXISTS");

      const publicListBefore = await request(app).get(`/api/reviews?productId=${productId}`);
      expect(publicListBefore.body.data).toHaveLength(0); // todavía no aprobada, no es pública

      const pending = await request(app).get("/api/admin/reviews?status=pending").set("Authorization", `Bearer ${adminToken}`);
      expect(pending.body.data.some((r: { id: string }) => r.id === create.body.data.id)).toBe(true);

      const approve = await request(app)
        .patch(`/api/admin/reviews/${create.body.data.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isApproved: true });
      expect(approve.status).toBe(200);

      const publicListAfter = await request(app).get(`/api/reviews?productId=${productId}`);
      expect(publicListAfter.body.data).toHaveLength(1);
      expect(publicListAfter.body.data[0].authorName).toMatch(/^Cliente G\.$/);

      const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
      expect(Number(product!.ratingAverage)).toBe(5);
      expect(product!.ratingCount).toBe(1);
    });
  });

  describe("Cupones: edición admin", () => {
    it("permite editar un cupón existente (PUT)", async () => {
      const now = new Date();
      const inAWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const create = await request(app)
        .post("/api/coupons")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: `EDIT${suffix}`,
          discountType: "PERCENTAGE",
          percentage: 10,
          startsAt: now.toISOString(),
          expiresAt: inAWeek.toISOString(),
        });
      expect(create.status).toBe(201);
      couponIds.push(create.body.data.id);

      const update = await request(app)
        .put(`/api/coupons/${create.body.data.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ percentage: 25, maxUsesPerUser: 2 });
      expect(update.status).toBe(200);
      expect(Number(update.body.data.percentage)).toBe(25);
      expect(update.body.data.maxUsesPerUser).toBe(2);
    });
  });
});
