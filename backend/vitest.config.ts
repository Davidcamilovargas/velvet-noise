import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 15000,
    hookTimeout: 20000,
    // Los tests que tocan la base de datos corren en serie para evitar
    // interferencia entre pruebas de concurrencia de inventario (Fase 10/15).
    fileParallelism: false,
  },
});
