/**
 * Tipos que reflejan el contrato de la API (ver docs/03-api.md). Los montos
 * viajan como string (igual que Postgres `numeric` vía Drizzle) para evitar
 * errores de precisión de punto flotante; se formatean para mostrar con
 * `utils/format.ts` y solo se convierten a number para cálculos puntuales
 * de UI (nunca para lo que se envía al backend, que siempre recalcula).
 */

export type Role = "CUSTOMER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  position: number;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  color: string | null;
  size: string | null;
  isDefault: boolean;
  priceOverride: string | null;
  imageUrl: string | null;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  compareAtPrice: string | null;
  sku: string;
  categoryId: string;
  category?: Category;
  isActive: boolean;
  isFeatured: boolean;
  ratingAverage: string;
  ratingCount: number;
  images: ProductImage[];
  variants: ProductVariant[];
  stock: number;
  createdAt: string;
}

export interface ProductListResponse {
  data: Product[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export type OrderStatus = "PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
export type PaymentStatus = "PENDING" | "APPROVED" | "DECLINED" | "REFUNDED";
export type ShippingMethod = "STANDARD" | "EXPRESS" | "PICKUP";

export interface Address {
  id: string;
  label: string;
  department: string;
  city: string;
  addressLine: string;
  complement: string | null;
  postalCode: string | null;
  isDefault: boolean;
}

export interface ShippingMethodOption {
  method: ShippingMethod;
  label: string;
  price: number;
  etaDays: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string | null;
  productNameSnapshot: string;
  skuSnapshot: string;
  unitPrice: string;
  quantity: number;
  subtotal: string;
}

export type ShipmentStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "RETURNED";

export interface Shipment {
  id: string;
  carrier: string | null;
  trackingNumber: string | null;
  status: ShipmentStatus;
  shippedAt: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  total: string;
  currency: string;
  shippingMethod: ShippingMethod;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  addressSnapshot: Record<string, unknown>;
  items: OrderItem[];
  shipments: Shipment[];
  createdAt: string;
}

export interface DashboardSummary {
  totalRevenue: number;
  totalOrders: number;
  paidOrders: number;
  pendingPaymentOrders: number;
  averageOrderValue: number;
  ordersByStatus: { status: OrderStatus; count: number }[];
  salesLast14Days: { date: string; total: number; orders: number }[];
  topProducts: { productId: string; name: string; quantitySold: number; revenue: number }[];
  lowStockItems: { variantId: string; productName: string; variantLabel: string | null; stock: number; minStock: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customerFirstName: string;
    customerLastName: string;
    total: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    createdAt: string;
  }[];
}

export type DiscountType = "PERCENTAGE" | "FIXED";

export interface Coupon {
  id: string;
  code: string;
  discountType: DiscountType;
  percentage: string | null;
  fixedAmount: string | null;
  startsAt: string;
  expiresAt: string;
  maxUses: number | null;
  maxUsesPerUser: number;
  minPurchase: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  variantId: string | null;
  variantLabel: string | null;
  variantSku: string | null;
  stock: number;
  minStock: number;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT" | "SALE" | "RETURN";
  quantity: number;
  reason: string | null;
  orderId: string | null;
  createdAt: string;
}

export interface CustomerSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
}

export interface CustomerDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  orders: Order[];
  orderCount: number;
  totalSpent: number;
}

export interface StoreSettings {
  storeName: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  currency: string;
  taxPercentage: string;
  shippingMethods: Record<string, { label?: string; price?: number; etaDays?: number }> | null;
  updatedAt: string | null;
}

export interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  authorName: string;
}

export interface AdminReview {
  id: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  createdAt: string;
  productId: string;
  productName: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  adminEmail: string | null;
  adminFirstName: string | null;
  adminLastName: string | null;
}

export interface ApiErrorBody {
  error: {
    message: string;
    code?: string;
    correlationId?: string;
    details?: { path: string; message: string }[];
  };
}
