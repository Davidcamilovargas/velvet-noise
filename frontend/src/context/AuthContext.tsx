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
  guestCheckout: (payload: authService.GuestCheckoutPayload) => Promise<User>;
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
  const { lines, clear, setBackendCart } = useCartStore.getState();
  try {
    const cart = lines.length
      ? await mergeGuestCartToBackend(lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })))
      : await getBackendCart();
    setBackendCart(cart);
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

  const guestCheckout = useCallback(async (payload: authService.GuestCheckoutPayload) => {
    const guestUser = await authService.guestCheckoutRequest(payload);
    // Primero el carrito, después la sesión: el checkout se muestra en cuanto
    // hay usuario y lee el carrito del backend, así que tiene que estar listo.
    await syncCartAfterLogin();
    setUser(guestUser);
    return guestUser;
  }, []);

  const logout = useCallback(async () => {
    await authService.logoutRequest();
    setUser(null);
    useCartStore.getState().setBackendCart(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, guestCheckout, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
