import { describe, it, expect, afterEach } from "vitest";
import { AxiosError } from "axios";
import { getApiErrorMessage, setAccessToken, getAccessToken } from "./api";

describe("getAccessToken / setAccessToken", () => {
  afterEach(() => {
    setAccessToken(null);
  });

  it("empieza en null (nunca se persiste en localStorage, solo en memoria)", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("devuelve el token exacto que se acaba de guardar", () => {
    setAccessToken("token-de-prueba");
    expect(getAccessToken()).toBe("token-de-prueba");
  });

  it("permite limpiar el token guardando null (ej. al cerrar sesión)", () => {
    setAccessToken("token-de-prueba");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});

describe("getApiErrorMessage", () => {
  it("extrae el mensaje de error del cuerpo de respuesta de la API", () => {
    const error = new AxiosError("Request failed", "400", undefined, undefined, {
      status: 400,
      statusText: "Bad Request",
      headers: {},
      // @ts-expect-error -- config mínimo suficiente para el test
      config: {},
      data: { error: { message: "El correo ya está registrado.", code: "EMAIL_TAKEN" } },
    });
    expect(getApiErrorMessage(error)).toBe("El correo ya está registrado.");
  });

  it("devuelve un mensaje genérico de conexión si la respuesta no trae cuerpo de error (ej. red caída)", () => {
    const error = new AxiosError("Network Error");
    expect(getApiErrorMessage(error)).toBe("No se pudo conectar con el servidor. Intenta de nuevo.");
  });

  it("usa el mensaje de un Error normal (no de axios) si lo tiene, ej. fallo al cargar el widget de Wompi", () => {
    expect(getApiErrorMessage(new Error("No se pudo cargar el widget de pago."))).toBe(
      "No se pudo cargar el widget de pago."
    );
  });

  it("devuelve un mensaje genérico para cualquier otro tipo de valor lanzado", () => {
    expect(getApiErrorMessage("algo-no-es-un-error")).toBe("Ocurrió un error inesperado.");
    expect(getApiErrorMessage(undefined)).toBe("Ocurrió un error inesperado.");
  });
});
