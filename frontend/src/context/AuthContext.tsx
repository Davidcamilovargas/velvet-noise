import { createContext, ReactNode, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "../types/api";
import { setOnSessionExpired } from "../services/api";
import * as authService from "../services/auth.service";
import { getBackendCart, mergeGuestCartToBackend } from "../services/cart.service";
import { useCartStore } from "../store/cart.store";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: authService.RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Fusiona el carrito de invitado (localStorage) con el carrito del backend
 * y deja el contador del header en sincronía. A partir de este punto, en
 * esta sesión, el carrito autenticado vive en el backend — se vacía el
 * store local para no arrastrar líneas ya sincronizadas.
 */
async function syncCartAfterLogin(): Promise<void> {
  const { lines, clear, setBackendItemCount } = useCartStore.getState();
  try {
    const cart = lines.length
      ? await mergeGuestCartToBackend(lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })))
      : await getBackendCart();
    setBackendItemCount(cart.items.reduce((sum, i) => sum + i.quantity, 0));
    clear();
  } catch {
    // Si la sincronización falla (ej. backend momentáneamente no
    // disponible), el usuario sigue viendo su carrito local hasta el
    // siguiente intento — no se bloquea el login por esto.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Al montar la app, intenta renovar la sesión usando la cookie httpOnly
    // de refresh (si existe de una visita anterior). Esto es lo que permite
    // que el usuario siga logueado tras recargar la página, sin guardar
    // nada sensible en localStorage.
    authService
      .refreshRequest()
      .then(async (refreshedUser) => {
        setUser(refreshedUser);
        if (refreshedUser) await syncCartAfterLogin();
      })
      .finally(() => setIsLoading(false));

    setOnSessionExpired(() => setUser(null));
    return () => setOnSessionExpired(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const loggedInUser = await authService.loginRequest(email, password);
    setUser(loggedInUser);
    await syncCartAfterLogin();
    return loggedInUser;
  }, []);

  const register = useCallback(async (payload: authService.RegisterPayload) => {
    const newUser = await authService.registerRequest(payload);
    setUser(newUser);
    await syncCartAfterLogin();
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    await authService.logoutRequest();
    setUser(null);
    useCartStore.getState().setBackendItemCount(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
