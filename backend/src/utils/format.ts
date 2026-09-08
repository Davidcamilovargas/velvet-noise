/**
 * Formateo compartido para las plantillas de correo (Fase 13). Los montos
 * en la base de datos son `numeric` (llegan como string desde node-pg) —
 * se parsean solo para mostrar, igual que en `frontend/src/utils/format.ts`.
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

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short" }).format(d);
}
