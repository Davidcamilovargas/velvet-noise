import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { inventory, inventoryMovements, products, productVariants } from "../db/schema";
import { AppError } from "../utils/AppError";
import type { AdjustInventoryInput, ListInventoryQuery } from "../validators/inventory.validators";

export interface InventoryRow {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  variantId: string | null;
  variantLabel: string | null;
  variantSku: string | null;
  stock: number;
  minStock: number;
  updatedAt: Date;
}

/** Lista el inventario completo con el nombre de producto/variante ya resuelto, para la tabla del panel admin. */
export async function listInventory(query: ListInventoryQuery): Promise<InventoryRow[]> {
  const rows = await db
    .select({
      id: inventory.id,
      productId: inventory.productId,
      productName: products.name,
      productSku: products.sku,
      variantId: productVariants.id,
      color: productVariants.color,
      size: productVariants.size,
      variantSku: productVariants.sku,
      stock: inventory.stock,
      minStock: inventory.minStock,
      updatedAt: inventory.updatedAt,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .leftJoin(productVariants, eq(inventory.variantId, productVariants.id))
    .orderBy(products.name);

  let mapped: InventoryRow[] = rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    productSku: r.productSku,
    variantId: r.variantId,
    variantLabel: [r.color, r.size].filter(Boolean).join(" / ") || null,
    variantSku: r.variantSku,
    stock: r.stock,
    minStock: r.minStock,
    updatedAt: r.updatedAt,
  }));

  if (query.lowStockOnly) mapped = mapped.filter((r) => r.stock <= r.minStock);
  if (query.search) {
    const term = query.search.trim().toLowerCase();
    mapped = mapped.filter(
      (r) =>
        r.productName.toLowerCase().includes(term) ||
        r.productSku.toLowerCase().includes(term) ||
        r.variantSku?.toLowerCase().includes(term)
    );
  }
  return mapped;
}

/**
 * Ajusta el stock de una fila de inventario con un delta (nunca un valor
 * absoluto) dentro de una transacción con bloqueo de fila, para que un
 * ajuste manual jamás pise una venta concurrente que esté descontando la
 * misma variante (mismo patrón que payment.service.ts / order.service.ts).
 */
export async function adjustInventory(inventoryId: string, input: AdjustInventoryInput, adminUserId: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(inventory).where(eq(inventory.id, inventoryId)).for("update");
    if (!row) throw AppError.notFound("Registro de inventario no encontrado.");

    const newStock = row.stock + input.quantity;
    if (newStock < 0) {
      throw AppError.badRequest(
        `El ajuste dejaría el stock en ${newStock}. El stock nunca puede quedar negativo (disponible: ${row.stock}).`,
        "INVENTORY_NEGATIVE_STOCK"
      );
    }

    await tx.update(inventory).set({ stock: sql`${inventory.stock} + ${input.quantity}` }).where(eq(inventory.id, inventoryId));
    await tx.insert(inventoryMovements).values({
      inventoryId,
      type: "ADJUSTMENT",
      quantity: input.quantity,
      reason: input.reason,
      createdById: adminUserId,
    });

    return { ...row, stock: newStock };
  });
}

export async function listInventoryMovements(inventoryId: string) {
  const row = await db.query.inventory.findFirst({ where: eq(inventory.id, inventoryId) });
  if (!row) throw AppError.notFound("Registro de inventario no encontrado.");
  return db.query.inventoryMovements.findMany({
    where: eq(inventoryMovements.inventoryId, inventoryId),
    orderBy: (m, { desc }) => desc(m.createdAt),
    limit: 50,
  });
}
