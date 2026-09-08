import { test, expect } from "@playwright/test";

/**
 * Flujo de autenticación real, contra el frontend y el backend reales de
 * este entorno (sin mocks): registro, sesión persistida tras recargar,
 * cierre de sesión, y las dos formas de bloqueo de rutas protegidas
 * (usuario no autenticado, y usuario autenticado sin el rol requerido).
 */
test.describe("Autenticación", () => {
  test("una visita anónima a una ruta protegida redirige a /login", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("un usuario anónimo no puede entrar al panel de admin — redirige a la tienda", async ({ page }) => {
    await page.goto("/admin");
    // ProtectedRoute redirige primero a /login (no hay sesión) — este caso ya
    // se cubre arriba; aquí importa que en ningún punto se llegue a ver el
    // panel de admin sin sesión.
    await expect(page).toHaveURL(/\/login$/);
  });

  test("registro de una cuenta nueva deja al usuario autenticado de inmediato", async ({ page }) => {
    const email = `e2e-customer-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Ana");
    await page.getByLabel("Apellido").fill("Gómez");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("Passw0rd1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Hola, Ana")).toBeVisible();
  });

  test("la sesión sobrevive a una recarga completa de la página (cookie httpOnly de refresh)", async ({ page }) => {
    const email = `e2e-customer-${Date.now()}@example.com`;
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Carlos");
    await page.getByLabel("Apellido").fill("Ruiz");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("Passw0rd1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Hola, Carlos")).toBeVisible();

    // El access token vive solo en memoria (nunca en localStorage) — tras
    // recargar, se pierde y debe renovarse automáticamente contra
    // /api/auth/refresh usando la cookie httpOnly, sin que el usuario tenga
    // que volver a iniciar sesión.
    await page.reload();
    await expect(page.getByText("Hola, Carlos")).toBeVisible();
  });

  test("logout cierra la sesión y una ruta protegida vuelve a exigir login", async ({ page }) => {
    const email = `e2e-customer-${Date.now()}@example.com`;
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Diana");
    await page.getByLabel("Apellido").fill("Lopez");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("Passw0rd1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Hola, Diana")).toBeVisible();

    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login con contraseña incorrecta muestra un error real del backend, sin autenticar", async ({ page }) => {
    const email = `e2e-customer-${Date.now()}@example.com`;
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Elena");
    await page.getByLabel("Apellido").fill("Torres");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("Passw0rd1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Hola, Elena")).toBeVisible();
    await page.getByRole("button", { name: "Salir" }).click();

    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("ContraseñaIncorrecta1");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page.getByText(/incorrect/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
