import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { orders, orderItems, inventory, products, productVariants } from "../db/schema";

/**
 * Todas las métricas del dashboard se calculan con SQL real contra las
 * tablas de pedidos/inventario — nada aquí es un número inventado. En una
 * tienda recién instalada (sin pedidos todavía) los totales legítimamente
 * salen en cero: eso es correcto, no un error.
 */

export interface DashboardSummary {
  totalRevenue: number;
  totalOrders: number;
  paidOrders: number;
  pendingPaymentOrders: number;
  averageOrderValue: number;
  ordersByStatus: { status: string; count: number }[];
  salesLast14Days: { date: string; total: number; orders: number }[];
  topProducts: { productId: string; name: string; quantitySold: number; revenue: number }[];
  lowStockItems: { variantId: string; productName: string; variantLabel: string | null; stock: number; minStock: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customerFirstName: string;
    customerLastName: string;
    total: string;
    status: string;
    paymentStatus: string;
    createdAt: Date;
  }[];
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [totals] = await db
    .select({
      totalRevenue: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} in ('PAID','PROCESSING','SHIPPED','DELIVERED')), 0)`,
      totalOrders: sql<number>`count(*)`,
      paidOrders: sql<number>`count(*) filter (where ${orders.status} in ('PAID','PROCESSING','SHIPPED','DELIVERED'))`,
      pendingPaymentOrders: sql<number>`count(*) filter (where ${orders.paymentStatus} = 'PENDING')`,
    })
    .from(orders);

  const totalRevenue = Number(totals?.totalRevenue ?? 0);
  const totalOrders = Number(totals?.totalOrders ?? 0);
  const paidOrders = Number(totals?.paidOrders ?? 0);
  const pendingPaymentOrders = Number(totals?.pendingPaymentOrders ?? 0);
  const averageOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;

  const ordersByStatusRows = await db
    .select({ status: orders.status, count: sql<number>`count(*)` })
    .from(orders)
    .groupBy(orders.status);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  const salesRows = await db
    .select({
      date: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
      total: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} in ('PAID','PROCESSING','SHIPPED','DELIVERED')), 0)`,
      orders: sql<number>`count(*) filter (where ${orders.status} in ('PAID','PROCESSING','SHIPPED','DELIVERED'))`,
    })
    .from(orders)
    .where(gte(orders.createdAt, fourteenDaysAgo))
    .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`);

  // Rellena los días sin ventas con 0 — un gráfico con huecos es más difícil
  // de leer que uno con la serie completa de los últimos 14 días.
  const salesByDate = new Map(salesRows.map((r) => [r.date, { total: Number(r.total), orders: Number(r.orders) }]));
  const salesLast14Days: DashboardSummary["salesLast14Days"] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const found = salesByDate.get(key);
    salesLast14Days.push({ date: key, total: found?.total ?? 0, orders: found?.orders ?? 0 });
  }

  const topProductsRows = await db
    .select({
      productId: orderItems.productId,
      name: sql<string>`max(${orderItems.productNameSnapshot})`,
      quantitySold: sql<number>`sum(${orderItems.quantity})`,
      revenue: sql<string>`sum(${orderItems.subtotal})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(sql`${orders.status} in ('PAID','PROCESSING','SHIPPED','DELIVERED')`)
    .groupBy(orderItems.productId)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(5);

  const lowStockRows = await db
    .select({
      variantId: inventory.variantId,
      productName: products.name,
      color: productVariants.color,
      size: productVariants.size,
      stock: inventory.stock,
      minStock: inventory.minStock,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .leftJoin(productVariants, eq(inventory.variantId, productVariants.id))
    .where(and(eq(products.isActive, true), sql`${inventory.stock} <= ${inventory.minStock}`))
    .orderBy(inventory.stock)
    .limit(10);

  const recentOrdersRows = await db.query.orders.findMany({
    orderBy: [desc(orders.createdAt)],
    limit: 10,
    columns: {
      id: true,
      orderNumber: true,
      customerFirstName: true,
      customerLastName: true,
      total: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
    },
  });

  return {
    totalRevenue,
    totalOrders,
    paidOrders,
    pendingPaymentOrders,
    averageOrderValue,
    ordersByStatus: ordersByStatusRows.map((r) => ({ status: r.status, count: Number(r.count) })),
    salesLast14Days,
    topProducts: topProductsRows.map((r) => ({
      productId: r.productId,
      name: r.name,
      quantitySold: Number(r.quantitySold),
      revenue: Number(r.revenue),
    })),
    lowStockItems: lowStockRows.map((r) => ({
      variantId: r.variantId!,
      productName: r.productName,
      variantLabel: [r.color, r.size].filter(Boolean).join(" / ") || null,
      stock: r.stock,
      minStock: r.minStock,
    })),
    recentOrders: recentOrdersRows,
  };
}
