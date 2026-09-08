import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { corsOptions } from "./config/cors";
import { apiRouter } from "./routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import { notFoundMiddleware } from "./middlewares/notFound.middleware";
import { env, isProduction } from "./config/env";
import { envInt } from "./utils/envInt";
import { asyncHandler } from "./utils/asyncHandler";
import { buildSitemapUrls, renderSitemapXml } from "./services/sitemap.service";

export function createApp(): Express {
  const app = express();

  // Confía en el proxy (Render/Railway/Vercel) para obtener la IP real del
  // cliente — necesario para que el rate limiting funcione correctamente.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(morgan(isProduction ? "combined" : "dev"));

  // Nota (Fase 10): a diferencia de otras pasarelas, la firma de los
  // webhooks de Wompi se calcula sobre los VALORES YA PARSEADOS del JSON
  // (ver signature.properties en cada evento), no sobre los bytes crudos
  // del body — así que el parser JSON genérico de aquí es suficiente,
  // no hace falta un middleware de "raw body" especial para ese endpoint.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting global (defensa base); límites más estrictos se aplican
  // por ruta sensible (login, forgot-password) en fases posteriores.
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    // Configurable por entorno (mismo valor por defecto que antes, 300) —
    // ver comentario equivalente en middlewares/rateLimiters.ts (Fase 15).
    limit: envInt("GLOBAL_RATE_LIMIT_MAX", 300),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message: "Demasiadas solicitudes, intenta de nuevo más tarde.", code: "RATE_LIMITED" } },
  });
  app.use("/api", globalLimiter);

  app.use("/api", apiRouter);

  // sitemap.xml vive en la raíz del dominio por convención (fuera de /api).
  // Se genera en cada solicitud a partir de productos/categorías ACTIVOS
  // reales en Postgres (Fase 16, sitemap.service.ts) — nunca una lista
  // estática que quedaría desactualizada. Cache-Control corto (10 min):
  // los rastreadores no necesitan la versión exacta al segundo, y evita
  // recalcularlo en cada petición sin necesitar una capa de caché aparte.
  app.get(
    "/sitemap.xml",
    asyncHandler(async (_req, res) => {
      const urls = await buildSitemapUrls();
      res.set("Content-Type", "application/xml").set("Cache-Control", "public, max-age=600").send(renderSitemapXml(urls));
    })
  );

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
