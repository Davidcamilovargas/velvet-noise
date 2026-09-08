/**
 * Esquema de base de datos (Drizzle ORM + PostgreSQL).
 *
 * Nota de arquitectura (Fase 3): el diseño original (docs/01-arquitectura.md)
 * eligió Prisma como ORM. Durante la implementación de esta fase se detectó
 * que este entorno de desarrollo en la nube bloquea por política de red la
 * descarga de los binarios nativos de Prisma (`binaries.prisma.sh`, usados
 * tanto por `prisma generate` como por `prisma migrate`), lo que hace
 * imposible generar el cliente o correr migraciones aquí — y por lo tanto
 * imposible *verificar* que la capa de datos funciona de verdad, algo que la
 * regla #36 del proyecto exige ("no simulación").
 *
 * Se cambió a Drizzle ORM: 100% TypeScript/JS puro (sin binarios nativos que
 * descargar), type-safe, con el mismo soporte de transacciones y bloqueo de
 * filas (`FOR UPDATE`) que necesita el control de concurrencia de inventario
 * (Fase 10/12). Es un cambio de herramienta, no de modelo de datos: las
 * tablas, relaciones e índices son exactamente los definidos en
 * docs/01-arquitectura.md §5. Este cambio queda documentado también en
 * docs/02-modelo-datos.md.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["CUSTOMER", "ADMIN"]);
export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "APPROVED", "DECLINED", "REFUNDED"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["WOMPI", "MERCADO_PAGO", "MANUAL"]);
export const shipmentStatusEnum = pgEnum("shipment_status", [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
  "RETURNED",
]);
export const discountTypeEnum = pgEnum("discount_type", ["PERCENTAGE", "FIXED"]);
export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "IN",
  "OUT",
  "ADJUSTMENT",
  "SALE",
  "RETURN",
]);
export const shippingMethodEnum = pgEnum("shipping_method", ["STANDARD", "EXPRESS", "PICKUP"]);

const id = () => uuid("id").defaultRandom().primaryKey();
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// USUARIOS Y AUTENTICACIÓN
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: id(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    role: roleEnum("role").notNull().default("CUSTOMER"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    roleIdx: index("users_role_idx").on(table.role),
  })
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 64 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("refresh_tokens_token_hash_idx").on(table.tokenHash),
    userIdx: index("refresh_tokens_user_idx").on(table.userId),
  })
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("password_reset_tokens_token_hash_idx").on(table.tokenHash),
    userIdx: index("password_reset_tokens_user_idx").on(table.userId),
  })
);

export const addresses = pgTable(
  "addresses",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 60 }).notNull().default("Casa"),
    department: varchar("department", { length: 120 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    addressLine: text("address_line").notNull(),
    complement: text("complement"),
    postalCode: varchar("postal_code", { length: 20 }),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    userIdx: index("addresses_user_idx").on(table.userId),
  })
);

// ---------------------------------------------------------------------------
// CATÁLOGO
// ---------------------------------------------------------------------------

export const categories = pgTable(
  "categories",
  {
    id: id(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    slugIdx: uniqueIndex("categories_slug_idx").on(table.slug),
  })
);

export const products = pgTable(
  "products",
  {
    id: id(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull(),
    description: text("description").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 12, scale: 2 }),
    sku: varchar("sku", { length: 80 }).notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    weightKg: numeric("weight_kg", { precision: 8, scale: 3 }),
    lengthCm: numeric("length_cm", { precision: 8, scale: 2 }),
    widthCm: numeric("width_cm", { precision: 8, scale: 2 }),
    heightCm: numeric("height_cm", { precision: 8, scale: 2 }),
    ratingAverage: numeric("rating_average", { precision: 3, scale: 2 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),
    ...timestamps,
  },
  (table) => ({
    slugIdx: uniqueIndex("products_slug_idx").on(table.slug),
    skuIdx: uniqueIndex("products_sku_idx").on(table.sku),
    categoryIdx: index("products_category_idx").on(table.categoryId),
    activeFeaturedIdx: index("products_active_featured_idx").on(table.isActive, table.isFeatured),
    // Fase 16: "productos activos de esta categoría" (Shop.tsx filtrando por
    // categoría) es una de las consultas más comunes de la tienda pública —
    // antes solo existía el índice por categoryId solo, así que Postgres
    // tenía que filtrar isActive después de encontrar la categoría en vez
    // de poder usar un único índice para ambas condiciones a la vez.
    categoryActiveIdx: index("products_category_active_idx").on(table.categoryId, table.isActive),
  })
);

export const productImages = pgTable(
  "product_images",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    altText: varchar("alt_text", { length: 200 }),
    position: integer("position").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productIdx: index("product_images_product_idx").on(table.productId),
  })
);

// Toda variante representa una combinación vendible (color/talla). Un
// producto sin variantes visibles igual recibe UNA variante "default" al
// crearse (ver product.service en Fase 7), para que el descuento de stock
// siempre pase por el mismo camino de código.
export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 80 }).notNull(),
    color: varchar("color", { length: 60 }),
    size: varchar("size", { length: 30 }),
    isDefault: boolean("is_default").notNull().default(false),
    priceOverride: numeric("price_override", { precision: 12, scale: 2 }),
    imageUrl: text("image_url"),
    ...timestamps,
  },
  (table) => ({
    skuIdx: uniqueIndex("product_variants_sku_idx").on(table.sku),
    productIdx: index("product_variants_product_idx").on(table.productId),
  })
);

// ---------------------------------------------------------------------------
// INVENTARIO
// ---------------------------------------------------------------------------

export const inventory = pgTable(
  "inventory",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    stock: integer("stock").notNull().default(0),
    minStock: integer("min_stock").notNull().default(5),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    variantIdx: uniqueIndex("inventory_variant_idx").on(table.variantId),
    stockIdx: index("inventory_stock_idx").on(table.stock),
  })
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: id(),
    inventoryId: uuid("inventory_id")
      .notNull()
      .references(() => inventory.id, { onDelete: "cascade" }),
    type: inventoryMovementTypeEnum("type").notNull(),
    quantity: integer("quantity").notNull(),
    reason: text("reason"),
    orderId: uuid("order_id").references((): any => orders.id),
    createdById: uuid("created_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    inventoryIdx: index("inventory_movements_inventory_idx").on(table.inventoryId),
  })
);

// ---------------------------------------------------------------------------
// CARRITO
// ---------------------------------------------------------------------------

export const carts = pgTable(
  "carts",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestToken: varchar("guest_token", { length: 100 }),
    couponId: uuid("coupon_id").references((): any => coupons.id),
    ...timestamps,
  },
  (table) => ({
    userIdx: uniqueIndex("carts_user_idx").on(table.userId),
    guestTokenIdx: uniqueIndex("carts_guest_token_idx").on(table.guestToken),
  })
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: id(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    quantity: integer("quantity").notNull(),
    ...timestamps,
  },
  (table) => ({
    uniqueItemIdx: uniqueIndex("cart_items_unique_idx").on(table.cartId, table.productId, table.variantId),
  })
);

// ---------------------------------------------------------------------------
// PEDIDOS
// ---------------------------------------------------------------------------

export const orders = pgTable(
  "orders",
  {
    id: id(),
    orderNumber: varchar("order_number", { length: 40 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: orderStatusEnum("status").notNull().default("PENDING"),

    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).notNull().default("0"),
    shippingTotal: numeric("shipping_total", { precision: 12, scale: 2 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("COP"),

    couponId: uuid("coupon_id").references((): any => coupons.id),
    shippingMethod: shippingMethodEnum("shipping_method").notNull().default("STANDARD"),

    customerFirstName: varchar("customer_first_name", { length: 120 }).notNull(),
    customerLastName: varchar("customer_last_name", { length: 120 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 30 }).notNull(),
    shippingAddressId: uuid("shipping_address_id").references(() => addresses.id),
    addressSnapshot: jsonb("address_snapshot").notNull(),

    paymentStatus: paymentStatusEnum("payment_status").notNull().default("PENDING"),
    paidPaymentId: uuid("paid_payment_id"),

    ...timestamps,
  },
  (table) => ({
    orderNumberIdx: uniqueIndex("orders_order_number_idx").on(table.orderNumber),
    userCreatedIdx: index("orders_user_created_idx").on(table.userId, table.createdAt),
    statusIdx: index("orders_status_idx").on(table.status),
  })
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    productNameSnapshot: varchar("product_name_snapshot", { length: 200 }).notNull(),
    skuSnapshot: varchar("sku_snapshot", { length: 80 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderIdx: index("order_items_order_idx").on(table.orderId),
  })
);

// ---------------------------------------------------------------------------
// PAGOS
// ---------------------------------------------------------------------------

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: paymentProviderEnum("provider").notNull(),
    // Referencia ÚNICA que NOSOTROS generamos y le entregamos a Wompi al
    // abrir el widget (antes de que exista ningún ID de transacción de
    // Wompi) — es lo único que tenemos para encontrar este pago cuando
    // llega el webhook, que reporta la transacción por su `reference`.
    reference: varchar("reference", { length: 160 }).notNull(),
    providerTransactionId: varchar("provider_transaction_id", { length: 120 }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("COP"),
    status: paymentStatusEnum("status").notNull().default("PENDING"),
    rawResponse: jsonb("raw_response"),
    ...timestamps,
  },
  (table) => ({
    orderIdx: index("payments_order_idx").on(table.orderId),
    providerTxIdx: index("payments_provider_tx_idx").on(table.provider, table.providerTransactionId),
    referenceIdx: uniqueIndex("payments_provider_reference_idx").on(table.provider, table.reference),
  })
);

// Un evento de webhook se procesa UNA sola vez: (provider, event_id) es único.
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: paymentProviderEnum("provider").notNull(),
    eventId: varchar("event_id", { length: 160 }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerEventIdx: uniqueIndex("webhook_events_provider_event_idx").on(table.provider, table.eventId),
  })
);

// ---------------------------------------------------------------------------
// CUPONES
// ---------------------------------------------------------------------------

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    code: varchar("code", { length: 60 }).notNull(),
    discountType: discountTypeEnum("discount_type").notNull(),
    percentage: numeric("percentage", { precision: 5, scale: 2 }),
    fixedAmount: numeric("fixed_amount", { precision: 12, scale: 2 }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    maxUses: integer("max_uses"),
    maxUsesPerUser: integer("max_uses_per_user").notNull().default(1),
    minPurchase: numeric("min_purchase", { precision: 12, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    codeIdx: uniqueIndex("coupons_code_idx").on(table.code),
  })
);

export const couponUsages = pgTable(
  "coupon_usages",
  {
    id: id(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderIdx: uniqueIndex("coupon_usages_order_idx").on(table.orderId),
    couponUserIdx: index("coupon_usages_coupon_user_idx").on(table.couponId, table.userId),
  })
);

// ---------------------------------------------------------------------------
// RESEÑAS
// ---------------------------------------------------------------------------

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    orderId: uuid("order_id").references(() => orders.id),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    isApproved: boolean("is_approved").notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    productUserIdx: uniqueIndex("reviews_product_user_idx").on(table.productId, table.userId),
    productApprovedIdx: index("reviews_product_approved_idx").on(table.productId, table.isApproved),
  })
);

// ---------------------------------------------------------------------------
// ENVÍOS
// ---------------------------------------------------------------------------

export const shipments = pgTable(
  "shipments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    carrier: varchar("carrier", { length: 100 }),
    trackingNumber: varchar("tracking_number", { length: 120 }),
    status: shipmentStatusEnum("status").notNull().default("PENDING"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    estimatedDeliveryAt: timestamp("estimated_delivery_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    orderIdx: index("shipments_order_idx").on(table.orderId),
  })
);

// ---------------------------------------------------------------------------
// CONFIGURACIÓN DE LA TIENDA (fila única, id fijo = 1)
// ---------------------------------------------------------------------------

export const storeSettings = pgTable("store_settings", {
  id: integer("id").primaryKey().default(1),
  storeName: varchar("store_name", { length: 160 }).notNull().default("Velvet Noise"),
  logoUrl: text("logo_url"),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 30 }),
  address: text("address"),
  socialLinks: jsonb("social_links"),
  currency: varchar("currency", { length: 3 }).notNull().default("COP"),
  taxPercentage: numeric("tax_percentage", { precision: 5, scale: 2 }).notNull().default("19"),
  shippingMethods: jsonb("shipping_methods"),
  paymentMethods: jsonb("payment_methods"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// AUDITORÍA
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id),
    action: varchar("action", { length: 120 }).notNull(),
    resource: varchar("resource", { length: 80 }).notNull(),
    resourceId: varchar("resource_id", { length: 120 }),
    metadata: jsonb("metadata"),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("audit_logs_user_idx").on(table.userId),
    resourceIdx: index("audit_logs_resource_idx").on(table.resource, table.resourceId),
  })
);

// ---------------------------------------------------------------------------
// RELACIONES (Drizzle query API — usadas por db.query.* con `with`)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many, one }) => ({
  addresses: many(addresses),
  orders: many(orders),
  cart: one(carts, { fields: [users.id], references: [carts.userId] }),
  reviews: many(reviews),
  refreshTokens: many(refreshTokens),
}));

export const productsRelations = relations(products, ({ many, one }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  images: many(productImages),
  variants: many(productVariants),
  inventory: one(inventory, { fields: [products.id], references: [inventory.productId] }),
  reviews: many(reviews),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  inventory: one(inventory, { fields: [productVariants.id], references: [inventory.variantId] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const cartsRelations = relations(carts, ({ many, one }) => ({
  items: many(cartItems),
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  coupon: one(coupons, { fields: [carts.couponId], references: [coupons.id] }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [cartItems.variantId], references: [productVariants.id] }),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  payments: many(payments),
  shipments: many(shipments),
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const couponsRelations = relations(coupons, ({ many }) => ({
  usages: many(couponUsages),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
}));

export const inventoryRelations = relations(inventory, ({ one, many }) => ({
  product: one(products, { fields: [inventory.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [inventory.variantId], references: [productVariants.id] }),
  movements: many(inventoryMovements),
}));

// Drizzle necesita ambos lados de la relación declarados para poder inferir
// las columnas de join al usar `with: { shipments: true }` desde `orders`
// (Fase 12) — sin este lado inverso, la relación `ordersRelations.shipments`
// de más arriba falla en tiempo de ejecución con "not enough information".
export const shipmentsRelations = relations(shipments, ({ one }) => ({
  order: one(orders, { fields: [shipments.orderId], references: [orders.id] }),
}));
