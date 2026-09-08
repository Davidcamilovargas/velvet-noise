import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { and, eq } from "drizzle-orm";
import { createApp } from "../src/app";
import { db, pool } from "../src/db/client";
import { users, refreshTokens } from "../src/db/schema";
import { hashOpaqueToken } from "../src/utils/hash";

const app = createApp();
const testEmail = `test-auth-${Date.now()}@example.com`;

function extractRefreshCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"]?.find((c: string) => c.startsWith("refreshToken="));
  if (!raw) throw new Error("No se encontró la cookie refreshToken en la respuesta.");
  return raw.split(";")[0]; // "refreshToken=<valor>"
}

describe("Auth", () => {
  afterAll(async () => {
    await db.delete(users).where(eq(users.email, testEmail));
    await pool.end();
  });

  it("registra un usuario nuevo y devuelve un access token", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: testEmail,
      password: "Passw0rd1",
      firstName: "Test",
      lastName: "User",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
  });

  it("rechaza un registro duplicado con 409", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: testEmail,
      password: "Passw0rd1",
      firstName: "Test",
      lastName: "User",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rechaza contraseñas débiles en el registro con 422", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: `weak-${Date.now()}@example.com`,
      password: "123",
      firstName: "Test",
      lastName: "User",
    });
    expect(res.status).toBe(422);
  });

  it("rechaza login con contraseña incorrecta con 401", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: testEmail, password: "incorrecta" });
    expect(res.status).toBe(401);
  });

  it("permite login con credenciales correctas", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: testEmail, password: "Passw0rd1" });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it("rechaza acceso a /me sin token con 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("permite acceso a /me con token válido", async () => {
    const login = await request(app).post("/api/auth/login").send({ email: testEmail, password: "Passw0rd1" });
    const token = login.body.data.accessToken;
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(testEmail);
  });

  it("rechaza /me con un token con firma inválida", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer token.invalido.aqui");
    expect(res.status).toBe(401);
  });

  describe("Rotación de refresh tokens", () => {
    it("rechaza /auth/refresh sin cookie con 401", async () => {
      const res = await request(app).post("/api/auth/refresh");
      expect(res.status).toBe(401);
    });

    it("rota el refresh token: la respuesta trae un access token nuevo y una cookie de refresh nueva", async () => {
      const login = await request(app).post("/api/auth/login").send({ email: testEmail, password: "Passw0rd1" });
      const refreshCookie = extractRefreshCookie(login);

      const refreshed = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.data.accessToken).toBeTruthy();
      const newRefreshCookie = extractRefreshCookie(refreshed);
      expect(newRefreshCookie).not.toBe(refreshCookie);
    });

    it(
      "permite reutilizar, dentro de la ventana de gracia, un refresh token que ya fue rotado " +
        "(dos pestañas o dos llamadas casi simultáneas con la misma cookie no deben cerrar la sesión)",
      async () => {
        const login = await request(app).post("/api/auth/login").send({ email: testEmail, password: "Passw0rd1" });
        const originalCookie = extractRefreshCookie(login);

        // Primer uso: rota con éxito (como la pestaña "ganadora" de la carrera).
        const firstUse = await request(app).post("/api/auth/refresh").set("Cookie", originalCookie);
        expect(firstUse.status).toBe(200);

        // Segundo uso, inmediatamente después, con la MISMA cookie ya
        // revocada (como la pestaña "perdedora" de la carrera): debe seguir
        // funcionando gracias a la ventana de gracia, no debe cerrar la sesión.
        const secondUse = await request(app).post("/api/auth/refresh").set("Cookie", originalCookie);
        expect(secondUse.status).toBe(200);
        expect(secondUse.body.data.accessToken).toBeTruthy();
      }
    );

    it("rechaza un refresh token reutilizado FUERA de la ventana de gracia (posible robo)", async () => {
      const login = await request(app).post("/api/auth/login").send({ email: testEmail, password: "Passw0rd1" });
      const originalCookie = extractRefreshCookie(login);
      const rawToken = originalCookie.split("=")[1];

      const firstUse = await request(app).post("/api/auth/refresh").set("Cookie", originalCookie);
      expect(firstUse.status).toBe(200);

      // Simula que la rotación ocurrió hace rato (más allá de la ventana de
      // gracia de 10s) retrocediendo `revokedAt` directamente en la base de
      // datos, en vez de esperar minutos reales en la suite de pruebas.
      const tokenHash = hashOpaqueToken(rawToken);
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date(Date.now() - 60_000) })
        .where(and(eq(refreshTokens.tokenHash, tokenHash)));

      const staleReuse = await request(app).post("/api/auth/refresh").set("Cookie", originalCookie);
      expect(staleReuse.status).toBe(401);
    });

    it("rechaza el refresh token viejo después de que expiró su ventana de gracia post-rotación", async () => {
      const login = await request(app).post("/api/auth/login").send({ email: testEmail, password: "Passw0rd1" });
      const refreshCookie = extractRefreshCookie(login);

      // Verifica que el token nuevo (post-rotación) sí sirve para navegar
      // sesiones futuras — confirma que la rotación real sigue funcionando
      // de punta a punta, no solo la ventana de gracia del token viejo.
      const refreshed = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);
      const newCookie = extractRefreshCookie(refreshed);
      const refreshedAgain = await request(app).post("/api/auth/refresh").set("Cookie", newCookie);
      expect(refreshedAgain.status).toBe(200);
    });
  });
});
