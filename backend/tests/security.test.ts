import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app";
import { db, pool } from "../src/db/client";
import { users, categories, products, reviews, orders, orderItems, carts, auditLogs } from "../src/db/schema";
import { hashPassword } from "../src/utils/hash";
import { stripHtml } from "../src/utils/sanitize";

const app = createApp();
const suffix = Date.now();
const adminEmail = `sec-admin-${suffix}@example.com`;
const customerEmail = `sec-customer-${suffix}@example.com`;

let adminToken: string;
let customerToken: string;
let categoryId: string;
const productIds: string[] = [];

describe("Seguridad (Fase 14)", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword("Passw0rd1");
    await db.insert(users).values([
      { email: adminEmail, passwordHash, firstName: "Sec", lastName: "Admin", role: "ADMIN" },
      { email: customerEmail, passwordHash, firstName: "Sec", lastName: "Customer", role: "CUSTOMER" },
    ]);
    const adminLogin = await request(app).post("/api/auth/login").send({ email: adminEmail, password: "Passw0rd1" });
    adminToken = adminLogin.body.data.accessToken;
    const customerLogin = await request(app).post("/api/auth/login").send({ email: customerEmail, password: "Passw0rd1" });
    customerToken = customerLogin.body.data.accessToken;

    const [category] = await db.insert(categories).values({ name: `Cat Sec ${suffix}`, slug: `cat-sec-${suffix}` }).returning();
    categoryId = category.id;
  });

  afterAll(async () => {
    const product = productIds[0] ? await db.query.products.findFirst({ where: eq(products.id, productIds[0]) }) : null;
    if (product) {
      await db.delete(reviews).where(eq(reviews.productId, product.id));
      const order = await db.query.orders.findFirst({ where: eq(orders.orderNumber, `ORD-SEC-${suffix}`) });
      if (order) {
        await db.delete(orderItems).where(eq(orderItems.orderId, order.id));
        await db.delete(orders).where(eq(orders.id, order.id));
      }
    }
    for (const id of productIds) await db.delete(products).where(eq(products.id, id));
    await db.delete(categories).where(eq(categories.id, categoryId));
    const customer = await db.query.users.findFirst({ where: eq(users.email, customerEmail) });
    if (customer) await db.delete(carts).where(eq(carts.userId, customer.id));
    const admin = await db.query.users.findFirst({ where: eq(users.email, adminEmail) });
    if (admin) await db.delete(auditLogs).where(eq(auditLogs.userId, admin.id));
    await db.delete(users).where(eq(users.email, customerEmail));
    await db.delete(users).where(eq(users.email, adminEmail));
    await pool.end();
  });

  describe("Sanitización de texto libre (sanitize-html)", () => {
    it("stripHtml() elimina cualquier etiqueta de un texto, incluyendo <script>", () => {
      expect(stripHtml('<script>alert(1)</script>Hola <b>mundo</b>')).toBe("Hola mundo");
      expect(stripHtml("Texto normal sin HTML")).toBe("Texto normal sin HTML");
    });

    it("la descripción de un producto se guarda sin ninguna etiqueta HTML, aunque el admin la envíe con <script>", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: `Producto XSS ${suffix}`,
          description: '<script>alert("xss")</script>Descripción real <img src=x onerror=alert(1)>del producto.',
          price: 10000,
          sku: `XSS-${suffix}`,
          categoryId,
          stock: 5,
        });
      expect(res.status).toBe(201);
      productIds.push(res.body.data.id);
      expect(res.body.data.description).not.toContain("<script>");
      expect(res.body.data.description).not.toContain("<img");
      expect(res.body.data.description).toContain("Descripción real");
      expect(res.body.data.description).toContain("del producto.");
    });

    it("el comentario de una reseña se guarda sin ninguna etiqueta HTML", async () => {
      // Compra verificada real (Fase 13) para poder reseñar el producto de arriba.
      const product = await db.query.products.findFirst({ where: eq(products.id, productIds[0]), with: { variants: true } });
      const [order] = await db
        .insert(orders)
        .values({
          orderNumber: `ORD-SEC-${suffix}`,
          userId: (await db.query.users.findFirst({ where: eq(users.email, customerEmail) }))!.id,
          status: "PAID",
          subtotal: "10000",
          discountTotal: "0",
          shippingTotal: "0",
          taxTotal: "0",
          total: "10000",
          shippingMethod: "PICKUP",
          customerFirstName: "Sec",
          customerLastName: "Customer",
          customerEmail,
          customerPhone: "3000000000",
          addressSnapshot: { pickup: true },
          paymentStatus: "APPROVED",
        })
        .returning();
      await db.insert(orderItems).values({
        orderId: order.id,
        productId: product!.id,
        variantId: product!.variants[0]?.id ?? null,
        productNameSnapshot: product!.name,
        skuSnapshot: `XSS-${suffix}`,
        unitPrice: "10000",
        quantity: 1,
        subtotal: "10000",
      });

      const res = await request(app)
        .post("/api/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ productId: productIds[0], rating: 5, comment: '<script>alert(1)</script>Buen producto <b>de verdad</b>.' });
      expect(res.status).toBe(201);
      expect(res.body.data.comment).not.toContain("<script>");
      expect(res.body.data.comment).not.toContain("<b>");
      expect(res.body.data.comment).toContain("Buen producto");
    });
  });

  describe("Verificación de Origin en /auth/refresh (defensa CSRF adicional)", () => {
    it("rechaza con 403 un Origin que no está en la allowlist de CORS", async () => {
      const res = await request(app).post("/api/auth/refresh").set("Origin", "https://evil-site.example.com");
      expect(res.status).toBe(403);
    });

    it("rechaza con 403 cuando no hay Origin pero el Referer es de otro sitio", async () => {
      const res = await request(app).post("/api/auth/refresh").set("Referer", "https://evil-site.example.com/pagina");
      expect(res.status).toBe(403);
    });

    it("sin Origin ni Referer, sigue su curso normal (401 por falta de cookie, no 403 por origen)", async () => {
      const res = await request(app).post("/api/auth/refresh");
      expect(res.status).toBe(401);
    });

    it("con el Origin real del frontend configurado, la petición pasa el filtro de origen (no 403)", async () => {
      const res = await request(app).post("/api/auth/refresh").set("Origin", "http://localhost:5173");
      // Sin cookie válida en esta petición de prueba responde 401 (sesión), NUNCA 403 (origen).
      expect(res.status).toBe(401);
    });
  });

  describe("Rate limiting por cuenta en /auth/login (IP + correo)", () => {
    it("bloquea con 429 tras superar el límite de intentos contra UNA cuenta específica", async () => {
      const targetEmail = `sec-bruteforce-${suffix}@example.com`;
      let lastStatus = 0;
      for (let i = 0; i < 11; i++) {
        const res = await request(app).post("/api/auth/login").send({ email: targetEmail, password: "incorrecta-siempre" });
        lastStatus = res.status;
        if (lastStatus === 429) break;
      }
      expect(lastStatus).toBe(429);
    });
  });
});
