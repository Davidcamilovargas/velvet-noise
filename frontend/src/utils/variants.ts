import type { Product, ProductVariant } from "../types/api";

export const COLOR_SWATCH: Record<string, string> = {
  Negro: "#111111",
  "Blanco Seda": "#EDEAE4",
  Vino: "#431424",
  "Azul Medianoche": "#131C33",
  "Índigo Humo": "#26355C",
};

export function primaryImage(p: Product): string | undefined {
  const stills = p.images.filter((i) => i.mediaType !== "VIDEO");
  return (stills.find((i) => i.isPrimary) ?? stills[0])?.url;
}

export function secondImage(p: Product): string | undefined {
  const first = primaryImage(p);
  return p.images.find((i) => i.mediaType !== "VIDEO" && i.url !== first)?.url;
}

export function colorsOf(p: Product): string[] {
  return [...new Set(p.variants.map((v) => v.color).filter(Boolean) as string[])];
}

/** Tallas en el orden en que vienen, para el color elegido (o todas si no hay color). */
export function sizesOf(p: Product, color: string | null): { size: string; inStock: boolean }[] {
  const out = new Map<string, boolean>();
  for (const v of p.variants) {
    if (!v.size) continue;
    if (color && v.color !== color) continue;
    out.set(v.size, (out.get(v.size) ?? false) || v.stock > 0);
  }
  return [...out].map(([size, inStock]) => ({ size, inStock }));
}

/** Tallas con stock en cualquier color, para mostrarlas en la tarjeta. */
export function sizesInStock(p: Product): string[] {
  return sizesOf(p, null).filter((s) => s.inStock).map((s) => s.size);
}

export function findVariant(p: Product, color: string | null, size: string | null): ProductVariant | undefined {
  if (p.variants.length === 1) return p.variants[0];
  return p.variants.find((v) => (v.color ?? null) === (color ?? v.color ?? null) && (v.size ?? null) === size);
}

/** Primera frase de la descripción: el dato concreto (material, gramaje, corte). */
export function firstSentence(p: Product): string {
  return p.description.split(". ")[0].replace(/\.$/, "");
}
