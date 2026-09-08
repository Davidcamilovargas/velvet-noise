import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, formatDateShort, calculateDiscountPercent } from "./format";

// Intl.NumberFormat en este entorno usa un espacio (a veces no separable, ej.
// U+00A0) entre el símbolo y la cifra — se normaliza con \s (que ya cubre
// esos espacios unicode) antes de comparar, para no acoplar el test a ese
// detalle de la implementación de ICU.
function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

describe("formatCurrency", () => {
  it("formatea un string numérico como pesos colombianos sin decimales", () => {
    expect(normalizeSpaces(formatCurrency("10000"))).toBe("$ 10.000");
  });

  it("formatea un number igual que un string equivalente", () => {
    expect(formatCurrency(25000)).toBe(formatCurrency("25000"));
  });

  it("devuelve un guion largo si el valor no es un número válido", () => {
    expect(formatCurrency("no-es-un-numero")).toBe("—");
  });

  it("formatea 0 como cero pesos, no como valor inválido", () => {
    expect(normalizeSpaces(formatCurrency("0"))).toBe("$ 0");
  });
});

describe("formatDate", () => {
  it("incluye fecha y hora en formato es-CO", () => {
    const result = formatDate("2026-03-15T14:30:00.000Z");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("Invalid Date");
  });
});

describe("formatDateShort", () => {
  it("interpreta una fecha YYYY-MM-DD como fecha local (no se corre un día por UTC)", () => {
    // Si se interpretara como UTC en una zona horaria con offset negativo,
    // "2026-01-01" podría mostrarse incorrectamente como "31 dic" —
    // regresión real posible que este test detectaría.
    const result = formatDateShort("2026-01-01");
    expect(result).not.toContain("31");
    expect(result.toLowerCase()).not.toContain("dic");
    expect(result.toLowerCase()).toContain("ene");
  });

  it("acepta también un ISO datetime completo", () => {
    const result = formatDateShort("2026-06-15T10:00:00.000Z");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("calculateDiscountPercent", () => {
  it("calcula el porcentaje de descuento cuando hay precio de comparación mayor", () => {
    expect(calculateDiscountPercent("8000", "10000")).toBe(20);
  });

  it("devuelve null si no hay precio de comparación", () => {
    expect(calculateDiscountPercent("8000", null)).toBeNull();
  });

  it("devuelve null si el precio de comparación no es mayor al precio actual (no hay descuento real)", () => {
    expect(calculateDiscountPercent("10000", "10000")).toBeNull();
    expect(calculateDiscountPercent("12000", "10000")).toBeNull();
  });

  it("devuelve null si el precio de comparación es cero", () => {
    expect(calculateDiscountPercent("8000", "0")).toBeNull();
  });

  it("redondea el porcentaje al entero más cercano", () => {
    // (10000 - 6667) / 10000 = 33.33% -> 33
    expect(calculateDiscountPercent("6667", "10000")).toBe(33);
  });
});
