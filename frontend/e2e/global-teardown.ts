import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { DATABASE_URL, FIXTURES_PATH, type E2EFixtures } from "./env";

/**
 * Elimina TODO lo que este run de E2E creó en la base de datos real, en el
 * orden que exigen las llaves foráneas (hijos antes que padres) — el mismo
 * patrón que usan los `afterAll` de `backend/tests/*.test.ts`. Cualquier
 * usuario/pedido creado por las specs usa el prefijo `e2e-` en el correo,
 * así que el teardown no necesita rastrear cada fila individualmente: le
 * basta con ese prefijo y los ids del producto/categoría de `global-setup`.
 */
async function main() {
  if (!existsSync(FIXTURES_PATH)) return; // global-setup falló antes de escribir fixtures — nada que limpiar.
  const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, "utf-8")) as E2EFixtures;

  const sql = `
    DELETE FROM inventory_movements WHERE order_id IN (SELECT id FROM orders WHERE customer_email LIKE 'e2e-%@example.com');
    DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_email LIKE 'e2e-%@example.com');
    DELETE FROM orders WHERE customer_email LIKE 'e2e-%@example.com';
    DELETE FROM carts WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%@example.com');
    DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%@example.com');
    DELETE FROM reviews WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%@example.com');
    DELETE FROM products WHERE id = '${fixtures.productId}';
    DELETE FROM categories WHERE id = '${fixtures.categoryId}';
    DELETE FROM users WHERE email LIKE 'e2e-%@example.com';
  `;
  execFileSync("psql", [DATABASE_URL, "-c", sql]);
  unlinkSync(FIXTURES_PATH);
  // eslint-disable-next-line no-console
  console.log(`[e2e:global-teardown] Datos del run ${fixtures.runId} eliminados.`);
}

export default main;
