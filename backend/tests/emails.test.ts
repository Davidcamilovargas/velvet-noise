import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";

// `sendEmail` real (Resend) se reemplaza por un espía en esta suite: lo que
// se verifica aquí es que cada flujo de negocio dispara el correo correcto
// con el destinatario correcto — no la entrega real, que depende de una
// EMAIL_API_KEY que este entorno no tiene (mismo tipo de límite documentado
// para Wompi en payment.test.ts). `sendEmail` en sí (jobs/email.service.ts)
// ya es código real, no un mock — aquí solo se aísla la llamada de red.
vi.mock("../src/jobs/email.service", () => ({ sendEmail: vi.fn(async () => undefined) }));

import { createApp } from "../src/app";
import { db, pool } from "../src/db/client";
import { users, categories, products, carts, orders, couponUsages, inventoryMovements, payments, webhookEvents, auditLogs, reviews, shipments } from "../src/db/schema";
import { hashPassword } from "../src/utils/hash";
import { env } from "../src/config/env";
import { sendEmail } from "../src/jobs/email.service";

const mockSendEmail = sendEmail as unknown as ReturnType<typeof vi.fn>;

const app = createApp();
const suffix = Date.now();
const customerEmail = `email-customer-${suffix}@example.com`;
const adminEmail = `email-admin-${suffix}@example.com`;

let customerToken: string;
let adminAccessToken: string;
let categoryId: string;
const productIds: string[] = [];
const orderIds: string[] = [];

function subjectsSentTo(email: string): string[] {
  return mockSendEmail.mock.calls.filter((call) => call[0]?.to === email).map((call) => call[0]?.subject as string);
}

function signWompiEvent(properties: string[], data: Record<string, unknown>, timestamp: number): string {
  function getByPath(obj: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) return (acc as Record<string, unknown>)[key];
      return undefined;
    }, obj);
  }
  const concatenated = properties.map((p) => String(getByPath(data, p) ?? "")).join("");
  return crypto.createHash("sha256").update(`${concatenated}${timestamp}${env.WOMPI_EVENTS_SECRET}`).digest("hex");
}

function buildTransactionEvent(reference: string, transactionId: string, status: string) {
  const timestamp = Date.now();
  const data = { transaction: { id: transactionId, status, reference, amount_in_cents: 3000000 } };
  const properties = ["transaction.id", "transaction.status", "transaction.reference"];
  return { event: "transaction.updated", data, signature: { properties, checksum: signWompiEvent(properties, data, timestamp) }, timestamp, environment: "test" };
}

describe("Correos transaccionales (Fase 13)", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword("Passw0rd1");
    await db.insert(users).values({ email: adminEmail, passwordHash, firstName: "Email", lastName: "Admin", role: "ADMIN" });
    const adminLogin = await request(app).post("/api/auth/login").send({ email: adminEmail, password: "Passw0rd1" });
    adminAccessToken = adminLogin.body.data.accessToken;

    const [category] = await db.insert(categories).values({ name: `Cat Email ${suffix}`, slug: `cat-email-${suffix}` }).returning();
    categoryId = category.id;

    const productRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ name: `Producto Email ${suffix}`, description: "desc", price: 30000, sku: `EMAIL-${suffix}`, categoryId, stock: 5 });
    productIds.push(productRes.body.data.id);
  });

  beforeEach(() => {
    mockSendEmail.mockClear();
  });

  afterAll(async () => {
    // Las reseñas quedan asociadas a un pedido real (Fase 13: compra
    // verificada) — hay que borrarlas antes que los pedidos, igual que
    // couponUsages/inventoryMovements/payments, o la FK de reviews.order_id
    // rechaza el delete de orders.
    const product = await db.query.products.findFirst({ where: eq(products.id, productIds[0]) });
    if (product) await db.delete(reviews).where(eq(reviews.productId, product.id));

    for (const id of orderIds) {
      await db.delete(shipments).where(eq(shipments.orderId, id));
      await db.delete(couponUsages).where(eq(couponUsages.orderId, id));
      await db.delete(inventoryMovements).where(eq(inventoryMovements.orderId, id));
      await db.delete(payments).where(eq(payments.orderId, id));
      await db.delete(orders).where(eq(orders.id, id));
    }
    await db.delete(webhookEvents).where(eq(webhookEvents.provider, "WOMPI"));
    for (const id of productIds) await db.delete(products).where(eq(products.id, id));
    await db.delete(categories).where(eq(categories.id, categoryId));
    const customer = await db.query.users.findFirst({ where: eq(users.email, customerEmail) });
    if (customer) await db.delete(carts).where(eq(carts.userId, customer.id));
    await db.delete(auditLogs).where(eq(auditLogs.userId, (await db.query.users.findFirst({ where: eq(users.email, adminEmail) }))!.id));
    await db.delete(users).where(eq(users.email, customerEmail));
    await db.delete(users).where(eq(users.email, adminEmail));
    await pool.end();
  });

  it("envía el correo de bienvenida real al registrarse", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: customerEmail, password: "Passw0rd1", firstName: "Cliente", lastName: "Correo" });
    expect(res.status).toBe(201);
    customerToken = res.body.data.accessToken;

    expect(subjectsSentTo(customerEmail)).toEqual(expect.arrayContaining([expect.stringContaining("Bienvenido")]));
  });

  it("envía el correo de recuperación de contraseña con el enlace real", async () => {
    mockSendEmail.mockClear();
    const res = await request(app).post("/api/auth/forgot-password").send({ email: customerEmail });
    expect(res.status).toBe(200);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe(customerEmail);
    expect(call.html).toContain("/reset-password/");
  });

  it("no envía correo de recuperación para un correo no registrado (no revela si existe)", async () => {
    mockSendEmail.mockClear();
    await request(app).post("/api/auth/forgot-password").send({ email: `no-existe-${suffix}@example.com` });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("ciclo de vida completo de un pedido: confirmación -> pago aprobado -> enviado -> entregado, cada uno con su correo real", async () => {
    mockSendEmail.mockClear();
    const productId = productIds[0];
    const variantRes = await request(app).get(`/api/products/${productId}`);
    const variantId = variantRes.body.data.variants[0].id as string;

    await request(app).post("/api/cart/items").set("Authorization", `Bearer ${customerToken}`).send({ productId, variantId, quantity: 1 });
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingMethod: "PICKUP", customerPhone: "3001112233" });
    const orderId = orderRes.body.data.id as string;
    orderIds.push(orderId);

    // 1. Confirmación de pedido (PENDING) — sale inmediatamente al crearlo.
    expect(subjectsSentTo(customerEmail)).toEqual(expect.arrayContaining([expect.stringContaining("Recibimos tu pedido")]));

    // 2. Pago aprobado real vía webhook firmado (mismo mecanismo que payment.test.ts).
    mockSendEmail.mockClear();
    const payRes = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customerToken}`).send({ orderId });
    const reference = payRes.body.data.reference as string;
    const webhookRes = await request(app)
      .post("/api/payments/webhook/wompi")
      .send(buildTransactionEvent(reference, `tx-email-${suffix}`, "APPROVED"));
    expect(webhookRes.status).toBe(200);
    expect(subjectsSentTo(customerEmail)).toEqual(expect.arrayContaining([expect.stringContaining("Pago aprobado")]));

    // 3. Admin marca el pedido como enviado, con guía real.
    mockSendEmail.mockClear();
    const shipRes = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "SHIPPED", carrier: "Servientrega", trackingNumber: "SV123456" });
    expect(shipRes.status).toBe(200);
    const shippedCall = mockSendEmail.mock.calls.find((c) => c[0]?.to === customerEmail);
    expect(shippedCall?.[0]?.subject).toContain("enviado");
    expect(shippedCall?.[0]?.html).toContain("SV123456");

    // 4. Admin marca el pedido como entregado.
    mockSendEmail.mockClear();
    const deliverRes = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ status: "DELIVERED" });
    expect(deliverRes.status).toBe(200);
    expect(subjectsSentTo(customerEmail)).toEqual(expect.arrayContaining([expect.stringContaining("entregado")]));
  });

  it("envía el correo de pago rechazado cuando el webhook llega DECLINED", async () => {
    const productId = productIds[0];
    const variantRes = await request(app).get(`/api/products/${productId}`);
    const variantId = variantRes.body.data.variants[0].id as string;

    await request(app).post("/api/cart/items").set("Authorization", `Bearer ${customerToken}`).send({ productId, variantId, quantity: 1 });
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingMethod: "PICKUP", customerPhone: "3001112233" });
    const orderId = orderRes.body.data.id as string;
    orderIds.push(orderId);

    mockSendEmail.mockClear();
    const payRes = await request(app).post("/api/payments/create").set("Authorization", `Bearer ${customerToken}`).send({ orderId });
    const reference = payRes.body.data.reference as string;
    await request(app).post("/api/payments/webhook/wompi").send(buildTransactionEvent(reference, `tx-email-declined-${suffix}`, "DECLINED"));

    expect(subjectsSentTo(customerEmail)).toEqual(expect.arrayContaining([expect.stringContaining("No pudimos procesar tu pago")]));
  });

  it("envía el correo de reseña aprobada solo en la transición pendiente -> aprobada", async () => {
    const reviewRes = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ productId: productIds[0], rating: 5, comment: "Excelente producto de prueba." });
    expect(reviewRes.status).toBe(201);
    const reviewId = reviewRes.body.data.id as string;

    mockSendEmail.mockClear();
    const approveRes = await request(app)
      .patch(`/api/admin/reviews/${reviewId}/status`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isApproved: true });
    expect(approveRes.status).toBe(200);
    expect(subjectsSentTo(customerEmail)).toEqual(expect.arrayContaining([expect.stringContaining("ya es pública")]));

    // Aprobar de nuevo una reseña que ya estaba aprobada no debe reenviar el correo.
    mockSendEmail.mockClear();
    await request(app).patch(`/api/admin/reviews/${reviewId}/status`).set("Authorization", `Bearer ${adminAccessToken}`).send({ isApproved: true });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("envía el correo de cuenta desactivada cuando un admin desactiva a un cliente", async () => {
    const customer = await db.query.users.findFirst({ where: eq(users.email, customerEmail) });
    mockSendEmail.mockClear();
    const res = await request(app)
      .patch(`/api/admin/customers/${customer!.id}/status`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(subjectsSentTo(customerEmail)).toEqual(expect.arrayContaining([expect.stringContaining("desactivada")]));

    // Reactivar para no dejar la cuenta de prueba inutilizable si algo más la necesitara.
    await db.update(users).set({ isActive: true }).where(eq(users.id, customer!.id));
  });
});
