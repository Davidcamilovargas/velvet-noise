import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { createApp } from "../src/app";
import { db, pool } from "../src/db/client";
import { users } from "../src/db/schema";

const app = createApp();
const guestEmail = `test-guest-${Date.now()}@example.com`;
const registeredEmail = `test-guest-registered-${Date.now()}@example.com`;

describe("Compra sin cuenta", () => {
  afterAll(async () => {
    await db.delete(users).where(inArray(users.email, [guestEmail, registeredEmail]));
    await pool.end();
  });

  it("crea una cuenta silenciosa y abre sesión", async () => {
    const res = await request(app).post("/api/auth/guest").send({
      email: guestEmail,
      firstName: "Invitada",
      lastName: "Prueba",
      phone: "3001234567",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(guestEmail);
    expect(res.body.data.user.role).toBe("CUSTOMER");
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);

    // La sesión sirve para el resto del flujo autenticado (carrito, pedidos).
    const cart = await request(app).get("/api/cart").set("Authorization", `Bearer ${res.body.data.accessToken}`);
    expect(cart.status).toBe(200);
  });

  it("no abre sesión en una cuenta que ya existe", async () => {
    await request(app).post("/api/auth/register").send({
      email: registeredEmail,
      password: "Passw0rd1",
      firstName: "Ya",
      lastName: "Registrada",
    });

    const res = await request(app).post("/api/auth/guest").send({
      email: registeredEmail,
      firstName: "Otra",
      lastName: "Persona",
      phone: "3001234567",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("exige teléfono", async () => {
    const res = await request(app).post("/api/auth/guest").send({
      email: `sin-telefono-${Date.now()}@example.com`,
      firstName: "Sin",
      lastName: "Teléfono",
    });
    expect(res.status).toBe(422);
  });
});
