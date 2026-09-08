import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { storeSettings } from "../db/schema";
import type { UpdateSettingsInput } from "../validators/settings.validators";

// La fila de configuración (id fijo = 1) no se siembra en las migraciones a
// propósito (ver comentarios en cart.service.ts / shipping.service.ts): la
// tienda funciona con valores por defecto razonables desde la Fase 9 sin
// esperar a que exista esta pantalla. Este es el valor por defecto que se
// devuelve mientras nadie haya guardado configuración todavía.
const DEFAULTS = {
  id: 1 as const,
  storeName: "Velvet Noise",
  logoUrl: null as string | null,
  contactEmail: null as string | null,
  contactPhone: null as string | null,
  address: null as string | null,
  socialLinks: null as Record<string, string> | null,
  currency: "COP",
  taxPercentage: "19",
  shippingMethods: null as Record<string, unknown> | null,
  paymentMethods: null as Record<string, unknown> | null,
};

export async function getStoreSettings() {
  const existing = await db.query.storeSettings.findFirst({ where: eq(storeSettings.id, 1) });
  return existing ?? { ...DEFAULTS, updatedAt: null };
}

/**
 * "Upsert" manual sobre la fila única id=1: si es la primera vez que un
 * admin guarda configuración, la fila todavía no existe y se crea con los
 * valores por defecto de base; si ya existe, se actualiza solo lo enviado.
 */
export async function updateStoreSettings(input: UpdateSettingsInput) {
  const values: Partial<typeof storeSettings.$inferInsert> = { id: 1 };
  if (input.storeName !== undefined) values.storeName = input.storeName;
  if (input.logoUrl !== undefined) values.logoUrl = input.logoUrl || null;
  if (input.contactEmail !== undefined) values.contactEmail = input.contactEmail || null;
  if (input.contactPhone !== undefined) values.contactPhone = input.contactPhone || null;
  if (input.address !== undefined) values.address = input.address || null;
  if (input.currency !== undefined) values.currency = input.currency.toUpperCase();
  if (input.taxPercentage !== undefined) values.taxPercentage = input.taxPercentage.toFixed(2);
  if (input.shippingMethods !== undefined) values.shippingMethods = input.shippingMethods;

  const current = await db.query.storeSettings.findFirst({ where: eq(storeSettings.id, 1) });

  if (!current) {
    const [created] = await db
      .insert(storeSettings)
      .values({ ...DEFAULTS, ...values })
      .returning();
    return created;
  }

  const [updated] = await db.update(storeSettings).set(values).where(eq(storeSettings.id, 1)).returning();
  return updated;
}
