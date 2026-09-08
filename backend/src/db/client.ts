import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../config/env";
import * as schema from "./schema";

/**
 * Pool de conexiones compartido por toda la app. `max` moderado porque el
 * despliegue objetivo (Render/Railway) normalmente da un límite bajo de
 * conexiones concurrentes en el plan gratuito/básico de Postgres.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;
