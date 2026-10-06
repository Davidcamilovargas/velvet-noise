import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { FIXTURES_PATH, type E2EFixtures } from "./env";

const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, "utf-8")) as E2EFixtures;

/**
 * Recorrido completo de compra SIN cuenta: buscar un producto real (creado
 * por `global-setup` vía la API), agregarlo desde la tarjeta, ir al checkout,
 * dejar solo nombre, correo y teléfono (el backend crea una cuenta silenciosa,
 * ver POST /api/auth/guest), elegir recogida en tienda y confirmar. El pago en
 * sí se prueba en `backend/tests/payment.test.ts` simulando el webhook de Wompi.
 */
test.describe("Compra sin cuenta (búsqueda → carrito → checkout)", () => {
  test("una persona sin cuenta encuentra un producto, lo agrega y completa un pedido con recogida en tienda", async ({
    page,
  }) => {
    const email = `e2e-guest-${Date.now()}@example.com`;

    // 1. Buscar el producto real de la fixture en el catálogo.
    await page.goto(`/shop?search=${encodeURIComponent(fixtures.productName)}`);
    const tile = page.locator(".vn-item", { hasText: fixtures.productName });
    await expect(tile).toBeVisible();

    // 2. Agregarlo desde la tarjeta: con mouse aparece "+" (vista rápida); el
    //    producto de la fixture no tiene tallas, así que se agrega directo.
    await tile.hover();
    await tile.getByRole("button", { name: `Vista rápida de ${fixtures.productName}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(page.getByRole("status")).toContainText("en tu carrito");

    await page.goto("/cart");
    await expect(page.getByText(fixtures.productName)).toBeVisible();

    // 3. El checkout ya no pide iniciar sesión: pide los datos de contacto.
    await page.getByRole("button", { name: "Ir al checkout" }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { name: "Tus datos" })).toBeVisible();
    await page.getByLabel("Nombre").fill("Sofía");
    await page.getByLabel("Apellido").fill("Martínez");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Teléfono").fill("3001234567");
    await page.getByRole("button", { name: "Continuar con el envío" }).click();

    // 4. Con la sesión de invitado abierta, el carrito local pasó al backend y
    //    se muestra el checkout normal.
    await expect(page.getByRole("heading", { name: "Método de envío" })).toBeVisible();
    await expect(page.getByText(fixtures.productName)).toBeVisible();

    // 5. Recoger en tienda: no exige dirección (label real definido en
    //    backend/src/services/shipping.service.ts).
    await page.getByText("Recoger en tienda (gratis)").click();
    await page.getByRole("button", { name: "Confirmar pedido" }).click();

    // 6. El pedido se crea de verdad en el backend — se navega a su detalle.
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: /^Pedido / })).toBeVisible();

    // 7. Aparece también en el historial de pedidos de esa persona.
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: "Mis pedidos" })).toBeVisible();
    await expect(page.getByText(/^ORD-/)).toBeVisible();
  });
});
