import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// `test.globals` está en `false` (ver vitest.config.ts) a propósito, para no
// contaminar el ámbito global con `describe`/`it`/`expect` fuera de los
// archivos de test — así que la limpieza automática de @testing-library/react
// tras cada test (que depende de un `afterEach` global) se registra aquí de
// forma explícita en vez de depender del modo `globals: true`.
afterEach(() => {
  cleanup();
});
