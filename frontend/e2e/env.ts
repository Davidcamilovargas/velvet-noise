/** Configuración compartida por los scripts de setup/teardown y las specs E2E. */
export const API_URL = "http://localhost:4000/api";
export const APP_URL = "http://localhost:5173";

// Misma base de datos que usa el backend en desarrollo (ver backend/.env) —
// el teardown la usa vía `psql` para limpiar exactamente lo que este run
// creó, igual que los `afterAll` de los tests del backend limpian sus
// propias filas por sufijo/nombre único. `?schema=public` es una convención
// de Prisma/Drizzle en la URL del backend que `psql` (libpq) no entiende
// como parámetro de conexión — se usa la URL sin ese query string.
export const DATABASE_URL = "postgresql://tienda_user:tienda_pass@localhost:5432/tienda_virtual";

export const FIXTURES_PATH = new URL("./.fixtures.json", import.meta.url).pathname;

export interface E2EFixtures {
  runId: string;
  adminEmail: string;
  adminPassword: string;
  categoryId: string;
  categorySlug: string;
  productId: string;
  productName: string;
  productSlug: string;
  productSku: string;
}
