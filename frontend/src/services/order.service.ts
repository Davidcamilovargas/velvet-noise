import { api } from "./api";
import type { Order, ShippingMethod } from "../types/api";

export interface CreateOrderInput {
  shippingMethod: ShippingMethod;
  addressId?: string;
  newAddress?: {
    label: string;
    department: string;
    city: string;
    addressLine: string;
    complement?: string;
    postalCode?: string;
    saveAddress?: boolean;
  };
  customerPhone: string;
  notes?: string;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const res = await api.post<{ data: Order }>("/orders", input);
  return res.data.data;
}

export async function listOrders(filters: { status?: string; search?: string } = {}): Promise<Order[]> {
  const res = await api.get<{ data: Order[] }>("/orders", { params: filters });
  return res.data.data;
}

export async function fetchOrderById(id: string): Promise<Order> {
  const res = await api.get<{ data: Order }>(`/orders/${id}`);
  return res.data.data;
}

export interface UpdateOrderStatusInput {
  status: Order["status"];
  carrier?: string;
  trackingNumber?: string;
  reason?: string;
}

/** Cambio de estado desde el panel admin (Fase 12) — ver docs/03-api.md ADMIN/ORDERS. */
export async function updateOrderStatus(id: string, input: UpdateOrderStatusInput): Promise<Order> {
  const res = await api.put<{ data: Order }>(`/orders/${id}/status`, input);
  return res.data.data;
}
