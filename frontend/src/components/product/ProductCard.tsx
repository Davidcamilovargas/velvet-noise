import { useState } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../../types/api";
import { calculateDiscountPercent, formatCurrency } from "../../utils/format";
import { useAddToCart } from "../../hooks/useAddToCart";
import { Button } from "../ui/Button";

export function ProductCard({ product }: { product: Product }) {
  const addToCart = useAddToCart();
  const [isAdding, setIsAdding] = useState(false);
  const discount = calculateDiscountPercent(product.price, product.compareAtPrice);
  const primaryImage = product.images.find((i) => i.isPrimary) ?? product.images[0];
  const outOfStock = product.stock <= 0;
  const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  // Solo permite agregar directo desde la tarjeta cuando el producto no
  // requiere elegir color/talla; si tiene variantes reales, el usuario debe
  // entrar al detalle para seleccionar una (evita agregar la variante
  // incorrecta por accidente).
  const needsVariantSelection = product.variants.length > 1;

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock || needsVariantSelection) return;
    setIsAdding(true);
    await addToCart(product, defaultVariant, 1);
    setIsAdding(false);
  }

  return (
    <Link to={`/product/${product.slug}`} className="group flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden bg-velvet-silk">
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={primaryImage.altText ?? product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-velvet-ash">Sin imagen</div>
        )}
        {discount && (
          <span className="absolute left-0 top-3 bg-velvet-burgundy px-2.5 py-1 text-[11px] font-semibold uppercase tracking-label text-white">
            -{discount}%
          </span>
        )}
        {outOfStock && (
          <span className="absolute right-0 top-3 bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-label text-velvet-black">
            Agotado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 pt-3">
        {product.category && (
          <span className="text-[11px] font-semibold uppercase tracking-label text-velvet-ash">{product.category.name}</span>
        )}
        <h3 className="line-clamp-2 text-sm text-velvet-black">{product.name}</h3>

        {product.ratingCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-velvet-burgundy">
            {"★".repeat(Math.round(Number(product.ratingAverage)))}
            {"☆".repeat(5 - Math.round(Number(product.ratingAverage)))}
            <span className="text-velvet-ash">({product.ratingCount})</span>
          </div>
        )}

        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-sm font-semibold text-velvet-black">{formatCurrency(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-xs text-velvet-ash line-through">{formatCurrency(product.compareAtPrice)}</span>
          )}
        </div>

        {needsVariantSelection && !outOfStock ? (
          <span className="mt-3 block text-center text-[11px] uppercase tracking-label text-velvet-ash">
            Elige color/talla en el producto
          </span>
        ) : (
          <Button
            variant={outOfStock ? "secondary" : "primary"}
            disabled={outOfStock}
            isLoading={isAdding}
            onClick={handleAddToCart}
            className="mt-3 w-full"
          >
            {outOfStock ? "Agotado" : "Agregar al carrito"}
          </Button>
        )}
      </div>
    </Link>
  );
}
