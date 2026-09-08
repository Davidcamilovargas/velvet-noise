import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { categories } from "../db/schema";
import { slugify } from "../utils/slugify";
import { AppError } from "../utils/AppError";
import type { CreateCategoryInput, UpdateCategoryInput } from "../validators/category.validators";

async function uniqueSlug(name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;
  // Con pocas categorías esta comprobación secuencial es suficiente y simple.
  // eslint-disable-next-line no-constant-condition -- bucle acotado por el `return` interno
  while (true) {
    const existing = await db.query.categories.findFirst({ where: eq(categories.slug, slug) });
    if (!existing || existing.id === ignoreId) return slug;
    slug = `${base}-${suffix++}`;
  }
}

export async function listCategories(includeInactive = false) {
  const all = await db.query.categories.findMany({ orderBy: (c, { asc }) => asc(c.name) });
  return includeInactive ? all : all.filter((c) => c.isActive);
}

export async function getCategoryById(id: string) {
  return db.query.categories.findFirst({ where: eq(categories.id, id) });
}

export async function createCategory(input: CreateCategoryInput) {
  const slug = await uniqueSlug(input.name);
  const [category] = await db.insert(categories).values({ ...input, slug }).returning();
  return category;
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const existing = await getCategoryById(id);
  if (!existing) throw AppError.notFound("Categoría no encontrada.");

  const slug = input.name && input.name !== existing.name ? await uniqueSlug(input.name, id) : undefined;

  const [updated] = await db
    .update(categories)
    .set({ ...input, ...(slug ? { slug } : {}) })
    .where(eq(categories.id, id))
    .returning();
  return updated;
}

export async function deleteCategory(id: string): Promise<void> {
  const existing = await getCategoryById(id);
  if (!existing) throw AppError.notFound("Categoría no encontrada.");

  try {
    await db.delete(categories).where(eq(categories.id, id));
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23503") {
      throw AppError.conflict(
        "No se puede eliminar esta categoría porque tiene productos asociados. Desactívala en su lugar.",
        "CATEGORY_HAS_PRODUCTS"
      );
    }
    throw error;
  }
}
