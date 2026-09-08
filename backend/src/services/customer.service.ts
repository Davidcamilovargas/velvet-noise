import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { orders, users } from "../db/schema";
import { AppError } from "../utils/AppError";
import { sendEmail } from "../jobs/email.service";
import { accountDeactivatedEmail } from "../jobs/emailTemplates";
import { getStoreSettings } from "./settings.service";
import type { ListCustomersQuery } from "../validators/customer.validators";

const PAID_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

/** Lista clientes (rol CUSTOMER) con su número de pedidos y total gastado, calculado con SQL real. */
export async function listCustomers(query: ListCustomersQuery) {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      isActive: users.isActive,
      createdAt: users.createdAt,
      orderCount: sql<number>`count(${orders.id}) filter (where ${orders.status} in ('PAID','PROCESSING','SHIPPED','DELIVERED'))::int`,
      totalSpent: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} in ('PAID','PROCESSING','SHIPPED','DELIVERED')), 0)::numeric::float8`,
    })
    .from(users)
    .leftJoin(orders, eq(orders.userId, users.id))
    .where(eq(users.role, "CUSTOMER"))
    .groupBy(users.id)
    .orderBy(users.createdAt);

  if (!query.search) return rows;
  const term = query.search.trim().toLowerCase();
  return rows.filter(
    (r) =>
      r.email.toLowerCase().includes(term) ||
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(term) ||
      (r.phone ?? "").toLowerCase().includes(term)
  );
}

export async function getCustomerById(id: string) {
  const user = await db.query.users.findFirst({ where: and(eq(users.id, id), eq(users.role, "CUSTOMER")) });
  if (!user) throw AppError.notFound("Cliente no encontrado.");

  const customerOrders = await db.query.orders.findMany({
    where: eq(orders.userId, id),
    with: { items: true },
    orderBy: (o, { desc }) => desc(o.createdAt),
  });

  const paidOrders = customerOrders.filter((o) => PAID_STATUSES.includes(o.status as (typeof PAID_STATUSES)[number]));
  const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);

  const safeUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
  return { ...safeUser, orders: customerOrders, orderCount: paidOrders.length, totalSpent };
}

export async function setCustomerStatus(id: string, isActive: boolean) {
  const [updated] = await db
    .update(users)
    .set({ isActive })
    .where(and(eq(users.id, id), eq(users.role, "CUSTOMER")))
    .returning();
  if (!updated) throw AppError.notFound("Cliente no encontrado.");

  if (!isActive) {
    const { storeName } = await getStoreSettings();
    await sendEmail({ to: updated.email, ...accountDeactivatedEmail(storeName, updated.firstName) });
  }

  return updated;
}
