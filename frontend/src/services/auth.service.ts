import { api, setAccessToken } from "./api";
import type { User } from "../types/api";

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export async function registerRequest(payload: RegisterPayload): Promise<User> {
  const res = await api.post<{ data: AuthResponse }>("/auth/register", payload);
  setAccessToken(res.data.data.accessToken);
  return res.data.data.user;
}

export async function loginRequest(email: string, password: string): Promise<User> {
  const res = await api.post<{ data: AuthResponse }>("/auth/login", { email, password });
  setAccessToken(res.data.data.accessToken);
  return res.data.data.user;
}

// El refresh token es de un solo uso (se rota en cada llamada — ver
// auth.service.ts del backend). Si dos llamadas a refreshRequest() salen
// casi al mismo tiempo con la MISMA cookie (esto pasa de verdad: React
// StrictMode monta AuthContext dos veces en desarrollo, y en producción
// puede pasar si dos pestañas recargan a la vez), la primera rota el token
// con éxito pero la segunda llega con el token ya revocado y recibe 401 —
// sin este `inFlightRefresh` compartido, esa segunda llamada perdedora
// terminaba pisando el estado de sesión ya válido de la primera con
// `setUser(null)`. Se coalescen en una sola llamada real de red, igual que
// el interceptor de axios en api.ts hace para los reintentos automáticos.
let inFlightRefresh: Promise<User | null> | null = null;

export async function refreshRequest(): Promise<User | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = api
      .post<{ data: AuthResponse }>("/auth/refresh")
      .then((res) => {
        setAccessToken(res.data.data.accessToken);
        return res.data.data.user;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        inFlightRefresh = null;
      });
  }
  return inFlightRefresh;
}

export async function logoutRequest(): Promise<void> {
  await api.post("/auth/logout");
  setAccessToken(null);
}

export async function forgotPasswordRequest(email: string): Promise<string> {
  const res = await api.post<{ data: { message: string } }>("/auth/forgot-password", { email });
  return res.data.data.message;
}

export async function resetPasswordRequest(token: string, password: string): Promise<string> {
  const res = await api.post<{ data: { message: string } }>("/auth/reset-password", { token, password });
  return res.data.data.message;
}

export async function meRequest(): Promise<User> {
  const res = await api.get<{ data: User }>("/auth/me");
  return res.data.data;
}
