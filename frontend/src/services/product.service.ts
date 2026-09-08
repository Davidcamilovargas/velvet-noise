import { api } from "./api";
import type { Product, ProductListResponse, Category } from "../types/api";

export interface ProductFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "price_asc" | "price_desc" | "newest" | "popularity";
  inStock?: boolean;
  onSale?: boolean;
  featured?: boolean;
  page?: number;
  pageSize?: number;
}

export async function fetchProducts(filters: ProductFilters): Promise<ProductListResponse> {
  const res = await api.get<ProductListResponse>("/products", { params: filters });
  return res.data;
}

export async function fetchProductByIdOrSlug(idOrSlug: string): Promise<Product & { relatedProducts: Product[] }> {
  const res = await api.get<{ data: Product & { relatedProducts: Product[] } }>(`/products/${idOrSlug}`);
  return res.data.data;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await api.get<{ data: Category[] }>("/categories");
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Gestión admin de productos (Fase 12) — el backend ya la exponía desde la
// Fase 7 (product.routes.ts), solo faltaba esta capa de frontend.
// ---------------------------------------------------------------------------

export interface ProductVariantInput {
  color?: string;
  size?: string;
  sku?: string;
  priceOverride?: number;
  stock: number;
}

export interface ProductFormInput {
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  sku?: string;
  categoryId: string;
  isActive?: boolean;
  isFeatured?: boolean;
  minStock?: number;
  stock?: number;
  images?: { url: string; altText?: string; isPrimary?: boolean }[];
  variants?: ProductVariantInput[];
}

/** `all=true` incluye productos inactivos — solo un admin autenticado puede pedirlo (el backend lo re-valida por rol). */
export async function fetchAdminProducts(filters: ProductFilters = {}): Promise<ProductListResponse> {
  const res = await api.get<ProductListResponse>("/products", { params: { ...filters, all: true, pageSize: 60 } });
  return res.data;
}

export async function createProduct(input: ProductFormInput): Promise<Product> {
  const res = await api.post<{ data: Product }>("/products", input);
  return res.data.data;
}

export async function updateProduct(id: string, input: Partial<ProductFormInput>): Promise<Product> {
  const res = await api.put<{ data: Product }>(`/products/${id}`, input);
  return res.data.data;
}

export async function setProductStatus(id: string, isActive: boolean): Promise<Product> {
  const res = await api.patch<{ data: Product }>(`/products/${id}/status`, { isActive });
  return res.data.data;
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/products/${id}`);
}
