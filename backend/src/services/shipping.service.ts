import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { storeSettings } from "../db/schema";

export type ShippingMethod = "STANDARD" | "EXPRESS" | "PICKUP";

export interface ShippingMethodOption {
  method: ShippingMethod;
  label: string;
  price: number;
  etaDays: number;
}

// Igual que `getTaxPercentage` en cart.service.ts: si el admin todavía no
// configuró tarifas de envío en Fase 12 (panel administrativo), se usan
// estos valores por defecto para que el checkout funcione desde ya, en vez
// de bloquear la Fase 9 esperando a que exista la UI de configuración.
const DEFAULT_SHIPPING_METHODS: Record<ShippingMethod, ShippingMethodOption> = {
  STANDARD: { method: "STANDARD", label: "Envío estándar (3-5 días hábiles)", price: 12000, etaDays: 5 },
  EXPRESS: { method: "EXPRESS", label: "Envío express (1-2 días hábiles)", price: 25000, etaDays: 2 },
  PICKUP: { method: "PICKUP", label: "Recoger en tienda (gratis)", price: 0, etaDays: 0 },
};

export async function getShippingMethods(): Promise<ShippingMethodOption[]> {
  const settings = await db.query.storeSettings.findFirst({ where: eq(storeSettings.id, 1) });
  const configured = (settings?.shippingMethods as Partial<Record<ShippingMethod, Partial<ShippingMethodOption>>>) ?? {};

  return (Object.keys(DEFAULT_SHIPPING_METHODS) as ShippingMethod[]).map((method) => ({
    ...DEFAULT_SHIPPING_METHODS[method],
    ...configured[method],
    method, // nunca se sobrescribe con lo configurado, evita inconsistencias
  }));
}

export async function getShippingCost(method: ShippingMethod): Promise<number> {
  const methods = await getShippingMethods();
  const found = methods.find((m) => m.method === method);
  if (!found) return DEFAULT_SHIPPING_METHODS[method].price;
  return found.price;
}
