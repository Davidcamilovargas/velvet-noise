import { describe, it, expect, vi, beforeEach } from "vitest";

const postMock = vi.fn();
const setAccessTokenMock = vi.fn();

vi.mock("./api", () => ({
  api: { post: (...args: unknown[]) => postMock(...args) },
  setAccessToken: (...args: unknown[]) => setAccessTokenMock(...args),
}));

// Import dinámico DESPUÉS del mock para que auth.service.ts reciba la
// versión mockeada de ./api al importarla internamente.
const { refreshRequest, loginRequest } = await import("./auth.service");

describe("refreshRequest (coalescencia de llamadas concurrentes)", () => {
  beforeEach(() => {
    postMock.mockReset();
    setAccessTokenMock.mockReset();
  });

  it("dos llamadas concurrentes a refreshRequest() solo disparan UNA petición de red real", async () => {
    // El refresh token del backend es de un solo uso: si dos llamadas
    // concurrentes usaran cada una su propia petición, la segunda llegaría
    // con el token ya rotado por la primera y recibiría 401 — perdiendo una
    // sesión que en realidad seguía siendo válida (ver comentario en
    // auth.service.ts). Este test verifica la coalescencia (`inFlightRefresh`)
    // que evita justamente eso.
    let resolvePost!: (value: unknown) => void;
    postMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve;
      })
    );

    const call1 = refreshRequest();
    const call2 = refreshRequest();

    expect(postMock).toHaveBeenCalledTimes(1);

    resolvePost({ data: { data: { user: { id: "u1", email: "a@test.com" }, accessToken: "tok-1" } } });

    const [user1, user2] = await Promise.all([call1, call2]);
    expect(user1).toEqual({ id: "u1", email: "a@test.com" });
    expect(user2).toEqual({ id: "u1", email: "a@test.com" });
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it("una llamada NUEVA después de que la anterior terminó sí dispara una nueva petición", async () => {
    postMock.mockResolvedValueOnce({ data: { data: { user: { id: "u1" }, accessToken: "tok-1" } } });
    await refreshRequest();
    expect(postMock).toHaveBeenCalledTimes(1);

    postMock.mockResolvedValueOnce({ data: { data: { user: { id: "u1" }, accessToken: "tok-2" } } });
    await refreshRequest();
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it("si el refresh falla, devuelve null y limpia el access token en vez de propagar el error", async () => {
    postMock.mockRejectedValueOnce(new Error("401"));
    const result = await refreshRequest();
    expect(result).toBeNull();
    expect(setAccessTokenMock).toHaveBeenCalledWith(null);
  });
});

describe("loginRequest", () => {
  beforeEach(() => {
    postMock.mockReset();
    setAccessTokenMock.mockReset();
  });

  it("guarda el access token recibido y devuelve el usuario", async () => {
    postMock.mockResolvedValueOnce({
      data: { data: { user: { id: "u1", email: "a@test.com" }, accessToken: "tok-login" } },
    });
    const user = await loginRequest("a@test.com", "Passw0rd1");
    expect(user).toEqual({ id: "u1", email: "a@test.com" });
    expect(setAccessTokenMock).toHaveBeenCalledWith("tok-login");
    expect(postMock).toHaveBeenCalledWith("/auth/login", { email: "a@test.com", password: "Passw0rd1" });
  });
});
