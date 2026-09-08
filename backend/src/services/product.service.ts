import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { products, productImages, productVariants, inventory, categories } from "../db/schema";
import { slugify } from "../utils/slugify";
import { AppError } from "../utils/AppError";
import type { CreateProductInput, UpdateProductInput, ListProductsQuery } from "../validators/product.validators";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function money(n: number): string {
  return n.toFixed(2);
}

async function uniqueSlug(name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name) || "producto";
  let slug = base;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition -- bucle acotado por el `return` interno
  while (true) {
    const existing = await db.query.products.findFirst({ where: eq(products.slug, slug) });
    if (!existing || existing.id === ignoreId) return slug;
    slug = `${base}-${suffix++}`;
  }
}

async function uniqueSku(base: string): Promise<string> {
  let sku = base;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition -- bucle acotado por el `return` interno
  while (true) {
    const existing = await db.query.products.findFirst({ where: eq(products.sku, sku) });
    if (!existing) return sku;
    sku = `${base}-${suffix++}`;
  }
}

async function uniqueVariantSku(base: string): Promise<string> {
  let sku = base;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition -- bucle acotado por el `return` interno
  while (true) {
    const existing = await db.query.productVariants.findFirst({ where: eq(productVariants.sku, sku) });
    if (!existing) return sku;
    sku = `${base}-${suffix++}`;
  }
}

/** Adjunta imágenes, variantes (con su stock) y categoría a una lista de productos, evitando N+1. */
async function attachRelations(productRows: (typeof products.$inferSelect)[]) {
  if (productRows.length === 0) return [];
  const ids = productRows.map((p) => p.id);
  const categoryIds = [...new Set(productRows.map((p) => p.categoryId))];

  const [images, variants, inventoryRows, categoryRows] = await Promise.all([
    db.select().from(productImages).where(inArray(productImages.productId, ids)),
    db.select().from(productVariants).where(inArray(productVariants.productId, ids)),
    db.select().from(inventory).where(inArray(inventory.productId, ids)),
    db.select().from(categories).where(inArray(categories.id, categoryIds)),
  ]);

  const stockByVariant = new Map(inventoryRows.map((i) => [i.variantId, i.stock]));
  const categoryById = new Map(categoryRows.map((c) => [c.id, c]));

  return productRows.map((p) => {
    const productVariantsList = variants
      .filter((v) => v.productId === p.id)
      .map((v) => ({ ...v, stock: stockByVariant.get(v.id) ?? 0 }));
    const totalStock = productVariantsList.reduce((sum, v) => sum + v.stock, 0);
    return {
      ...p,
      category: categoryById.get(p.categoryId),
      images: images.filter((i) => i.productId === p.id).sort((a, b) => a.position - b.position),
      variants: productVariantsList,
      stock: totalStock,
    };
  });
}

export async function listProducts(query: ListProductsQuery, options: { includeInactive?: boolean } = {}) {
  const conditions = [];
  if (!options.includeInactive) conditions.push(eq(products.isActive, true));

  if (query.category) {
    const category = await db.query.categories.findFirst({ where: eq(categories.slug, query.category) });
    if (!category) return { data: [], pagination: { page: query.page, pageSize: query.pageSize, total: 0 } };
    conditions.push(eq(products.categoryId, category.id));
  }

  if (query.search) {
    // Búsqueda insensible a tildes y mayúsculas: "audifonos" debe encontrar
    // "Audífonos" (requiere la extensión `unaccent`, habilitada en
    // src/db/migrate.ts). `%` se escapa para no romper el patrón LIKE si el
    // usuario busca literalmente un signo de porcentaje.
    const term = `%${query.search.replace(/[%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(
      sql`(unaccent(${products.name}) ILIKE unaccent(${term}) OR unaccent(${products.description}) ILIKE unaccent(${term}))`
    );
  }
  if (query.minPrice != null) conditions.push(gte(products.price, money(query.minPrice)));
  if (query.maxPrice != null) conditions.push(lte(products.price, money(query.maxPrice)));
  if (query.featured) conditions.push(eq(products.isFeatured, true));

  const orderBy =
    query.sort === "price_asc"
      ? [asc(products.price)]
      : query.sort === "price_desc"
        ? [desc(products.price)]
        : query.sort === "popularity"
          ? [desc(products.ratingCount), desc(products.ratingAverage)]
          : [desc(products.createdAt)];

  // Se trae un conjunto acotado (hasta 500) con los filtros de SQL aplicados;
  // `inStock`/`onSale` dependen del stock agregado por variante y se
  // resuelven en memoria tras adjuntar relaciones — razonable para el
  // tamaño de catálogo de este proyecto (ver docs/07-catalogo.md). Si el
  // catálogo crece mucho, esto se mueve a una agregación SQL (Fase 24).
  const rows = await db
    .select()
    .from(products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(...orderBy)
    .limit(500);

  let withRelations = await attachRelations(rows);

  if (query.inStock) withRelations = withRelations.filter((p) => p.stock > 0);
  if (query.onSale) {
    withRelations = withRelations.filter((p) => p.compareAtPrice && Number(p.compareAtPrice) > Number(p.price));
  }

  const total = withRelations.length;
  const start = (query.page - 1) * query.pageSize;
  const data = withRelations.slice(start, start + query.pageSize);

  return { data, pagination: { page: query.page, pageSize: query.pageSize, total } };
}

export async function getProductByIdOrSlug(idOrSlug: string, options: { includeInactive?: boolean } = {}) {
  const whereClause = UUID_RE.test(idOrSlug) ? eq(products.id, idOrSlug) : eq(products.slug, idOrSlug);
  const product = await db.query.products.findFirst({ where: whereClause });

  if (!product || (!product.isActive && !options.includeInactive)) {
    throw AppError.notFound("Producto no encontrado.");
  }

  const [withRelations] = await attachRelations([product]);
  return withRelations;
}

export async function getRelatedProducts(product: { id: string; categoryId: string }, limit = 4) {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.categoryId, product.categoryId), eq(products.isActive, true)))
    .limit(limit + 1);
  return attachRelations(rows.filter((p) => p.id !== product.id).slice(0, limit));
}

export async function createProduct(input: CreateProductInput) {
  const category = await db.query.categories.findFirst({ where: eq(categories.id, input.categoryId) });
  if (!category) throw AppError.badRequest("La categoría seleccionada no existe.");

  const slug = await uniqueSlug(input.name);
  const sku = input.sku ? await uniqueSku(input.sku) : await uniqueSku(slug.toUpperCase().slice(0, 40));

  const productId = await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        name: input.name,
        slug,
        description: input.description,
        price: money(input.price),
        compareAtPrice: input.compareAtPrice != null ? money(input.compareAtPrice) : null,
        sku,
        categoryId: input.categoryId,
        isActive: input.isActive,
        isFeatured: input.isFeatured,
        weightKg: input.weightKg != null ? input.weightKg.toFixed(3) : null,
        lengthCm: input.lengthCm != null ? input.lengthCm.toFixed(2) : null,
        widthCm: input.widthCm != null ? input.widthCm.toFixed(2) : null,
        heightCm: input.heightCm != null ? input.heightCm.toFixed(2) : null,
      })
      .returning();

    if (input.images.length > 0) {
      await tx.insert(productImages).values(
        input.images.map((img, index) => ({
          productId: product.id,
          url: img.url,
          altText: img.altText,
          position: index,
          isPrimary: img.isPrimary ?? index === 0,
        }))
      );
    }

    if (input.variants.length > 0) {
      for (const [index, variant] of input.variants.entries()) {
        const variantSku = variant.sku
          ? await uniqueVariantSku(variant.sku)
          : await uniqueVariantSku(`${sku}-V${index + 1}`);
        const [insertedVariant] = await tx
          .insert(productVariants)
          .values({
            productId: product.id,
            sku: variantSku,
            color: variant.color,
            size: variant.size,
            isDefault: input.variants.length === 1,
            priceOverride: variant.priceOverride != null ? money(variant.priceOverride) : null,
            imageUrl: variant.imageUrl,
          })
          .returning();
        await tx.insert(inventory).values({
          productId: product.id,
          variantId: insertedVariant.id,
          stock: variant.stock,
          minStock: input.minStock,
        });
      }
    } else {
      const [defaultVariant] = await tx
        .insert(productVariants)
        .values({ productId: product.id, sku: await uniqueVariantSku(`${sku}-DEFAULT`), isDefault: true })
        .returning();
      await tx.insert(inventory).values({
        productId: product.id,
        variantId: defaultVariant.id,
        stock: input.stock ?? 0,
        minStock: input.minStock,
      });
    }

    return product.id;
  });

  return getProductByIdOrSlug(productId, { includeInactive: true });
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const existing = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!existing) throw AppError.notFound("Producto no encontrado.");

  if (input.categoryId) {
    const category = await db.query.categories.findFirst({ where: eq(categories.id, input.categoryId) });
    if (!category) throw AppError.badRequest("La categoría seleccionada no existe.");
  }

  const slug = input.name && input.name !== existing.name ? await uniqueSlug(input.name, id) : undefined;

  await db
    .update(products)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(slug ? { slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.price !== undefined ? { price: money(input.price) } : {}),
      ...(input.compareAtPrice !== undefined ? { compareAtPrice: input.compareAtPrice != null ? money(input.compareAtPrice) : null } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
      ...(input.weightKg !== undefined ? { weightKg: input.weightKg?.toFixed(3) ?? null } : {}),
      ...(input.lengthCm !== undefined ? { lengthCm: input.lengthCm?.toFixed(2) ?? null } : {}),
      ...(input.widthCm !== undefined ? { widthCm: input.widthCm?.toFixed(2) ?? null } : {}),
      ...(input.heightCm !== undefined ? { heightCm: input.heightCm?.toFixed(2) ?? null } : {}),
    })
    .where(eq(products.id, id));

  return getProductByIdOrSlug(id, { includeInactive: true });
}

export async function setProductStatus(id: string, isActive: boolean) {
  const [updated] = await db.update(products).set({ isActive }).where(eq(products.id, id)).returning();
  if (!updated) throw AppError.notFound("Producto no encontrado.");
  return updated;
}

export async function deleteProduct(id: string): Promise<void> {
  const existing = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!existing) throw AppError.notFound("Producto no encontrado.");

  try {
    await db.delete(products).where(eq(products.id, id));
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23503") {
      throw AppError.conflict(
        "No se puede eliminar este producto porque tiene pedidos asociados. Desactívalo en su lugar.",
        "PRODUCT_HAS_ORDERS"
      );
    }
    throw error;
  }
}

