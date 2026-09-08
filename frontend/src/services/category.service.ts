import { api } from "./api";
import type { Category } from "../types/api";

export interface CategoryFormInput {
  name: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
}

/** `all=true` incluye categorías inactivas — solo tiene efecto si quien pregunta es ADMIN (el backend re-valida el rol). */
export async function fetchAdminCategories(): Promise<Category[]> {
  const res = await api.get<{ data: Category[] }>("/categories", { params: { all: true } });
  return res.data.data;
}

export async function createCategory(input: CategoryFormInput): Promise<Category> {
  const res = await api.post<{ data: Category }>("/categories", input);
  return res.data.data;
}

export async function updateCategory(id: string, input: Partial<CategoryFormInput>): Promise<Category> {
  const res = await api.put<{ data: Category }>(`/categories/${id}`, input);
  return res.data.data;
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/categories/${id}`);
}
