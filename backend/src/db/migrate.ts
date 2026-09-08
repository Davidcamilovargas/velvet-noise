/**
 * Aplica las migraciones pendientes contra DATABASE_URL. Se ejecuta:
 *  - En desarrollo: `npm run db:migrate`
 *  - En despliegue: como paso de build/release antes de arrancar el server.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { env } from "../config/env";
import { logger } from "../utils/logger";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);

  // Extensión necesaria para búsqueda de texto insensible a tildes
  // (ej. "audifonos" debe encontrar "Audífonos") — ver product.service.ts.
  logger.info("Habilitando extensiones de PostgreSQL requeridas...");
  await pool.query("CREATE EXTENSION IF NOT EXISTS unaccent;");

  logger.info("Aplicando migraciones...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  logger.info("Migraciones aplicadas correctamente.");
  await pool.end();
}

main().catch((err) => {
  logger.error("Fallo al aplicar migraciones", err);
  process.exit(1);
});
