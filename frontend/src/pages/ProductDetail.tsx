import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { Product360Viewer } from "../components/product/Product360Viewer";
import { ZoomableImage } from "../components/product/ZoomableImage";
import { ImageLightbox } from "../components/product/ImageLightbox";
import { EmptyState } from "../components/ui/EmptyState";
import { optimizedImage } from "../utils/image";
import { whatsappLink } from "../config/store";

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
  // AGREGADO: índice de la foto abierta en la pantalla grande con scroll
  // (null = cerrada). Declarado aquí arriba, junto a los demás useState,
  // porque más abajo hay "return" tempranos (cargando / error) — un hook
  // no puede declararse después de un return condicional.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
  // AGREGADO: solo las fotos fijas (no videos) entran a la pantalla grande
  // con scroll — un video ya tiene sus propios controles nativos.
  const stillImages = images.filter((img) => img.mediaType !== "VIDEO");

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
        <div>
          {/* AGREGADO: si el admin subió una vuelta 360° para este producto,
              se muestra primero el visor interactivo (arrastrar para girar),
              y debajo la galería normal de fotos/gifs/videos. */}
          {product.view360Frames && product.view360Frames.length > 0 && (
            <div className="mb-2">
              <Product360Viewer frames={product.view360Frames} />
            </div>
          )}
          <div className={images.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
            {images.length > 0 ? (
              images.map((img) =>
                img.mediaType === "VIDEO" ? (
                  <div key={img.id} className="aspect-[4/5] overflow-hidden bg-velvet-silk">
                    <video src={img.url} className="h-full w-full object-cover" controls muted playsInline />
                  </div>
                ) : (
                  <ZoomableImage
                    key={img.id}
                    src={optimizedImage(img.url, 1200)}
                    alt={img.altText ?? product.name}
                    className="aspect-[4/5] bg-velvet-silk"
                    onClick={() => setLightboxIndex(stillImages.findIndex((i) => i.id === img.id))}
                  />
                )
              )
            ) : (
              !product.view360Frames?.length && (
                <div className="flex aspect-[4/5] items-center justify-center bg-velvet-silk text-velvet-ash">Sin imagen</div>
              )
            )}
          </div>
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

          {(() => {
            const variantText = [selectedColor, selectedSize && `talla ${selectedSize}`].filter(Boolean).join(", ");
            const wa = whatsappLink(
              `Hola, tengo una pregunta sobre ${product.name}${variantText ? ` (${variantText})` : ""}: ${window.location.href}`
            );
            return (
              wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex w-full items-center justify-center gap-2 border border-velvet-black/15 py-3 text-sm text-velvet-black transition-colors hover:border-velvet-black"
                >
                  <WhatsAppIcon />
                  Preguntar por WhatsApp
                </a>
              )
            );
          })()}

          <div className="mt-6 space-y-1.5 border border-velvet-black/10 bg-velvet-silk/40 p-4 text-sm text-velvet-black/80">
            <p>Envíos a todo Colombia. El costo se ve antes de pagar.</p>
            <p>
              ¿No te quedó la talla?{" "}
              <Link to="/politicas/envios" className="underline underline-offset-4">
                Cambios y devoluciones
              </Link>
            </p>
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

      {/* AGREGADO: pantalla grande con scroll al hacer clic en una foto de
          la galería (ver ImageLightbox.tsx). "position: fixed", así que da
          igual dónde vive en el árbol del componente. */}
      {lightboxIndex !== null && stillImages.length > 0 && (
        <ImageLightbox
          images={stillImages.map((img) => ({ url: optimizedImage(img.url, 2000), alt: img.altText ?? product.name }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 01-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.43 9.43 0 01-1.45-5.04c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.91.99 6.7 2.78a9.41 9.41 0 012.77 6.7c0 5.22-4.25 9.46-9.47 9.46zm8.06-17.53A11.32 11.32 0 0012.04.63C5.76.63.65 5.74.65 12.02c0 2.01.52 3.97 1.52 5.69L.55 23.6l6.04-1.58a11.36 11.36 0 005.44 1.38h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.33-8.05z" />
    </svg>
  );
}
