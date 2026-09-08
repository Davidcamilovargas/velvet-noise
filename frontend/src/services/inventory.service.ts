import { api } from "./api";
import type { InventoryItem, InventoryMovement } from "../types/api";

export async function fetchInventory(filters: { search?: string; lowStockOnly?: boolean } = {}): Promise<InventoryItem[]> {
  const res = await api.get<{ data: InventoryItem[] }>("/admin/inventory", { params: filters });
  return res.data.data;
}

export async function adjustInventory(id: string, quantity: number, reason: string): Promise<InventoryItem> {
  const res = await api.patch<{ data: InventoryItem }>(`/admin/inventory/${id}/adjust`, { quantity, reason });
  return res.data.data;
}

export async function fetchInventoryMovements(id: string): Promise<InventoryMovement[]> {
  const res = await api.get<{ data: InventoryMovement[] }>(`/admin/inventory/${id}/movements`);
  return res.data.data;
}
