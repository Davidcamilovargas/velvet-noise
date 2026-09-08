import { CorsOptions } from "cors";
import { env } from "./env";
import { AppError } from "../utils/AppError";

// Exportado (no solo usado internamente aquí) porque `csrfOriginCheck.middleware.ts`
// reutiliza la misma allowlist para su verificación de Origin/Referer.
export const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim());

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Peticiones sin origin (curl, health checks, apps móviles) se permiten;
    // el resto debe estar en la allowlist explícita.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    // Un `Error` genérico aquí llegaba al `errorMiddleware` como un error no
    // controlado (500 con mensaje interno) en vez de un rechazo claro — se
    // usa AppError para que el cliente reciba un 403 real, consistente con
    // el resto de la API.
    callback(AppError.forbidden(`Origen no permitido: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
