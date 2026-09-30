import { api } from "./api";
import type { Product, ProductListResponse, Category, ProductImage, ProductView360Frame } from "../types/api";

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

// ---------------------------------------------------------------------------
// AGREGADO: subida de archivos reales (fotos/gifs/videos/frames 360°) —
// reemplaza el flujo antiguo de escribir un link a mano. El admin elige el
// producto, sube los archivos, y este módulo los manda al backend, que los
// guarda en Cloudinary organizados por categoría y devuelve las filas ya
// creadas en la base de datos.
// ---------------------------------------------------------------------------

/** Sube una o varias fotos/gifs/videos elegidos individualmente en el explorador de archivos. */
export async function uploadProductImages(productId: string, files: File[]): Promise<ProductImage[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await api.post<{ data: ProductImage[] }>(`/products/${productId}/images/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

/** Sube un único .zip con muchas fotos adentro (Fase 2 — bulk upload). */
export async function uploadProductImagesZip(productId: string, zipFile: File): Promise<ProductImage[]> {
  const formData = new FormData();
  formData.append("file", zipFile);
  const res = await api.post<{ data: ProductImage[] }>(`/products/${productId}/images/upload-zip`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}

export async function deleteProductImage(productId: string, imageId: string): Promise<void> {
  await api.delete(`/products/${productId}/images/${imageId}`);
}

export async function setPrimaryProductImage(productId: string, imageId: string): Promise<void> {
  await api.patch(`/products/${productId}/images/${imageId}/primary`);
}

export async function reorderProductImages(productId: string, imageIds: string[]): Promise<void> {
  await api.patch(`/products/${productId}/images/reorder`, { imageIds });
}

/** Sube los frames de la vista 360° interactiva, en el orden en que se seleccionaron. */
export async function uploadProduct360Frames(productId: string, files: File[]): Promise<ProductView360Frame[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await api.post<{ data: ProductView360Frame[] }>(`/products/${productId}/view360/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}
