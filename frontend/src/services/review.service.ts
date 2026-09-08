import { api } from "./api";
import type { AdminReview, Review } from "../types/api";

/** Reseñas aprobadas de un producto — lo que ve cualquier visitante en la ficha de producto. */
export async function fetchProductReviews(productId: string): Promise<Review[]> {
  const res = await api.get<{ data: Review[] }>("/reviews", { params: { productId } });
  return res.data.data;
}

// El backend detecta la compra verificada por su cuenta (Fase 13) — el
// cliente nunca indica de qué pedido viene la reseña.
export async function createReview(input: { productId: string; rating: number; comment: string }): Promise<Review> {
  const res = await api.post<{ data: Review }>("/reviews", input);
  return res.data.data;
}

export async function fetchAdminReviews(status: "pending" | "approved" | "all" = "pending"): Promise<AdminReview[]> {
  const res = await api.get<{ data: AdminReview[] }>("/admin/reviews", { params: { status } });
  return res.data.data;
}

export async function setReviewStatus(id: string, isApproved: boolean): Promise<AdminReview> {
  const res = await api.patch<{ data: AdminReview }>(`/admin/reviews/${id}/status`, { isApproved });
  return res.data.data;
}

export async function deleteReview(id: string): Promise<void> {
  await api.delete(`/admin/reviews/${id}`);
}
