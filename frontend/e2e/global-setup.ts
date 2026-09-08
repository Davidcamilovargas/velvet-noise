import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { API_URL, DATABASE_URL, FIXTURES_PATH, type E2EFixtures } from "./env";

/**
 * Crea los datos de partida REALES que las specs necesitan: un admin de
 * verdad (registrado por la API pública y promovido a ADMIN en la base de
 * datos, exactamente como haría un operador manualmente la primera vez) y
 * un producto real publicado por ese admin. No se usa ningún dato inventado
 * en memoria — todo pasa por la API real contra Postgres real, igual que
 * exige el resto del proyecto (ver docs/01-arquitectura.md, regla de "cero
 * simulación").
 */
async function main() {
  const runId = String(Date.now());
  const adminEmail = `e2e-admin-${runId}@example.com`;
  const adminPassword = "Passw0rd1";

  const registerRes = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      firstName: "E2E",
      lastName: "Admin",
    }),
  });
  if (!registerRes.ok) {
    throw new Error(`No se pudo registrar el admin de pruebas E2E: ${registerRes.status} ${await registerRes.text()}`);
  }

  // La API pública no permite crear cuentas ADMIN directamente (por diseño,
  // ver docs/03-api.md AUTH) — se promueve igual que lo haría un operador
  // con acceso directo a la base de datos la primera vez que se configura
  // una tienda.
  execFileSync("psql", [DATABASE_URL, "-c", `UPDATE users SET role = 'ADMIN' WHERE email = '${adminEmail}';`]);

  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  if (!loginRes.ok) {
    throw new Error(`No se pudo iniciar sesión con el admin de pruebas E2E: ${loginRes.status}`);
  }
  const loginBody = (await loginRes.json()) as { data: { accessToken: string } };
  const adminToken = loginBody.data.accessToken;

  const categoryRes = await fetch(`${API_URL}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: `Categoría E2E ${runId}` }),
  });
  if (!categoryRes.ok) {
    throw new Error(`No se pudo crear la categoría de pruebas E2E: ${categoryRes.status} ${await categoryRes.text()}`);
  }
  const categoryBody = (await categoryRes.json()) as { data: { id: string; slug: string } };

  const productName = `Zapatilla E2E ${runId}`;
  const productSku = `E2E-ZAP-${runId}`;
  const productRes = await fetch(`${API_URL}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: productName,
      description: "Producto real creado por la suite E2E (Fase 15) para probar el recorrido de compra completo.",
      price: 129900,
      sku: productSku,
      categoryId: categoryBody.data.id,
      stock: 50,
    }),
  });
  if (!productRes.ok) {
    throw new Error(`No se pudo crear el producto de pruebas E2E: ${productRes.status} ${await productRes.text()}`);
  }
  const productBody = (await productRes.json()) as { data: { id: string; slug: string } };

  const fixtures: E2EFixtures = {
    runId,
    adminEmail,
    adminPassword,
    categoryId: categoryBody.data.id,
    categorySlug: categoryBody.data.slug,
    productId: productBody.data.id,
    productName,
    productSlug: productBody.data.slug,
    productSku,
  };
  writeFileSync(FIXTURES_PATH, JSON.stringify(fixtures, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[e2e:global-setup] Fixtures listas (runId=${runId}): admin=${adminEmail}, producto=${productName}`);
}

export default main;
