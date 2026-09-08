import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchProductByIdOrSlug } from "../services/product.service";
import { fetchProductReviews, createReview } from "../services/review.service";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../services/api";
import type { Product, ProductVariant, Review } from "../types/api";
import { calculateDiscountPercent, formatCurrency, formatDate } from "../utils/format";
import { useAddToCart } from "../hooks/useAddToCart";
import { useSEO } from "../hooks/useSEO";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { ProductCard } from "../components/product/ProductCard";
import { EmptyState } from "../components/ui/EmptyState";

type ProductWithRelated = Product & { relatedProducts: Product[] };

// Los nombres de color de las variantes son, a propósito, los mismos tonos
// del sistema de marca (ver frontend/src/styles/brand.md) — así que el
// swatch de color puede pintarse con el HEX real de la marca en vez de un
// gris genérico o un cuadrito sin relación con el nombre.
const COLOR_SWATCH: Record<string, string> = {
  Negro: "#111111",
  "Blanco Seda": "#EDEAE4",
  Vino: "#431424",
  "Azul Medianoche": "#131C33",
  "Índigo Humo": "#26355C",
};

function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-velvet-black/10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-4 text-left text-sm font-semibold uppercase tracking-label text-velvet-black"
        aria-expanded={open}
      >
        {title}
        <span className="text-lg font-normal leading-none">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="pb-5 text-sm leading-relaxed text-velvet-ash">{children}</div>}
    </div>
  );
}

export default function ProductDetail() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const navigate = useNavigate();
  const addToCart = useAddToCart();

  const [product, setProduct] = useState<ProductWithRelated | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addedMessage, setAddedMessage] = useState(false);

  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  useEffect(() => {
    if (!idOrSlug) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    fetchProductByIdOrSlug(idOrSlug)
      .then((data) => {
        if (!active) return;
        setProduct(data);
        const defaultVariant = data.variants.find((v) => v.isDefault) ?? data.variants[0];
        setSelectedColor(defaultVariant?.color ?? null);
        setSelectedSize(defaultVariant?.size ?? null);
        fetchProductReviews(data.id)
          .then((r) => active && setReviews(r))
          .catch(() => active && setReviews([]));
      })
      .catch((err) => active && setError(err?.response?.data?.error?.message ?? "Producto no encontrado."))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [idOrSlug]);

  async function handleSubmitReview(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    setReviewError(null);
    setReviewSuccess(null);
    setReviewSaving(true);
    try {
      await createReview({ productId: product.id, rating: reviewRating, comment: reviewComment });
      setReviewComment("");
      setReviewRating(5);
      setReviewSuccess("¡Gracias por tu reseña! Se publicará en cuanto un administrador la revise.");
    } catch (err) {
      setReviewError(getApiErrorMessage(err));
    } finally {
      setReviewSaving(false);
    }
  }

  const colors = useMemo(
    () => [...new Set(product?.variants.map((v) => v.color).filter(Boolean) as string[])],
    [product]
  );
  const sizes = useMemo(
    () => [...new Set(product?.variants.map((v) => v.size).filter(Boolean) as string[])],
    [product]
  );

  const selectedVariant: ProductVariant | undefined = useMemo(() => {
    if (!product) return undefined;
    if (product.variants.length === 1) return product.variants[0];
    return product.variants.find((v) => (v.color ?? null) === selectedColor && (v.size ?? null) === selectedSize);
  }, [product, selectedColor, selectedSize]);

  const primaryImageUrl = product?.images.find((i) => i.isPrimary)?.url ?? product?.images[0]?.url;
  useSEO({
    title: product?.name,
    description: product?.description?.slice(0, 160),
    image: primaryImageUrl,
    type: "product",
    structuredData: product
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description,
          image: primaryImageUrl ? [primaryImageUrl] : undefined,
          sku: product.sku,
          ...(product.ratingCount > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: product.ratingAverage,
                  reviewCount: product.ratingCount,
                },
              }
            : {}),
          offers: {
            "@type": "Offer",
            priceCurrency: "COP",
            price: product.price,
            availability:
              product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: window.location.href,
          },
        }
      : undefined,
  });

  if (isLoading) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-velvet-ash">Cargando producto…</div>;
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Alert variant="error">{error ?? "Producto no encontrado."}</Alert>
      </div>
    );
  }

  const price = selectedVariant?.priceOverride ?? product.price;
  const discount = calculateDiscountPercent(price, product.compareAtPrice);
  const stock = selectedVariant?.stock ?? product.stock;
  const canAdd = !!selectedVariant && stock > 0;
  const images = product.images.length > 0 ? product.images : [];

  async function handleAddToCart() {
    if (!product || !canAdd) return;
    const result = await addToCart(product, selectedVariant, quantity);
    if (result.ok) {
      setAddedMessage(true);
      setTimeout(() => setAddedMessage(false), 2500);
    } else {
      setError(result.message);
    }
  }

  async function handleBuyNow() {
    if (!product || !canAdd) return;
    const result = await addToCart(product, selectedVariant, quantity);
    if (result.ok) navigate("/checkout");
    else setError(result.message);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.3fr_1fr]">
        {/* GALERÍA — grid de imágenes reales del producto (no se simulan
            ángulos que no existen: si solo hay una imagen, ocupa todo el
            ancho; con varias, se acomodan en grid de 2 columnas). */}
        <div className={images.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
          {images.length > 0 ? (
            images.map((img) => (
              <div key={img.id} className="aspect-[4/5] overflow-hidden bg-velvet-silk">
                <img src={img.url} alt={img.altText ?? product.name} className="h-full w-full object-cover" />
              </div>
            ))
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center bg-velvet-silk text-velvet-ash">Sin imagen</div>
          )}
        </div>

        {/* INFO — panel fijo tipo ficha de producto de un retailer deportivo. */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          {product.category && (
            <p className="text-xs font-semibold uppercase tracking-label text-velvet-ash">{product.category.name}</p>
          )}
          <h1 className="mt-1 font-display text-3xl text-velvet-black">{product.name}</h1>

          {product.ratingCount > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-velvet-burgundy">
              {"★".repeat(Math.round(Number(product.ratingAverage)))}
              {"☆".repeat(5 - Math.round(Number(product.ratingAverage)))}
              <span className="text-velvet-ash">({product.ratingCount})</span>
            </div>
          )}

          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-velvet-black">{formatCurrency(price)}</span>
            {product.compareAtPrice && (
              <span className="text-base text-velvet-ash line-through">{formatCurrency(product.compareAtPrice)}</span>
            )}
            {discount && (
              <span className="bg-velvet-burgundy px-2 py-0.5 text-[11px] font-semibold uppercase tracking-label text-white">
                -{discount}%
              </span>
            )}
          </div>

          {colors.length > 0 && (
            <div className="mt-6">
              <span className="text-xs font-semibold uppercase tracking-label text-velvet-ash">
                Color{selectedColor ? ` — ${selectedColor}` : ""}
              </span>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    aria-label={color}
                    aria-pressed={selectedColor === color}
                    title={color}
                    className={`h-9 w-9 border transition ${
                      selectedColor === color ? "border-velvet-black ring-1 ring-velvet-black ring-offset-2" : "border-velvet-black/15"
                    }`}
                    style={{ backgroundColor: COLOR_SWATCH[color] ?? "#B9B4AE" }}
                  />
                ))}
              </div>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="mt-5">
              <span className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Talla</span>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    aria-pressed={selectedSize === size}
                    className={`border py-2.5 text-sm transition ${
                      selectedSize === size
                        ? "border-velvet-black bg-velvet-black text-white"
                        : "border-velvet-black/25 text-velvet-black hover:border-velvet-black"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Cantidad</span>
            <div className="flex items-center border border-velvet-black/25">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-1.5 text-velvet-black/70 transition hover:text-velvet-black"
                aria-label="Disminuir cantidad"
              >
                −
              </button>
              <span className="w-8 text-center text-sm text-velvet-black">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(stock || 1, q + 1))}
                className="px-3 py-1.5 text-velvet-black/70 transition hover:text-velvet-black"
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>
            <span className="text-xs text-velvet-ash">
              {stock > 0 ? `${stock} unidades disponibles` : "Agotado"}
            </span>
          </div>

          {addedMessage && (
            <div className="mt-4">
              <Alert variant="success">Producto agregado al carrito.</Alert>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button onClick={handleAddToCart} disabled={!canAdd} variant="secondary" className="flex-1">
              Agregar al carrito
            </Button>
            <Button onClick={handleBuyNow} disabled={!canAdd} className="flex-1">
              Comprar ahora
            </Button>
          </div>

          <div className="mt-6 space-y-1.5 border border-velvet-black/10 bg-velvet-silk/40 p-4 text-xs text-velvet-ash">
            <p>Envío estándar o express disponible al finalizar la compra.</p>
            <p>Garantía directa del fabricante.</p>
          </div>

          {/* Descripción / Detalles / Cuidados — igual patrón de acordeón que
              una ficha de producto de retail deportivo. */}
          <div className="mt-8">
            <AccordionSection title="Descripción" defaultOpen>
              <p>{product.description}</p>
            </AccordionSection>
            <AccordionSection title="Detalles">
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-label text-velvet-ash">SKU</dt>
                  <dd className="mt-0.5 text-velvet-black/80">{selectedVariant?.sku ?? product.sku}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-label text-velvet-ash">Categoría</dt>
                  <dd className="mt-0.5 text-velvet-black/80">{product.category?.name ?? "—"}</dd>
                </div>
              </dl>
            </AccordionSection>
            <AccordionSection title="Cuidados">
              <p>Lavado a máquina en frío, del revés. No usar blanqueador. Secado a la sombra.</p>
            </AccordionSection>
          </div>
        </div>
      </div>

      {/* RESEÑAS */}
      <section className="mt-16 border-t border-velvet-black/10 pt-8">
        <h2 className="font-display text-2xl text-velvet-black">
          Reseñas{" "}
          {product.ratingCount > 0 && (
            <span className="text-base font-normal text-velvet-ash">
              ({Number(product.ratingAverage).toFixed(1)} · {product.ratingCount})
            </span>
          )}
        </h2>

        {reviews === null ? (
          <p className="mt-4 text-sm text-velvet-ash">Cargando reseñas…</p>
        ) : reviews.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Aún no hay reseñas" description="Sé la primera persona en compartir tu opinión sobre este producto." />
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="border border-velvet-black/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-velvet-black">{r.authorName}</span>
                  <span className="text-xs text-velvet-ash">{formatDate(r.createdAt)}</span>
                </div>
                <p className="mt-1 text-velvet-burgundy" aria-label={`${r.rating} de 5 estrellas`}>
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </p>
                <p className="mt-2 text-sm text-velvet-black/70">{r.comment}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 border border-velvet-black/10 bg-velvet-silk/40 p-6">
          {!user ? (
            <p className="text-sm text-velvet-black/70">
              <button onClick={() => navigate("/login")} className="text-velvet-black underline transition hover:text-velvet-black/70">
                Inicia sesión
              </button>{" "}
              para dejar tu reseña de este producto.
            </p>
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Escribe una reseña</h3>
              {reviewError && <Alert variant="error">{reviewError}</Alert>}
              {reviewSuccess && <Alert variant="success">{reviewSuccess}</Alert>}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Calificación</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewRating(n)}
                      className={`text-xl transition ${n <= reviewRating ? "text-velvet-burgundy" : "text-velvet-black/15"}`}
                      aria-label={`${n} estrellas`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="w-full border border-velvet-black/25 bg-transparent px-3.5 py-2.5 text-sm text-velvet-black outline-none transition placeholder:text-velvet-ash focus:border-velvet-black focus:ring-1 focus:ring-velvet-black/20"
                rows={3}
                placeholder="Cuéntanos qué te pareció este producto…"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                required
                minLength={5}
              />
              <Button type="submit" isLoading={reviewSaving}>
                Enviar reseña
              </Button>
            </form>
          )}
        </div>
      </section>

      {/* RELACIONADOS */}
      {product.relatedProducts.length > 0 && (
        <section className="mt-12 border-t border-velvet-black/10 pt-8">
          <h2 className="font-display text-2xl text-velvet-black">Productos relacionados</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {product.relatedProducts.map((related) => (
              <ProductCard key={related.id} product={related} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
