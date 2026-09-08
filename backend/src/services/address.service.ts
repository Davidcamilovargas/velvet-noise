import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { addresses } from "../db/schema";
import { AppError } from "../utils/AppError";
import type { AddressInput } from "../validators/address.validators";

export async function listAddresses(userId: string) {
  return db.query.addresses.findMany({
    where: eq(addresses.userId, userId),
    orderBy: [desc(addresses.isDefault), desc(addresses.createdAt)],
  });
}

async function findOwnedAddress(userId: string, id: string) {
  const address = await db.query.addresses.findFirst({ where: and(eq(addresses.id, id), eq(addresses.userId, userId)) });
  if (!address) throw AppError.notFound("Dirección no encontrada.");
  return address;
}

/** Si se marca una dirección como predeterminada, desmarca las demás del mismo usuario (solo puede haber una). */
async function clearOtherDefaults(userId: string, keepId?: string): Promise<void> {
  const others = await db.query.addresses.findMany({ where: eq(addresses.userId, userId) });
  const toClear = others.filter((a) => a.isDefault && a.id !== keepId);
  for (const address of toClear) {
    await db.update(addresses).set({ isDefault: false }).where(eq(addresses.id, address.id));
  }
}

export async function createAddress(userId: string, input: AddressInput) {
  const existingCount = (await listAddresses(userId)).length;
  // La primera dirección de un usuario es predeterminada automáticamente,
  // aunque no lo haya marcado explícitamente — siempre debe haber una.
  const isDefault = input.isDefault || existingCount === 0;

  if (isDefault) await clearOtherDefaults(userId);

  const [created] = await db
    .insert(addresses)
    .values({ userId, ...input, isDefault })
    .returning();
  return created;
}

export async function updateAddress(userId: string, id: string, input: Partial<AddressInput>) {
  await findOwnedAddress(userId, id);
  if (input.isDefault) await clearOtherDefaults(userId, id);

  const [updated] = await db.update(addresses).set(input).where(eq(addresses.id, id)).returning();
  return updated;
}

export async function deleteAddress(userId: string, id: string) {
  const address = await findOwnedAddress(userId, id);
  await db.delete(addresses).where(eq(addresses.id, id));

  // Si la que se borró era la predeterminada, promueve otra (si queda alguna)
  // para que el checkout siempre tenga una dirección lista para preseleccionar.
  if (address.isDefault) {
    const remaining = await listAddresses(userId);
    if (remaining.length > 0) {
      await db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, remaining[0].id));
    }
  }
}
