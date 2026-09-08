import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { carts, cartItems, products, productVariants, inventory, storeSettings, coupons } from "../db/schema";
import { AppError } from "../utils/AppError";
import { evaluateCoupon } from "./coupon.service";

async function getOrCreateCart(userId: string) {
  const existing = await db.query.carts.findFirst({ where: eq(carts.userId, userId) });
  if (existing) return existing;
  const [created] = await db.insert(carts).values({ userId }).returning();
  return created;
}

async function getTaxPercentage(): Promise<number> {
  const settings = await db.query.storeSettings.findFirst({ where: eq(storeSettings.id, 1) });
  return settings ? Number(settings.taxPercentage) : 19;
}

/** Arma el carrito completo con datos de producto/variante EN VIVO (precio y stock actuales, no congelados). */
export async function getCart(userId: string) {
  const cart = await getOrCreateCart(userId);

  const items = await db
    .select({
      id: cartItems.id,
      quantity: cartItems.quantity,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      productPrice: products.price,
      productSku: products.sku,
      variantId: productVariants.id,
      variantSku: productVariants.sku,
      variantColor: productVariants.color,
      variantSize: productVariants.size,
      variantPriceOverride: productVariants.priceOverride,
      stock: inventory.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .leftJoin(inventory, eq(inventory.variantId, cartItems.variantId))
    .where(eq(cartItems.cartId, cart.id));

  const lines = items.map((item) => {
    const unitPrice = Number(item.variantPriceOverride ?? item.productPrice);
    return {
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productSlug: item.productSlug,
      sku: item.variantSku ?? item.productSku,
      variantId: item.variantId,
      variantLabel: [item.variantColor, item.variantSize].filter(Boolean).join(" / ") || null,
      unitPrice,
      quantity: item.quantity,
      subtotal: unitPrice * item.quantity,
      stock: item.stock ?? 0,
      exceedsStock: item.quantity > (item.stock ?? 0),
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.subtotal, 0);

  let discountTotal = 0;
  let couponCode: string | null = null;
  let couponError: string | null = null;
  if (cart.couponId) {
    const coupon = await db.query.coupons.findFirst({ where: eq(coupons.id, cart.couponId) });
    if (coupon) {
      try {
        const evaluation = await evaluateCoupon(coupon.code, subtotal, userId);
        discountTotal = evaluation.discountAmount;
        couponCode = coupon.code;
      } catch (err) {
        // El cupón dejó de ser válido (ej. expiró) desde que se aplicó: se
        // informa en la respuesta en vez de romper la carga del carrito.
        couponError = err instanceof AppError ? err.message : "El cupón aplicado ya no es válido.";
      }
    }
  }

  const taxPercentage = await getTaxPercentage();
  const taxTotal = Math.round((subtotal - discountTotal) * (taxPercentage / 100) * 100) / 100;
  const total = subtotal - discountTotal + taxTotal;

  return {
    id: cart.id,
    items: lines,
    subtotal,
    discountTotal,
    couponCode,
    couponError,
    taxTotal,
    taxPercentage,
    // El envío se calcula en el checkout (Fase 9), donde se conoce la dirección.
    shippingTotal: 0,
    total,
  };
}

export async function addItemToCart(
  userId: string,
  input: { productId: string; variantId?: string; quantity: number }
) {
  const cart = await getOrCreateCart(userId);

  const product = await db.query.products.findFirst({ where: eq(products.id, input.productId) });
  if (!product || !product.isActive) throw AppError.notFound("Producto no encontrado.");

  const variants = await db.query.productVariants.findMany({ where: eq(productVariants.productId, product.id) });
  let variant = input.variantId ? variants.find((v) => v.id === input.variantId) : undefined;
  if (!variant) {
    if (variants.length === 1) variant = variants[0];
    else throw AppError.badRequest("Debes seleccionar una variante (color/talla) de este producto.");
  }

  const inventoryRow = await db.query.inventory.findFirst({ where: eq(inventory.variantId, variant.id) });
  const availableStock = inventoryRow?.stock ?? 0;

  const existingItem = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, product.id), eq(cartItems.variantId, variant.id)),
  });

  const desiredQuantity = (existingItem?.quantity ?? 0) + input.quantity;
  if (desiredQuantity > availableStock) {
    throw AppError.conflict(
      availableStock === 0
        ? "Este producto no tiene stock disponible."
        : `Solo hay ${availableStock} unidad(es) disponibles de este producto.`,
      "INSUFFICIENT_STOCK"
    );
  }

  if (existingItem) {
    await db.update(cartItems).set({ quantity: desiredQuantity }).where(eq(cartItems.id, existingItem.id));
  } else {
    await db.insert(cartItems).values({
      cartId: cart.id,
      productId: product.id,
      variantId: variant.id,
      quantity: input.quantity,
    });
  }

  return getCart(userId);
}

export async function updateCartItemQuantity(userId: string, itemId: string, quantity: number) {
  const cart = await getOrCreateCart(userId);
  const item = await db.query.cartItems.findFirst({ where: and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)) });
  if (!item) throw AppError.notFound("El producto no está en tu carrito.");

  if (item.variantId) {
    const inventoryRow = await db.query.inventory.findFirst({ where: eq(inventory.variantId, item.variantId) });
    const availableStock = inventoryRow?.stock ?? 0;
    if (quantity > availableStock) {
      throw AppError.conflict(`Solo hay ${availableStock} unidad(es) disponibles de este producto.`, "INSUFFICIENT_STOCK");
    }
  }

  await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, itemId));
  return getCart(userId);
}

export async function removeCartItem(userId: string, itemId: string) {
  const cart = await getOrCreateCart(userId);
  await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
  return getCart(userId);
}

export async function applyCoupon(userId: string, code: string) {
  const cart = await getOrCreateCart(userId);
  const { subtotal } = await getCart(userId);
  const { coupon } = await evaluateCoupon(code, subtotal, userId);
  await db.update(carts).set({ couponId: coupon.id }).where(eq(carts.id, cart.id));
  return getCart(userId);
}

export async function removeCoupon(userId: string) {
  const cart = await getOrCreateCart(userId);
  await db.update(carts).set({ couponId: null }).where(eq(carts.id, cart.id));
  return getCart(userId);
}

/**
 * Sincroniza el carrito de invitado (guardado en el navegador) con el
 * carrito del backend al iniciar sesión — se llama una vez, justo después
 * de login/register. Suma cantidades sin exceder el stock disponible.
 */
export async function mergeGuestCart(
  userId: string,
  guestLines: { productId: string; variantId: string | null; quantity: number }[]
) {
  for (const line of guestLines) {
    try {
      await addItemToCart(userId, {
        productId: line.productId,
        variantId: line.variantId ?? undefined,
        quantity: line.quantity,
      });
    } catch {
      // Si una línea del carrito de invitado ya no es válida (sin stock,
      // producto desactivado), se omite en vez de romper el resto de la
      // sincronización.
    }
  }
  return getCart(userId);
}
