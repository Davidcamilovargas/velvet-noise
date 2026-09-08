import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { FIXTURES_PATH, type E2EFixtures } from "./env";

const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, "utf-8")) as E2EFixtures;

/**
 * Recorrido completo de compra de un cliente real: buscar un producto real
 * (creado por `global-setup` vía la API), agregarlo al carrito, iniciar
 * sesión, ir al checkout con recogida en tienda (sin necesitar credenciales
 * reales de Wompi — el pago en sí ya se prueba end-to-end en
 * `backend/tests/payment.test.ts` simulando el webhook real de Wompi) y
 * confirmar que el pedido se crea de verdad y aparece en el historial.
 */
test.describe("Compra de un cliente (búsqueda → carrito → checkout)", () => {
  test("un cliente puede encontrar un producto, agregarlo al carrito y completar un pedido con recogida en tienda", async ({
    page,
  }) => {
    const email = `e2e-customer-${Date.now()}@example.com`;

    // 1. Buscar el producto real de la fixture en la tienda pública.
    await page.goto(`/shop?search=${encodeURIComponent(fixtures.productName)}`);
    await expect(page.getByText(fixtures.productName)).toBeVisible();

    // 2. Agregarlo al carrito como invitado (antes de tener sesión — el
    //    carrito de invitado vive en localStorage, ver store/cart.store.ts).
    const productCard = page.locator("a", { hasText: fixtures.productName });
    await productCard.getByRole("button", { name: "Agregar al carrito" }).click();

    await page.goto("/cart");
    await expect(page.getByText(fixtures.productName)).toBeVisible();

    // 3. El checkout es una ruta protegida — al intentar entrar sin sesión,
    //    Cart.tsx invita a iniciar sesión primero. No existe la cuenta
    //    todavía, así que se registra en su lugar.
    await page.getByRole("button", { name: "Ir al checkout" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Sofía");
    await page.getByLabel("Apellido").fill("Martínez");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("Passw0rd1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Hola, Sofía")).toBeVisible();

    // 4. Al iniciar sesión, el carrito de invitado se fusiona con el del
    //    backend (AuthContext.tsx → syncCartAfterLogin) — sigue teniendo el
    //    producto que se agregó como invitado.
    await page.goto("/cart");
    await expect(page.getByText(fixtures.productName)).toBeVisible();
    await page.getByRole("button", { name: "Ir al checkout" }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    // 5. Recoger en tienda: no exige dirección, solo un teléfono de contacto
    //    (label real definido en backend/src/services/shipping.service.ts).
    await page.getByText("Recoger en tienda (gratis)").click();
    await page.getByLabel(/tel[eé]fono/i).fill("3001234567");
    await page.getByRole("button", { name: "Confirmar pedido" }).click();

    // 6. El pedido se crea de verdad en el backend — se navega a su detalle.
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: /^Pedido / })).toBeVisible();

    // 7. Aparece también en el historial de pedidos del cliente (la lista
    //    muestra número de pedido/fecha/total, no el nombre del producto).
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: "Mis pedidos" })).toBeVisible();
    await expect(page.getByText(/^ORD-/)).toBeVisible();
  });
});
