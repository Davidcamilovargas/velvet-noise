import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { FIXTURES_PATH, type E2EFixtures } from "./env";

const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, "utf-8")) as E2EFixtures;

/**
 * Panel de administración: login real con el admin creado en `global-setup`
 * (registrado por la API pública y promovido a ADMIN directamente en la
 * base de datos, como haría un operador real la primera vez), verificación
 * de que un cliente normal NO puede entrar, y que el producto real creado
 * por ese admin aparece en su propio panel de gestión.
 */
test.describe("Panel de administración", () => {
  test("un admin real puede iniciar sesión y ver su producto en el panel de gestión", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(fixtures.adminEmail);
    await page.getByLabel("Contraseña").fill(fixtures.adminPassword);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // Un admin autenticado, al hacer clic en su nombre en el header, va al
    // panel de admin (no a /profile, ver components/layout/Header.tsx).
    await expect(page.getByText(`Hola, E2E`)).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Productos" })).toBeVisible();
    // Se busca por nombre para no depender del orden/paginación de la lista
    // completa, que puede incluir productos de otras verificaciones previas.
    await page.getByLabel("Buscar").fill(fixtures.productName);
    await expect(page.getByText(fixtures.productName)).toBeVisible();
  });

  test("un cliente sin rol admin NO puede entrar al panel de administración", async ({ page }) => {
    const email = `e2e-customer-${Date.now()}@example.com`;
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Pedro");
    await page.getByLabel("Apellido").fill("Nieto");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("Passw0rd1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Hola, Pedro")).toBeVisible();

    // ProtectedRoute con allowedRoles=["ADMIN"] redirige a "/" cuando el
    // usuario SÍ tiene sesión pero no el rol requerido (distinto del caso
    // sin sesión, que redirige a /login — ver router/ProtectedRoute.tsx).
    await page.goto("/admin");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).not.toBeVisible();
  });
});
