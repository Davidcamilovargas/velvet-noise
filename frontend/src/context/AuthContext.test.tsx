import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { useCartStore } from "../store/cart.store";
import type { User } from "../types/api";

const refreshRequestMock = vi.fn();
const loginRequestMock = vi.fn();
const logoutRequestMock = vi.fn();
const setOnSessionExpiredMock = vi.fn();
const getBackendCartMock = vi.fn();
const mergeGuestCartToBackendMock = vi.fn();

vi.mock("../services/auth.service", () => ({
  refreshRequest: (...args: unknown[]) => refreshRequestMock(...args),
  loginRequest: (...args: unknown[]) => loginRequestMock(...args),
  logoutRequest: (...args: unknown[]) => logoutRequestMock(...args),
}));

vi.mock("../services/api", () => ({
  setOnSessionExpired: (...args: unknown[]) => setOnSessionExpiredMock(...args),
}));

vi.mock("../services/cart.service", () => ({
  getBackendCart: (...args: unknown[]) => getBackendCartMock(...args),
  mergeGuestCartToBackend: (...args: unknown[]) => mergeGuestCartToBackendMock(...args),
}));

const testUser: User = {
  id: "u1",
  email: "a@test.com",
  firstName: "Ana",
  lastName: "Gómez",
  phone: null,
  role: "CUSTOMER",
  isActive: true,
  createdAt: new Date().toISOString(),
};

function Probe() {
  const { user, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user ? user.email : "ninguno"}</span>
      <button onClick={() => login("a@test.com", "Passw0rd1")}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    refreshRequestMock.mockReset().mockResolvedValue(null);
    loginRequestMock.mockReset();
    logoutRequestMock.mockReset().mockResolvedValue(undefined);
    setOnSessionExpiredMock.mockReset();
    getBackendCartMock.mockReset().mockResolvedValue({ items: [], subtotal: "0", total: "0" });
    mergeGuestCartToBackendMock.mockReset().mockResolvedValue({ items: [], subtotal: "0", total: "0" });
    useCartStore.setState({ lines: [], backendItemCount: null });
  });

  it("empieza en isLoading=true y pasa a false tras intentar renovar la sesión al montar", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(refreshRequestMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("user").textContent).toBe("ninguno");
  });

  it("si hay una sesión previa válida (cookie de refresh), queda logueado automáticamente al montar", async () => {
    refreshRequestMock.mockResolvedValue(testUser);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("a@test.com"));
    // Con sesión restaurada, se sincroniza el carrito con el backend.
    expect(getBackendCartMock).toHaveBeenCalledTimes(1);
  });

  it("login() actualiza el usuario y fusiona el carrito de invitado con el del backend", async () => {
    loginRequestMock.mockResolvedValue(testUser);
    useCartStore.setState({
      lines: [
        {
          productId: "p1",
          variantId: null,
          quantity: 2,
          name: "x",
          slug: "x",
          imageUrl: null,
          unitPrice: "1000",
          variantLabel: null,
          stockAtAdd: 5,
        },
      ],
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    fireEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("a@test.com"));
    expect(mergeGuestCartToBackendMock).toHaveBeenCalledWith([{ productId: "p1", variantId: null, quantity: 2 }]);
    // El carrito local (localStorage) se vacía una vez fusionado con el del backend.
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("logout() limpia el usuario y el contador de carrito del backend", async () => {
    refreshRequestMock.mockResolvedValue(testUser);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("a@test.com"));

    fireEvent.click(screen.getByText("logout"));

    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("ninguno"));
    expect(logoutRequestMock).toHaveBeenCalledTimes(1);
    expect(useCartStore.getState().backendItemCount).toBeNull();
  });

  it("si la sincronización del carrito falla tras el login, el login igual se completa (no bloquea la sesión)", async () => {
    loginRequestMock.mockResolvedValue(testUser);
    mergeGuestCartToBackendMock.mockRejectedValue(new Error("network"));
    useCartStore.setState({
      lines: [
        {
          productId: "p1",
          variantId: null,
          quantity: 1,
          name: "x",
          slug: "x",
          imageUrl: null,
          unitPrice: "1000",
          variantLabel: null,
          stockAtAdd: 5,
        },
      ],
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    fireEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("a@test.com"));
  });
});
