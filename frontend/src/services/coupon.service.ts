import { api } from "./api";
import type { Coupon, DiscountType } from "../types/api";

export interface CouponFormInput {
  code?: string; // solo al crear — el código nunca se edita (ver docs/03-api.md)
  discountType: DiscountType;
  percentage?: number;
  fixedAmount?: number;
  startsAt: string;
  expiresAt: string;
  maxUses?: number | null;
  maxUsesPerUser?: number;
  minPurchase?: number | null;
  isActive?: boolean;
}

export async function fetchCoupons(): Promise<Coupon[]> {
  const res = await api.get<{ data: Coupon[] }>("/coupons");
  return res.data.data;
}

export async function createCoupon(input: CouponFormInput): Promise<Coupon> {
  const res = await api.post<{ data: Coupon }>("/coupons", input);
  return res.data.data;
}

export async function updateCoupon(id: string, input: Partial<CouponFormInput>): Promise<Coupon> {
  const res = await api.put<{ data: Coupon }>(`/coupons/${id}`, input);
  return res.data.data;
}

export async function setCouponStatus(id: string, isActive: boolean): Promise<Coupon> {
  const res = await api.patch<{ data: Coupon }>(`/coupons/${id}/status`, { isActive });
  return res.data.data;
}

export async function deleteCoupon(id: string): Promise<void> {
  await api.delete(`/coupons/${id}`);
}
