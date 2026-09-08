import { api } from "./api";
import type { ShippingMethodOption } from "../types/api";

export async function fetchShippingMethods(): Promise<ShippingMethodOption[]> {
  const res = await api.get<{ data: ShippingMethodOption[] }>("/shipping-methods");
  return res.data.data;
}
