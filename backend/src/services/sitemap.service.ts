import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { products, categories } from "../db/schema";
import { env } from "../config/env";

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: number;
}

/**
 * El catálogo vive en Postgres y cambia todo el tiempo (productos nuevos,
 * precios, altas/bajas) — un sitemap.xml estático quedaría desactualizado
 * de inmediato, así que se genera en cada solicitud a partir de los datos
 * reales (productos y categorías ACTIVOS únicamente, igual que la tienda
 * pública nunca muestra los inactivos).
 */
export async function buildSitemapUrls(): Promise<SitemapUrl[]> {
  const base = env.FRONTEND_URL.replace(/\/$/, "");

  const [activeProducts, activeCategories] = await Promise.all([
    db.query.products.findMany({
      where: eq(products.isActive, true),
      columns: { slug: true, updatedAt: true },
    }),
    db.query.categories.findMany({
      where: eq(categories.isActive, true),
      columns: { slug: true, updatedAt: true },
    }),
  ]);

  const urls: SitemapUrl[] = [
    { loc: `${base}/`, changefreq: "daily", priority: 1.0 },
    { loc: `${base}/shop`, changefreq: "daily", priority: 0.9 },
    { loc: `${base}/contacto`, changefreq: "monthly", priority: 0.3 },
  ];

  for (const category of activeCategories) {
    urls.push({
      loc: `${base}/shop?category=${encodeURIComponent(category.slug)}`,
      lastmod: category.updatedAt.toISOString(),
      changefreq: "weekly",
      priority: 0.7,
    });
  }

  for (const product of activeProducts) {
    urls.push({
      loc: `${base}/product/${encodeURIComponent(product.slug)}`,
      lastmod: product.updatedAt.toISOString(),
      changefreq: "weekly",
      priority: 0.8,
    });
  }

  return urls;
}

export function renderSitemapXml(urls: SitemapUrl[]): string {
  const entries = urls
    .map((u) => {
      const parts = [`<loc>${escapeXml(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`<lastmod>${u.lastmod}</lastmod>`);
      if (u.changefreq) parts.push(`<changefreq>${u.changefreq}</changefreq>`);
      if (u.priority !== undefined) parts.push(`<priority>${u.priority.toFixed(1)}</priority>`);
      return `  <url>${parts.map((p) => `\n    ${p}`).join("")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
