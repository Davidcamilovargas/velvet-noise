import { api } from "./api";

export interface BackendCartItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string | null;
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  stock: number;
  exceedsStock: boolean;
}

export interface BackendCart {
  id: string;
  items: BackendCartItem[];
  subtotal: number;
  discountTotal: number;
  couponCode: string | null;
  couponError: string | null;
  taxTotal: number;
  taxPercentage: number;
  shippingTotal: number;
  total: number;
}

async function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await promise;
  return res.data.data;
}

export const getBackendCart = () => unwrap<BackendCart>(api.get("/cart"));

export const addBackendCartItem = (productId: string, variantId: string | undefined, quantity: number) =>
  unwrap<BackendCart>(api.post("/cart/items", { productId, variantId, quantity }));

export const updateBackendCartItem = (itemId: string, quantity: number) =>
  unwrap<BackendCart>(api.put(`/cart/items/${itemId}`, { quantity }));

export const removeBackendCartItem = (itemId: string) => unwrap<BackendCart>(api.delete(`/cart/items/${itemId}`));

export const applyBackendCoupon = (code: string) => unwrap<BackendCart>(api.post("/cart/coupon", { code }));

export const removeBackendCoupon = () => unwrap<BackendCart>(api.delete("/cart/coupon"));

export const mergeGuestCartToBackend = (items: { productId: string; variantId: string | null; quantity: number }[]) =>
  unwrap<BackendCart>(api.post("/cart/merge", { items }));
