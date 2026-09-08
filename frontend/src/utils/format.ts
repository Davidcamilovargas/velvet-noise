/**
 * Formateo de moneda coherente con `store_settings.currency` (COP por
 * defecto). Los montos llegan como string desde la API — se parsean solo
 * para mostrar, nunca se reenvían recalculados al backend.
 */
export function formatCurrency(amount: string | number, currency = "COP"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(isoDate));
}

/** Fecha corta tipo "07 sep" — usada en ejes de gráficos y tablas compactas del admin. */
export function formatDateShort(isoDate: string): string {
  // "YYYY-MM-DD" se interpreta como fecha local, no UTC, para que el día
  // mostrado coincida con el día que el usuario espera ver.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? new Date(`${isoDate}T00:00:00`) : new Date(isoDate);
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(date);
}

export function calculateDiscountPercent(price: string, compareAtPrice: string | null): number | null {
  if (!compareAtPrice) return null;
  const current = Number(price);
  const previous = Number(compareAtPrice);
  if (!previous || previous <= current) return null;
  return Math.round(((previous - current) / previous) * 100);
}
