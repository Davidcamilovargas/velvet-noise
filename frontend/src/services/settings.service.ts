import { api } from "./api";
import type { StoreSettings } from "../types/api";

export async function fetchStoreSettings(): Promise<StoreSettings> {
  const res = await api.get<{ data: StoreSettings }>("/admin/settings");
  return res.data.data;
}

export interface UpdateStoreSettingsInput {
  storeName?: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  currency?: string;
  taxPercentage?: number;
  shippingMethods?: Record<string, { label?: string; price?: number; etaDays?: number }>;
}

export async function updateStoreSettings(input: UpdateStoreSettingsInput): Promise<StoreSettings> {
  const res = await api.put<{ data: StoreSettings }>("/admin/settings", input);
  return res.data.data;
}
