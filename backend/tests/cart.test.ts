import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app";
import { db, pool } from "../src/db/client";
import { users, categories, products, coupons, carts, auditLogs } from "../src/db/schema";
import { hashPassword } from "../src/utils/hash";

const app = createApp();
const suffix = Date.now();
const customerEmail = `cart-customer-${suffix}@example.com`;

let customerToken: string;
let categoryId: string;
let productId: string;
let variantId: string;
let couponId: string;

describe("Carrito y cupones", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword("Passw0rd1");
    await db.insert(users).values({ email: customerEmail, passwordHash, firstName: "Cart", lastName: "Test", role: "CUSTOMER" });

    const login = await request(app).post("/api/auth/login").send({ email: customerEmail, password: "Passw0rd1" });
    customerToken = login.body.data.accessToken;

    const [category] = await db.insert(categories).values({ name: `Cat Cart ${suffix}`, slug: `cat-cart-${suffix}` }).returning();
    categoryId = category.id;

    const productRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${await adminToken()}`)
      .send({
        name: `Producto Carrito ${suffix}`,
        description: "desc",
        price: 10000,
        sku: `CART-SKU-${suffix}`,
        categoryId,
        stock: 3,
      });
    productId = productRes.body.data.id;
    variantId = productRes.body.data.variants[0].id;

    const [coupon] = await db
      .insert(coupons)
      .values({
        code: `CART${suffix}`,
        discountType: "FIXED",
        fixedAmount: "5000",
        startsAt: new Date(Date.now() - 86400000),
        expiresAt: new Date(Date.now() + 86400000),
        maxUsesPerUser: 1,
      })
      .returning();
    couponId = coupon.id;
  });

  async function adminToken(): Promise<string> {
    const adminEmail = `cart-admin-${suffix}@example.com`;
    const passwordHash = await hashPassword("Passw0rd1");
    const existing = await db.query.users.findFirst({ where: eq(users.email, adminEmail) });
    if (!existing) {
      await db.insert(users).values({ email: adminEmail, passwordHash, firstName: "A", lastName: "B", role: "ADMIN" });
    }
    const res = await request(app).post("/api/auth/login").send({ email: adminEmail, password: "Passw0rd1" });
    return res.body.data.accessToken;
  }

  afterAll(async () => {
    const customer = await db.query.users.findFirst({ where: eq(users.email, customerEmail) });
    if (customer) await db.delete(carts).where(eq(carts.userId, customer.id));
    await db.delete(coupons).where(eq(coupons.id, couponId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(categories).where(eq(categories.id, categoryId));
    await db.delete(users).where(eq(users.email, customerEmail));
    // Crear el producto/cupón de arriba como admin dejó registros de
    // auditoría (Fase 12) que referencian a este usuario — hay que borrarlos
    // antes de poder borrar al usuario (audit_logs.user_id no tiene CASCADE
    // a propósito: un registro de auditoría real nunca debería desaparecer
    // solo porque el usuario se borra).
    const cartAdmin = await db.query.users.findFirst({ where: eq(users.email, `cart-admin-${suffix}@example.com`) });
    if (cartAdmin) await db.delete(auditLogs).where(eq(auditLogs.userId, cartAdmin.id));
    await db.delete(users).where(eq(users.email, `cart-admin-${suffix}@example.com`));
    await pool.end();
  });

  it("rechaza acceso al carrito sin autenticación", async () => {
    const res = await request(app).get("/api/cart");
    expect(res.status).toBe(401);
  });

  it("empieza con un carrito vacío", async () => {
    const res = await request(app).get("/api/cart").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it("agrega un producto al carrito", async () => {
    const res = await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ productId, variantId, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.subtotal).toBe(20000);
  });

  it("rechaza agregar más unidades de las disponibles (stock=3)", async () => {
    const res = await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ productId, variantId, quantity: 10 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("actualiza la cantidad de un ítem", async () => {
    const cart = await request(app).get("/api/cart").set("Authorization", `Bearer ${customerToken}`);
    const itemId = cart.body.data.items[0].id;
    const res = await request(app)
      .put(`/api/cart/items/${itemId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ quantity: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data.items[0].quantity).toBe(3);
  });

  it("aplica un cupón fijo y recalcula el total", async () => {
    const res = await request(app)
      .post("/api/cart/coupon")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ code: `cart${suffix}` }); // minúsculas a propósito: debe normalizar
    expect(res.status).toBe(200);
    expect(res.body.data.discountTotal).toBe(5000);
  });

  it("rechaza un cupón inexistente", async () => {
    const res = await request(app)
      .post("/api/cart/coupon")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ code: "NOEXISTE123" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("COUPON_NOT_FOUND");
  });

  it("elimina un ítem del carrito", async () => {
    const cart = await request(app).get("/api/cart").set("Authorization", `Bearer ${customerToken}`);
    const itemId = cart.body.data.items[0].id;
    const res = await request(app).delete(`/api/cart/items/${itemId}`).set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });
});
