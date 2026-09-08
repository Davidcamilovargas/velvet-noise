import { defineConfig, devices } from "@playwright/test";

/**
 * Suite E2E real (Fase 15) — corre contra el frontend y el backend REALES
 * de este entorno de desarrollo (Vite en :5173, Express en :4000, Postgres
 * real), sin mocks. Asume que ambos servidores ya están corriendo
 * (`npm run dev` en `frontend/` y `backend/`) — no los levanta por sí sola,
 * igual que el resto de la suite automatizada del backend asume Postgres
 * real disponible en `DATABASE_URL`.
 *
 * `globalSetup` crea los datos de partida que las specs necesitan
 * (un admin real, promovido a ADMIN directamente en la base de datos, y un
 * producto real publicado por ese admin) y `globalTeardown` los elimina al
 * terminar — el mismo patrón de setUp/afterAll ordenado por dependencias de
 * llave foránea que usa `backend/tests/*.test.ts`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
          args: ["--no-sandbox"],
        },
      },
    },
  ],
});
