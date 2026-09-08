import axios, { AxiosError } from "axios";
import type { ApiErrorBody } from "../types/api";

/**
 * Instancia central de Axios. `withCredentials: true` porque el refresh
 * token viaja en una cookie httpOnly (ver Fase 6) — el navegador la maneja
 * automáticamente, el frontend nunca la lee ni la guarda en JS.
 *
 * Si falta `frontend/.env` (o no trae VITE_API_URL), `import.meta.env.VITE_API_URL`
 * queda `undefined` y Axios usa como baseURL la URL de la propia página
 * (`http://localhost:5173`) en vez del backend — las peticiones caen en el
 * dev server de Vite, que devuelve el `index.html` de la SPA con
 * `Content-Type: text/html` en vez de JSON. Axios no lanza error ahí (la
 * petición "success" con 200), así que el problema no se ve como un error
 * de red sino como un `undefined` silencioso más adelante en el código que
 * consume la respuesta — por eso el valor por defecto: para que en
 * desarrollo local, sin `.env`, la app apunte al backend real igual.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  withCredentials: true,
  timeout: 15000,
});

// El access token vive SOLO en memoria (nunca en localStorage) para reducir
// la superficie de robo vía XSS. Se pierde al recargar la página a propósito;
// el interceptor de refresh (Fase 6) lo repone automáticamente contra
// /api/auth/refresh usando la cookie httpOnly.
let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

api.interceptors.request.use((config) => {
  if (inMemoryAccessToken) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }
  return config;
});

// Se invoca cuando la sesión no puede renovarse (refresh token vencido o
// revocado) — AuthContext se suscribe a esto para limpiar el estado global
// de usuario sin que este módulo (que no es un componente) necesite saber
// nada de React.
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
      .then((res) => {
        const token = res.data.data.accessToken as string;
        setAccessToken(token);
        return token;
      })
      .catch(() => {
        setAccessToken(null);
        onSessionExpired?.();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.includes("/auth/login") || originalRequest?.url?.includes("/auth/register") || originalRequest?.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Extrae un mensaje de error legible de cualquier respuesta de la API,
 * consistente con el formato de backend/src/middlewares/error.middleware.ts.
 */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<ApiErrorBody>;
    return err.response?.data?.error?.message ?? "No se pudo conectar con el servidor. Intenta de nuevo.";
  }
  // No todos los errores que pasan por aquí vienen de una llamada a nuestra
  // API (ej. la carga del script del widget de Wompi puede fallar por red) —
  // si es un Error normal con un mensaje útil, se muestra en vez del
  // genérico, que no ayuda al usuario a entender qué pasó.
  if (error instanceof Error && error.message) return error.message;
  return "Ocurrió un error inesperado.";
}
