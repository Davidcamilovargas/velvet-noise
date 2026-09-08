import { and, avg, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { orderItems, orders, products, reviews, users } from "../db/schema";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";
import { sendEmail } from "../jobs/email.service";
import { reviewApprovedEmail } from "../jobs/emailTemplates";
import { getStoreSettings } from "./settings.service";
import type { CreateReviewInput, ListAdminReviewsQuery } from "../validators/review.validators";

/** Reseñas APROBADAS de un producto — lo único que ve el público en la ficha de producto. */
export async function listApprovedReviews(productId: string) {
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(and(eq(reviews.productId, productId), eq(reviews.isApproved, true)))
    .orderBy(desc(reviews.createdAt));

  // Solo se muestra nombre + inicial del apellido, nunca el apellido completo
  // ni el correo — una reseña pública no debe exponer más identidad de la
  // que el propio autor esperaría ver en cualquier tienda real.
  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
    authorName: `${r.firstName} ${r.lastName.charAt(0)}.`,
  }));
}

async function recomputeProductRating(productId: string) {
  const [agg] = await db
    .select({ avgRating: avg(reviews.rating), total: count() })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.isApproved, true)));

  await db
    .update(products)
    .set({
      ratingAverage: agg.total > 0 ? Number(agg.avgRating).toFixed(2) : "0",
      ratingCount: agg.total,
    })
    .where(eq(products.id, productId));
}

// Estados de pedido que cuentan como "compra confirmada" para efectos de
// habilitar una reseña — el mismo criterio que "pagado" en dashboard.service.ts
// y customer.service.ts (PENDING/CANCELLED/REFUNDED no cuentan: nunca se
// cobró, o el dinero se devolvió).
const PURCHASE_QUALIFYING_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export async function createReview(userId: string, input: CreateReviewInput) {
  const product = await db.query.products.findFirst({ where: eq(products.id, input.productId) });
  if (!product) throw AppError.notFound("Producto no encontrado.");

  // Compra verificada: se busca automáticamente un pedido pagado del propio
  // usuario que contenga este producto, en vez de confiar en que el cliente
  // indique cuál — así no hay forma de reseñar un producto que nunca se
  // compró simplemente omitiendo o falseando ese dato desde el frontend.
  const [purchase] = await db
    .select({ orderId: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.productId, input.productId),
        inArray(orders.status, PURCHASE_QUALIFYING_STATUSES)
      )
    )
    .limit(1);

  if (!purchase) {
    throw AppError.badRequest(
      "Solo puedes reseñar productos que hayas comprado y pagado.",
      "VERIFIED_PURCHASE_REQUIRED"
    );
  }

  try {
    const [review] = await db
      .insert(reviews)
      .values({
        productId: input.productId,
        userId,
        orderId: purchase.orderId,
        rating: input.rating,
        comment: input.comment,
        isApproved: false,
      })
      .returning();
    return review;
  } catch (error) {
    const pgCode = (error as { cause?: { code?: string }; code?: string })?.cause?.code ?? (error as { code?: string })?.code;
    if (pgCode === "23505") {
      throw AppError.conflict("Ya escribiste una reseña para este producto.", "REVIEW_ALREADY_EXISTS");
    }
    throw error;
  }
}

/** Reseñas pendientes/aprobadas/todas para el panel admin, con datos de producto y autor. */
export async function listReviewsForAdmin(query: ListAdminReviewsQuery) {
  const condition =
    query.status === "pending" ? eq(reviews.isApproved, false) : query.status === "approved" ? eq(reviews.isApproved, true) : undefined;

  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      isApproved: reviews.isApproved,
      createdAt: reviews.createdAt,
      productId: reviews.productId,
      productName: products.name,
      customerFirstName: users.firstName,
      customerLastName: users.lastName,
      customerEmail: users.email,
    })
    .from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(condition)
    .orderBy(desc(reviews.createdAt));
}

export async function setReviewStatus(id: string, isApproved: boolean) {
  const existing = await db.query.reviews.findFirst({ where: eq(reviews.id, id), with: { product: true, user: true } });
  if (!existing) throw AppError.notFound("Reseña no encontrada.");

  const [updated] = await db.update(reviews).set({ isApproved }).where(eq(reviews.id, id)).returning();
  await recomputeProductRating(existing.productId);

  // Solo se notifica la transición real de pendiente -> aprobada (no un
  // "rechazar" ni un "aprobar" repetido sobre una reseña que ya lo estaba).
  if (isApproved && !existing.isApproved) {
    const { storeName } = await getStoreSettings();
    const productUrl = `${env.FRONTEND_URL}/product/${existing.product.slug}`;
    await sendEmail({
      to: existing.user.email,
      ...reviewApprovedEmail(storeName, existing.user.firstName, existing.product.name, productUrl),
    });
  }

  return updated;
}

export async function deleteReview(id: string): Promise<void> {
  const existing = await db.query.reviews.findFirst({ where: eq(reviews.id, id) });
  if (!existing) throw AppError.notFound("Reseña no encontrada.");

  await db.delete(reviews).where(eq(reviews.id, id));
  if (existing.isApproved) await recomputeProductRating(existing.productId);
}
