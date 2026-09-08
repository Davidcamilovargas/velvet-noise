import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app";
import { db, pool } from "../src/db/client";
import { users, categories, products, coupons, carts, orders, addresses, inventory, couponUsages, auditLogs } from "../src/db/schema";
import { hashPassword } from "../src/utils/hash";

const app = createApp();
const suffix = Date.now();
const customerEmail = `checkout-customer-${suffix}@example.com`;
const otherEmail = `checkout-other-${suffix}@example.com`;

let customerToken: string;
let otherToken: string;
let categoryId: string;
let productId: string;
let variantId: string;
let couponId: string;
let addressId: string;
const createdOrderIds: string[] = [];

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: "Passw0rd1" });
  return res.body.data.accessToken;
}

async function adminToken(): Promise<string> {
  const adminEmail = `checkout-admin-${suffix}@example.com`;
  const passwordHash = await hashPassword("Passw0rd1");
  const existing = await db.query.users.findFirst({ where: eq(users.email, adminEmail) });
  if (!existing) {
    await db.insert(users).values({ email: adminEmail, passwordHash, firstName: "A", lastName: "B", role: "ADMIN" });
  }
  return login(adminEmail);
}

describe("Checkout (direcciones, envío, pedidos)", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword("Passw0rd1");
    await db
      .insert(users)
      .values([
        { email: customerEmail, passwordHash, firstName: "Checkout", lastName: "Test", phone: "3001234567", role: "CUSTOMER" },
        { email: otherEmail, passwordHash, firstName: "Otro", lastName: "Usuario", role: "CUSTOMER" },
      ]);

    customerToken = await login(customerEmail);
    otherToken = await login(otherEmail);

    const [category] = await db.insert(categories).values({ name: `Cat Checkout ${suffix}`, slug: `cat-checkout-${suffix}` }).returning();
    categoryId = category.id;

    const productRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${await adminToken()}`)
      .send({
        name: `Producto Checkout ${suffix}`,
        description: "desc",
        price: 50000,
        sku: `CHECKOUT-SKU-${suffix}`,
        categoryId,
        stock: 5,
      });
    productId = productRes.body.data.id;
    variantId = productRes.body.data.variants[0].id;

    const [coupon] = await db
      .insert(coupons)
      .values({
        code: `CHECKOUT${suffix}`,
        discountType: "FIXED",
        fixedAmount: "10000",
        startsAt: new Date(Date.now() - 86400000),
        expiresAt: new Date(Date.now() + 86400000),
        maxUsesPerUser: 1,
      })
      .returning();
    couponId = coupon.id;
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      // coupon_usages.orderId no tiene ON DELETE CASCADE (a propósito: un
      // pedido real nunca se borra, solo cambia de estado) — en la prueba sí
      // borramos filas, así que hay que limpiar la referencia primero.
      await db.delete(couponUsages).where(eq(couponUsages.orderId, id));
      await db.delete(orders).where(eq(orders.id, id));
    }
    const customer = await db.query.users.findFirst({ where: eq(users.email, customerEmail) });
    if (customer) {
      await db.delete(carts).where(eq(carts.userId, customer.id));
      await db.delete(addresses).where(eq(addresses.userId, customer.id));
    }
    const other = await db.query.users.findFirst({ where: eq(users.email, otherEmail) });
    if (other) await db.delete(carts).where(eq(carts.userId, other.id));

    await db.delete(coupons).where(eq(coupons.id, couponId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(categories).where(eq(categories.id, categoryId));
    await db.delete(users).where(eq(users.email, customerEmail));
    await db.delete(users).where(eq(users.email, otherEmail));
    // Ver comentario equivalente en cart.test.ts: los productos/cupones
    // creados como admin dejaron registros de auditoría (Fase 12).
    const checkoutAdmin = await db.query.users.findFirst({ where: eq(users.email, `checkout-admin-${suffix}@example.com`) });
    if (checkoutAdmin) await db.delete(auditLogs).where(eq(auditLogs.userId, checkoutAdmin.id));
    await db.delete(users).where(eq(users.email, `checkout-admin-${suffix}@example.com`));
    await pool.end();
  });

  // --- DIRECCIONES ---------------------------------------------------------

  it("rechaza acceso a direcciones sin autenticación", async () => {
    const res = await request(app).get("/api/addresses");
    expect(res.status).toBe(401);
  });

  it("crea una dirección y la marca como predeterminada automáticamente (es la primera)", async () => {
    const res = await request(app)
      .post("/api/addresses")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ label: "Casa", department: "Antioquia", city: "Medellín", addressLine: "Cra 1 # 2-3" });
    expect(res.status).toBe(201);
    expect(res.body.data.isDefault).toBe(true);
    addressId = res.body.data.id;
  });

  it("una segunda dirección marcada como predeterminada desmarca la primera", async () => {
    const res = await request(app)
      .post("/api/addresses")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ label: "Oficina", department: "Antioquia", city: "Medellín", addressLine: "Calle 4 # 5-6", isDefault: true });
    expect(res.status).toBe(201);
    expect(res.body.data.isDefault).toBe(true);

    const list = await request(app).get("/api/addresses").set("Authorization", `Bearer ${customerToken}`);
    const original = list.body.data.find((a: { id: string }) => a.id === addressId);
    expect(original.isDefault).toBe(false);

    // limpieza: deja solo `addressId` para el resto de las pruebas
    await request(app).delete(`/api/addresses/${res.body.data.id}`).set("Authorization", `Bearer ${customerToken}`);
  });

  // --- MÉTODOS DE ENVÍO ------------------------------------------------------

  it("lista los métodos de envío disponibles (público, sin autenticación)", async () => {
    const res = await request(app).get("/api/shipping-methods");
    expect(res.status).toBe(200);
    const methods = res.body.data.map((m: { method: string }) => m.method);
    expect(methods).toEqual(expect.arrayContaining(["STANDARD", "EXPRESS", "PICKUP"]));
  });

  // --- CREACIÓN DE PEDIDOS ---------------------------------------------------

  it("rechaza crear un pedido con el carrito vacío", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingMethod: "STANDARD", addressId, customerPhone: "3001234567" });
    expect(res.status).toBe(400);
  });

  it("rechaza envío STANDARD sin dirección", async () => {
    await request(app).post("/api/cart/items").set("Authorization", `Bearer ${customerToken}`).send({ productId, variantId, quantity: 1 });
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingMethod: "STANDARD", customerPhone: "3001234567" });
    expect(res.status).toBe(422);
  });

  it("crea un pedido real con dirección guardada, calcula el envío y vacía el carrito", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingMethod: "STANDARD", addressId, customerPhone: "3009999999" });
    expect(res.status).toBe(201);
    const order = res.body.data;
    createdOrderIds.push(order.id);

    expect(order.status).toBe("PENDING");
    expect(order.paymentStatus).toBe("PENDING");
    expect(order.subtotal).toBe("50000.00");
    expect(order.shippingTotal).toBe("12000.00"); // tarifa STANDARD por defecto
    expect(Number(order.total)).toBeCloseTo(50000 + 12000 + Number(order.taxTotal), 2);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].skuSnapshot).toBeTruthy();
    expect(order.shippingAddressId).toBe(addressId);

    const cart = await request(app).get("/api/cart").set("Authorization", `Bearer ${customerToken}`);
    expect(cart.body.data.items).toHaveLength(0);

    // el stock NO se descuenta en el checkout (diseño: se descuenta al
    // confirmarse el pago, Fase 10) — sigue disponible el mismo stock inicial
    const stockRow = await db.query.inventory.findFirst({ where: eq(inventory.variantId, variantId) });
    expect(stockRow?.stock).toBe(5);
  });

  it("crea un pedido PICKUP sin necesitar una dirección", async () => {
    await request(app).post("/api/cart/items").set("Authorization", `Bearer ${customerToken}`).send({ productId, variantId, quantity: 1 });
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingMethod: "PICKUP", customerPhone: "3009999999" });
    expect(res.status).toBe(201);
    createdOrderIds.push(res.body.data.id);
    expect(res.body.data.shippingTotal).toBe("0.00");
    expect(res.body.data.shippingAddressId).toBeNull();
  });

  it("rechaza un pedido cuyo stock cambió desde que se agregó al carrito", async () => {
    await request(app).post("/api/cart/items").set("Authorization", `Bearer ${customerToken}`).send({ productId, variantId, quantity: 1 });
    // Simula que el stock bajó a 0 después de agregarlo (ej. otro comprador
    // se lo llevó, o el admin lo ajustó) — el checkout debe re-validar en
    // vivo, no confiar en lo que el carrito tenía calculado antes.
    await db.update(inventory).set({ stock: 0 }).where(eq(inventory.variantId, variantId));

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingMethod: "PICKUP", customerPhone: "3009999999" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CART_STOCK_CHANGED");

    // restaura el stock y limpia el carrito para no afectar otras pruebas
    await db.update(inventory).set({ stock: 5 }).where(eq(inventory.variantId, variantId));
    const cart = await request(app).get("/api/cart").set("Authorization", `Bearer ${customerToken}`);
    for (const item of cart.body.data.items) {
      await request(app).delete(`/api/cart/items/${item.id}`).set("Authorization", `Bearer ${customerToken}`);
    }
  });

  it("aplica un cupón al pedido y registra su uso (coupon_usages)", async () => {
    await request(app).post("/api/cart/items").set("Authorization", `Bearer ${customerToken}`).send({ productId, variantId, quantity: 1 });
    await request(app).post("/api/cart/coupon").set("Authorization", `Bearer ${customerToken}`).send({ code: `checkout${suffix}` });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingMethod: "PICKUP", customerPhone: "3009999999" });
    expect(res.status).toBe(201);
    createdOrderIds.push(res.body.data.id);
    expect(res.body.data.discountTotal).toBe("10000.00");
    expect(Number(res.body.data.total)).toBeCloseTo(50000 - 10000 + Number(res.body.data.taxTotal), 2);
  });

  it("un cupón de un solo uso por usuario ya no se puede volver a aplicar tras ese pedido", async () => {
    await request(app).post("/api/cart/items").set("Authorization", `Bearer ${customerToken}`).send({ productId, variantId, quantity: 1 });
    const res = await request(app)
      .post("/api/cart/coupon")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ code: `checkout${suffix}` });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("COUPON_MAX_USES_PER_USER");

    const cart = await request(app).get("/api/cart").set("Authorization", `Bearer ${customerToken}`);
    for (const item of cart.body.data.items) {
      await request(app).delete(`/api/cart/items/${item.id}`).set("Authorization", `Bearer ${customerToken}`);
    }
  });

  // --- CONSULTA DE PEDIDOS ---------------------------------------------------

  it("lista los pedidos propios del usuario", async () => {
    const res = await request(app).get("/api/orders").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.every((o: { id: string }) => createdOrderIds.includes(o.id))).toBe(true);
  });

  it("permite ver el detalle de un pedido propio", async () => {
    const res = await request(app).get(`/api/orders/${createdOrderIds[0]}`).set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdOrderIds[0]);
  });

  it("no permite ver el pedido de otro usuario (404, no revela que existe)", async () => {
    const res = await request(app).get(`/api/orders/${createdOrderIds[0]}`).set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });
});
