import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app";
import { db, pool } from "../src/db/client";
import { users, categories, products, auditLogs } from "../src/db/schema";
import { hashPassword } from "../src/utils/hash";

const app = createApp();
const suffix = Date.now();
const adminEmail = `admin-test-${suffix}@example.com`;
const customerEmail = `customer-test-${suffix}@example.com`;

let adminToken: string;
let customerToken: string;
let categoryId: string;

describe("Catálogo (productos y categorías)", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword("Passw0rd1");
    await db.insert(users).values([
      { email: adminEmail, passwordHash, firstName: "Admin", lastName: "Test", role: "ADMIN" },
      { email: customerEmail, passwordHash, firstName: "Cust", lastName: "Test", role: "CUSTOMER" },
    ]);

    const adminLogin = await request(app).post("/api/auth/login").send({ email: adminEmail, password: "Passw0rd1" });
    adminToken = adminLogin.body.data.accessToken;
    const customerLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: customerEmail, password: "Passw0rd1" });
    customerToken = customerLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await db.delete(products).where(eq(products.sku, `TEST-SKU-${suffix}`));
    if (categoryId) await db.delete(categories).where(eq(categories.id, categoryId));
    // Ver comentario equivalente en cart.test.ts: crear/editar/borrar
    // productos y categorías como admin dejó registros de auditoría (Fase 12).
    const productsAdmin = await db.query.users.findFirst({ where: eq(users.email, adminEmail) });
    if (productsAdmin) await db.delete(auditLogs).where(eq(auditLogs.userId, productsAdmin.id));
    await db.delete(users).where(eq(users.email, adminEmail));
    await db.delete(users).where(eq(users.email, customerEmail));
    await pool.end();
  });

  it("no permite crear categorías sin ser admin", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ name: `Categoría Test ${suffix}` });
    expect(res.status).toBe(403);
  });

  it("permite a un admin crear una categoría", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Categoría Test ${suffix}` });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toContain("categoria-test");
    categoryId = res.body.data.id;
  });

  it("crea un producto con variantes y calcula el stock agregado", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Producto Test ${suffix}`,
        description: "Descripción de prueba",
        price: 50000,
        sku: `TEST-SKU-${suffix}`,
        categoryId,
        variants: [
          { color: "Rojo", stock: 4 },
          { color: "Verde", stock: 6 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.variants).toHaveLength(2);
    expect(res.body.data.stock).toBe(10);
  });

  it("rechaza precio negativo o cero con 422", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Inválido", description: "x", price: -5, categoryId });
    expect(res.status).toBe(422);
  });

  it("encuentra el producto por búsqueda insensible a mayúsculas", async () => {
    const res = await request(app).get(`/api/products?search=${encodeURIComponent("producto test")}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((p: { sku: string }) => p.sku === `TEST-SKU-${suffix}`)).toBe(true);
  });

  it("filtra por categoría usando el slug", async () => {
    const category = await db.query.categories.findFirst({ where: eq(categories.id, categoryId) });
    const res = await request(app).get(`/api/products?category=${category?.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((p: { categoryId: string }) => p.categoryId === categoryId)).toBe(true);
  });

  it("devuelve 404 al pedir un producto que no existe", async () => {
    const res = await request(app).get("/api/products/producto-que-no-existe-xyz");
    expect(res.status).toBe(404);
  });

  it("un cliente sin rol admin no puede desactivar productos", async () => {
    const product = await db.query.products.findFirst({ where: eq(products.sku, `TEST-SKU-${suffix}`) });
    const res = await request(app)
      .patch(`/api/products/${product?.id}/status`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(403);
  });
});
