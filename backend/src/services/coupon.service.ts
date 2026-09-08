import { and, count, eq } from "drizzle-orm";
import { db } from "../db/client";
import { coupons, couponUsages, carts } from "../db/schema";
import { AppError } from "../utils/AppError";
import type { UpdateCouponInput } from "../validators/coupon.validators";

export interface CouponEvaluation {
  coupon: typeof coupons.$inferSelect;
  discountAmount: number;
}

/**
 * Valida un cupón contra el subtotal y el usuario actuales. Se llama tanto
 * desde el carrito (estimación) como, de forma independiente y autoritativa,
 * al crear el pedido (Fase 9/10) — nunca se confía en que el frontend ya
 * "validó" el cupón antes.
 */
export async function evaluateCoupon(code: string, subtotal: number, userId: string): Promise<CouponEvaluation> {
  const coupon = await db.query.coupons.findFirst({ where: eq(coupons.code, code.trim().toUpperCase()) });
  if (!coupon) throw AppError.badRequest("El cupón ingresado no existe.", "COUPON_NOT_FOUND");
  if (!coupon.isActive) throw AppError.badRequest("Este cupón ya no está disponible.", "COUPON_INACTIVE");

  const now = new Date();
  if (now < coupon.startsAt) throw AppError.badRequest("Este cupón todavía no está vigente.", "COUPON_NOT_STARTED");
  if (now > coupon.expiresAt) throw AppError.badRequest("Este cupón ha expirado.", "COUPON_EXPIRED");

  if (coupon.minPurchase && subtotal < Number(coupon.minPurchase)) {
    throw AppError.badRequest(
      `Este cupón requiere una compra mínima de ${coupon.minPurchase}.`,
      "COUPON_MIN_PURCHASE"
    );
  }

  if (coupon.maxUses != null) {
    const [{ value: totalUses }] = await db
      .select({ value: count() })
      .from(couponUsages)
      .where(eq(couponUsages.couponId, coupon.id));
    if (totalUses >= coupon.maxUses) {
      throw AppError.badRequest("Este cupón alcanzó su límite de usos.", "COUPON_MAX_USES");
    }
  }

  const [{ value: userUses }] = await db
    .select({ value: count() })
    .from(couponUsages)
    .where(and(eq(couponUsages.couponId, coupon.id), eq(couponUsages.userId, userId)));
  if (userUses >= coupon.maxUsesPerUser) {
    throw AppError.badRequest("Ya usaste este cupón el máximo de veces permitido.", "COUPON_MAX_USES_PER_USER");
  }

  const discountAmount =
    coupon.discountType === "PERCENTAGE"
      ? Math.round(subtotal * (Number(coupon.percentage) / 100) * 100) / 100
      : Math.min(Number(coupon.fixedAmount), subtotal);

  return { coupon, discountAmount };
}

export interface CreateCouponInput {
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  percentage?: number;
  fixedAmount?: number;
  startsAt: string;
  expiresAt: string;
  maxUses?: number | null;
  maxUsesPerUser?: number;
  minPurchase?: number | null;
  isActive?: boolean;
}

export async function createCoupon(input: CreateCouponInput) {
  const [coupon] = await db
    .insert(coupons)
    .values({
      code: input.code.trim().toUpperCase(),
      discountType: input.discountType,
      percentage: input.percentage != null ? input.percentage.toFixed(2) : null,
      fixedAmount: input.fixedAmount != null ? input.fixedAmount.toFixed(2) : null,
      startsAt: new Date(input.startsAt),
      expiresAt: new Date(input.expiresAt),
      maxUses: input.maxUses,
      maxUsesPerUser: input.maxUsesPerUser ?? 1,
      minPurchase: input.minPurchase != null ? input.minPurchase.toFixed(2) : null,
      isActive: input.isActive ?? true,
    })
    .returning();
  return coupon;
}

export async function listCoupons() {
  return db.query.coupons.findMany({ orderBy: (c, { desc }) => desc(c.createdAt) });
}

export async function updateCoupon(id: string, input: UpdateCouponInput) {
  const existing = await db.query.coupons.findFirst({ where: eq(coupons.id, id) });
  if (!existing) throw AppError.notFound("Cupón no encontrado.");

  const [updated] = await db
    .update(coupons)
    .set({
      ...(input.discountType !== undefined ? { discountType: input.discountType } : {}),
      ...(input.percentage !== undefined ? { percentage: input.percentage.toFixed(2) } : {}),
      ...(input.fixedAmount !== undefined ? { fixedAmount: input.fixedAmount.toFixed(2) } : {}),
      ...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: new Date(input.expiresAt) } : {}),
      ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
      ...(input.maxUsesPerUser !== undefined ? { maxUsesPerUser: input.maxUsesPerUser } : {}),
      ...(input.minPurchase !== undefined ? { minPurchase: input.minPurchase != null ? input.minPurchase.toFixed(2) : null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    })
    .where(eq(coupons.id, id))
    .returning();
  return updated;
}

export async function setCouponStatus(id: string, isActive: boolean) {
  const [updated] = await db.update(coupons).set({ isActive }).where(eq(coupons.id, id)).returning();
  if (!updated) throw AppError.notFound("Cupón no encontrado.");
  return updated;
}

export async function deleteCoupon(id: string): Promise<void> {
  const existing = await db.query.coupons.findFirst({ where: eq(coupons.id, id) });
  if (!existing) throw AppError.notFound("Cupón no encontrado.");

  // Un carrito que tiene este cupón "aplicado" todavía no lo ha CONSUMIDO
  // (eso solo ocurre al crear un pedido, ver coupon_usages) — es seguro
  // desvincularlo antes de borrar el cupón, en vez de bloquear el borrado.
  await db.update(carts).set({ couponId: null }).where(eq(carts.couponId, id));
  await db.delete(coupons).where(eq(coupons.id, id));
}
