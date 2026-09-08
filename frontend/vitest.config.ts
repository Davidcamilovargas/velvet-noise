import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    // `e2e/` son specs de Playwright (Fase 15, corren con `npm run test:e2e`
    // contra el frontend/backend reales) — usan su propio `test`/`expect` de
    // @playwright/test, no el de Vitest, así que deben quedar fuera del
    // descubrimiento de pruebas unitarias de Vitest.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
