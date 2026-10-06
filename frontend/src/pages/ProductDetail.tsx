import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchProductByIdOrSlug } from "../services/product.service";
import { fetchProductReviews, createReview } from "../services/review.service";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../services/api";
import type { Product, Review } from "../types/api";
import { calculateDiscountPercent, formatCurrency, formatDate } from "../utils/format";
import { useAddToCart } from "../hooks/useAddToCart";
import { useSEO } from "../hooks/useSEO";
import { useHeaderOffset } from "../hooks/useHeaderOffset";
import { useReveal } from "../hooks/useReveal";
import { Alert } from "../components/ui/Alert";
import { Product360Viewer } from "../components/product/Product360Viewer";
import { ZoomableImage } from "../components/product/ZoomableImage";
import { ImageLightbox } from "../components/product/ImageLightbox";
import { ProductTile } from "../components/product/ProductTile";
import { QuickView } from "../components/home/QuickView";
import { Toast } from "../components/home/Toast";
import { useToast } from "../hooks/useToast";
import { optimizedImage } from "../utils/image";
import { whatsappLink } from "../config/store";
import { COLOR_SWATCH, colorsOf, findVariant, firstSentence, sizesOf } from "../utils/variants";
import "../styles/home.css";

type ProductWithRelated = Product & { relatedProducts: Product[] };

function Accordion({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details className="vn-acc" open={defaultOpen}>
      <summary>
        {title}
        <span aria-hidden className="vn-acc-icon" />
      </summary>
      <div className="vn-acc-body">{children}</div>
    </details>
  );
}

export default function ProductDetail() {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const navigate = useNavigate();
  const addToCart = useAddToCart();
  const rootRef = useRef<HTMLDivElement>(null);
  const relatedRef = useRef<HTMLDivElement>(null);
  const buyRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  useHeaderOffset(rootRef);

  const [product, setProduct] = useState<ProductWithRelated | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [sizeHint, setSizeHint] = useState(false);
  const [shake, setShake] = useState(false);
  const [slide, setSlide] = useState(0);
  const [showSticky, setShowSticky] = useState(false);
  const [quick, setQuick] = useState<Product | null>(null);
  // Hooks arriba de los return tempranos (cargando / error).
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { message: toast, show: showToast } = useToast();

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
    setCartError(null);
    setSlide(0);
    fetchProductByIdOrSlug(idOrSlug)
      .then((data) => {
        if (!active) return;
        setProduct(data);
        // Se preselecciona el color (con stock), pero NO la talla: la persona
        // la elige a conciencia antes de la cantidad.
        const colors = colorsOf(data);
        const color = colors.find((c) => sizesOf(data, c).some((s) => s.inStock)) ?? colors[0] ?? null;
        setSelectedColor(color);
        const sizes = sizesOf(data, color);
        setSelectedSize(sizes.length === 1 && sizes[0].inStock ? sizes[0].size : null);
        setQuantity(1);
        fetchProductReviews(data.id)
          .then((r) => active && setReviews(r))
          .catch(() => active && setReviews([]));
      })
      .catch((err) => active && setError(err?.response?.data?.error?.message ?? "Producto no encontrado."))
      .finally(() => active && setIsLoading(false));
    window.scrollTo(0, 0);
    return () => {
      active = false;
    };
  }, [idOrSlug]);

  // Barra fija de compra en celular cuando el botón principal sale de pantalla
  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([en]) => setShowSticky(!en.isIntersecting && en.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [product]);

  useReveal(relatedRef, [product]);

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
      setReviewSuccess("Gracias por tu reseña. Se publica cuando la revisemos.");
    } catch (err) {
      setReviewError(getApiErrorMessage(err));
    } finally {
      setReviewSaving(false);
    }
  }

  const colors = useMemo(() => (product ? colorsOf(product) : []), [product]);
  const sizes = useMemo(() => (product ? sizesOf(product, selectedColor) : []), [product, selectedColor]);
  const needsSize = sizes.length > 0;
  const selectedVariant = product ? findVariant(product, selectedColor, needsSize ? selectedSize : null) : undefined;

  const stills = useMemo(() => (product?.images ?? []).filter((i) => i.mediaType !== "VIDEO"), [product]);
  const primaryImageUrl = stills.find((i) => i.isPrimary)?.url ?? stills[0]?.url;
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
            ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAverage, reviewCount: product.ratingCount } }
            : {}),
          offers: {
            "@type": "Offer",
            priceCurrency: "COP",
            price: product.price,
            availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: window.location.href,
          },
        }
      : undefined,
  });

  if (isLoading) {
    return (
      <div ref={rootRef} className="vn-home min-h-screen">
        <div className="grid gap-6 p-[var(--gutter)] lg:grid-cols-[1.3fr_1fr]">
          <div className="vn-skel aspect-[4/5]" />
          <div className="space-y-4 pt-4">
            <div className="vn-skel h-12 w-3/4" />
            <div className="vn-skel h-6 w-1/3" />
            <div className="vn-skel h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div ref={rootRef} className="vn-home min-h-[60vh] px-4 py-16">
        <div className="mx-auto max-w-xl">
          <Alert variant="error">{error ?? "Producto no encontrado."}</Alert>
          <Link to="/shop" className="mt-6 inline-block underline underline-offset-4">Volver al catálogo</Link>
        </div>
      </div>
    );
  }

  const price = selectedVariant?.priceOverride ?? product.price;
  const discount = calculateDiscountPercent(price, product.compareAtPrice);
  const stock = selectedVariant?.stock ?? (needsSize ? 0 : product.stock);
  const canAdd = !!selectedVariant && stock > 0;
  const soldOut = product.stock <= 0;
  const media = product.images;
  const variantText = [selectedColor, selectedSize && `talla ${selectedSize}`].filter(Boolean).join(", ");
  const wa = whatsappLink(`Hola, tengo una pregunta sobre ${product.name}${variantText ? ` (${variantText})` : ""}: ${window.location.href}`);
  const waSize = whatsappLink(`Hola, ¿qué talla me recomiendan de ${product.name}? Mido ___ y normalmente uso talla ___.`);

  async function add(goToCheckout = false) {
    if (!product) return;
    if (needsSize && !selectedSize) {
      setSizeHint(true);
      setShake(true);
      buyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!canAdd) return;
    setSaving(true);
    setCartError(null);
    const result = await addToCart(product, selectedVariant, quantity);
    setSaving(false);
    if (!result.ok) return setCartError(result.message);
    if (goToCheckout) navigate("/checkout");
    else showToast(`${product.name}${selectedSize ? ` · talla ${selectedSize}` : ""} — en tu carrito`);
  }

  const ctaLabel = saving ? "Agregando…" : soldOut ? "Agotado" : needsSize && !selectedSize ? "Elige una talla" : !canAdd ? "Agotado en esta talla" : "Agregar al carrito";

  return (
    <div ref={rootRef} className="vn-home">
      <nav aria-label="Ruta" className="px-[var(--gutter)] pt-5 text-sm text-velvet-ash">
        <Link to="/shop" className="hover:text-black">Catálogo</Link>
        {product.category && (
          <>
            <span aria-hidden> / </span>
            <Link to={`/shop?category=${product.category.slug}`} className="hover:text-black">{product.category.name}</Link>
          </>
        )}
      </nav>

      <div className="vn-pdp">
        {/* GALERÍA: carrusel con el dedo en celular, columna de fotos en escritorio */}
        <div>
          {product.view360Frames && product.view360Frames.length > 0 && (
            <div className="mb-2">
              <Product360Viewer frames={product.view360Frames} />
            </div>
          )}
          {media.length > 0 ? (
            <>
              <div
                ref={galleryRef}
                className="vn-gallery"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
                }}
              >
                {media.map((img) =>
                  img.mediaType === "VIDEO" ? (
                    <div key={img.id} className="vn-slide">
                      <video src={img.url} className="h-full w-full object-cover" controls muted playsInline />
                    </div>
                  ) : (
                    <ZoomableImage
                      key={img.id}
                      src={optimizedImage(img.url, 1200)}
                      alt={img.altText ?? product.name}
                      className="vn-slide"
                      onClick={() => setLightboxIndex(stills.findIndex((i) => i.id === img.id))}
                    />
                  )
                )}
              </div>
              {media.length > 1 && (
                <div className="vn-dots" aria-hidden>
                  {media.map((m, i) => (
                    <i key={m.id} className={i === slide ? "is-on" : ""} />
                  ))}
                </div>
              )}
            </>
          ) : (
            !product.view360Frames?.length && <div className="vn-slide flex items-center justify-center text-velvet-ash">Sin imagen</div>
          )}
        </div>

        {/* COMPRA */}
        <div className="vn-buy">
          <h1 className="vn-wide text-[clamp(36px,5vw,64px)]">{product.name}</h1>
          <p className="mt-2 text-velvet-ash">{firstSentence(product)}</p>

          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-semibold">{formatCurrency(price)}</span>
            {product.compareAtPrice && <s className="text-velvet-ash">{formatCurrency(product.compareAtPrice)}</s>}
            {discount && <span className="vn-flag is-sale !static">−{discount}%</span>}
          </div>
          <p className="mt-1 text-xs text-velvet-ash">IVA incluido. El envío se calcula al pagar.</p>

          {product.ratingCount > 0 && (
            <a href="#resenas" className="mt-2 inline-block text-sm" aria-label={`${Number(product.ratingAverage).toFixed(1)} de 5, ${product.ratingCount} reseñas`}>
              <span className="text-velvet-burgundy">{"★".repeat(Math.round(Number(product.ratingAverage)))}{"☆".repeat(5 - Math.round(Number(product.ratingAverage)))}</span>{" "}
              <span className="text-velvet-ash underline underline-offset-4">{product.ratingCount} reseñas</span>
            </a>
          )}

          <div>
            {colors.length > 0 && (
              <div className="vn-step">
                <span className="vn-tag">1 · Color{selectedColor ? `: ${selectedColor}` : ""}</span>
                <div className="vn-opts" role="group" aria-label="Color">
                  {colors.map((c) => (
                    <button
                      key={c}
                      aria-pressed={c === selectedColor}
                      onClick={() => {
                        setSelectedColor(c);
                        setSelectedSize(null);
                        setQuantity(1);
                      }}
                    >
                      <span className="vn-sw" style={{ background: COLOR_SWATCH[c] ?? "#B9B4AE" }} />
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {needsSize && (
              <div className="vn-step" ref={buyRef}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="vn-tag">{colors.length ? "2" : "1"} · Talla</span>
                  {waSize && (
                    <a href={waSize} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">
                      ¿Cuál es mi talla?
                    </a>
                  )}
                </div>
                <div className={`vn-opts${shake ? " vn-shake" : ""}`} role="group" aria-label="Talla" onAnimationEnd={() => setShake(false)}>
                  {sizes.map((s) => (
                    <button
                      key={s.size}
                      aria-pressed={s.size === selectedSize}
                      disabled={!s.inStock}
                      aria-label={s.inStock ? s.size : `${s.size}, agotada`}
                      onClick={() => {
                        setSelectedSize(s.size);
                        setQuantity(1);
                        setSizeHint(false);
                      }}
                    >
                      {s.size}
                    </button>
                  ))}
                </div>
                {sizeHint && !selectedSize && <p className="mt-2 text-sm text-velvet-burgundy" role="alert">Elige una talla para continuar.</p>}
              </div>
            )}

            <div className="vn-step" ref={needsSize ? undefined : buyRef}>
              <span className="vn-tag">{(colors.length ? 1 : 0) + (needsSize ? 1 : 0) + 1} · Cantidad</span>
              <div className="flex items-center gap-4">
                <div className="vn-qty">
                  <button aria-label="Menos" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
                  <output aria-live="polite">{quantity}</output>
                  <button aria-label="Más" onClick={() => setQuantity((q) => Math.min(Math.max(1, stock), q + 1))}>+</button>
                </div>
                {canAdd && stock <= 5 && <span className="text-sm text-velvet-ash">Quedan {stock}.</span>}
              </div>
            </div>
          </div>

          {cartError && <div className="mt-4"><Alert variant="error">{cartError}</Alert></div>}

          <div className="mt-6 grid gap-2">
            <button className="vn-cta !mt-0" disabled={soldOut || saving || (!!selectedSize && !canAdd)} onClick={() => add(false)}>
              {ctaLabel}
            </button>
            {!soldOut && (
              <button className="min-h-[52px] border border-black text-sm font-bold transition-colors hover:bg-black hover:text-velvet-silk disabled:opacity-35" disabled={saving || (!!selectedSize && !canAdd)} onClick={() => add(true)}>
                Comprar ahora
              </button>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="flex min-h-[48px] items-center justify-center gap-2 text-sm underline underline-offset-4">
                Preguntar por WhatsApp
              </a>
            )}
          </div>

          <ul className="vn-perks">
            <li><b>Envío a todo Colombia</b> 3-5 días hábiles · $12.000. Express 1-2 días · $25.000.</li>
            <li><b>Recoge gratis en Bogotá</b> Elige "Recoger en tienda" al pagar.</li>
            <li><b>Cambios de talla</b> Sin usar ni lavar. <Link to="/politicas/envios" className="underline underline-offset-4">Cómo funciona</Link></li>
          </ul>

          <div className="mt-6 border-t border-black">
            <Accordion title="Descripción" defaultOpen>
              <p>{product.description}</p>
            </Accordion>
            <Accordion title="Detalles">
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="vn-tag text-velvet-ash">Referencia</dt><dd className="mt-1">{selectedVariant?.sku ?? product.sku}</dd></div>
                <div><dt className="vn-tag text-velvet-ash">Categoría</dt><dd className="mt-1">{product.category?.name ?? "—"}</dd></div>
              </dl>
            </Accordion>
            <Accordion title="Cuidados">
              <p>Lavado a máquina en frío, del revés. No usar blanqueador. Secado a la sombra.</p>
            </Accordion>
            <Accordion title="Envíos, cambios y devoluciones">
              <p>
                Tienes 5 días hábiles desde que recibes el pedido para retractarte de la compra, y puedes pedir cambio de talla si la prenda está sin usar.{" "}
                <Link to="/politicas/envios" className="underline underline-offset-4">Ver la política completa</Link>
              </p>
            </Accordion>
          </div>
        </div>
      </div>

      {/* RESEÑAS */}
      <section id="resenas" className="border-t border-black px-[var(--gutter)] py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="vn-wide text-[clamp(40px,6vw,88px)]">Reseñas</h2>
          {product.ratingCount > 0 && (
            <span className="text-lg font-semibold">
              {Number(product.ratingAverage).toFixed(1)} / 5 · {product.ratingCount}
            </span>
          )}
        </div>

        {reviews === null ? (
          <p className="mt-6 text-velvet-ash">Cargando reseñas…</p>
        ) : reviews.length === 0 ? (
          <p className="mt-6 text-velvet-ash">Todavía no hay reseñas de esta pieza.</p>
        ) : (
          <ul className="mt-8 grid gap-px bg-black/15 md:grid-cols-2">
            {reviews.map((r) => (
              <li key={r.id} className="bg-velvet-silk p-5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{r.authorName}</span>
                  <span className="text-xs text-velvet-ash">{formatDate(r.createdAt)}</span>
                </div>
                <p className="mt-1 text-velvet-burgundy" aria-label={`${r.rating} de 5 estrellas`}>
                  {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                </p>
                <p className="mt-2 text-sm text-black/75">{r.comment}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 max-w-2xl border border-black/15 p-6">
          {!user ? (
            <p className="text-sm">
              <Link to="/login" state={{ from: `/product/${product.slug}` }} className="font-semibold underline underline-offset-4">Inicia sesión</Link>{" "}
              para dejar tu reseña.
            </p>
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-3">
              <h3 className="vn-tag">Escribe una reseña</h3>
              {reviewError && <Alert variant="error">{reviewError}</Alert>}
              {reviewSuccess && <Alert variant="success">{reviewSuccess}</Alert>}
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Calificación">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={n === reviewRating}
                    onClick={() => setReviewRating(n)}
                    className={`min-h-[44px] min-w-[36px] text-2xl ${n <= reviewRating ? "text-velvet-burgundy" : "text-black/15"}`}
                    aria-label={`${n} estrellas`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <label htmlFor="vn-review" className="sr-only">Comentario</label>
              <textarea
                id="vn-review"
                className="vn-input min-h-[96px] py-3"
                rows={3}
                placeholder="¿Cómo te quedó? ¿Qué tal la tela?"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                required
                minLength={5}
              />
              <button type="submit" className="vn-cta !mt-0 !w-auto px-8" disabled={reviewSaving}>
                {reviewSaving ? "Enviando…" : "Enviar reseña"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* RELACIONADOS */}
      {product.relatedProducts.length > 0 && (
        <section className="border-t border-black">
          <h2 className="vn-wide px-[var(--gutter)] pt-16 text-[clamp(40px,6vw,88px)]">También te puede gustar</h2>
          <div ref={relatedRef} className="vn-grid">
            {product.relatedProducts.slice(0, 4).map((p, i) => (
              <ProductTile key={p.id} product={p} delay={i} onQuickView={setQuick} onAdded={showToast} />
            ))}
          </div>
        </section>
      )}

      {/* Barra de compra fija en celular */}
      {!soldOut && (
        <div className={`vn-sticky-buy${showSticky ? " is-on" : ""}`} aria-hidden={!showSticky}>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{product.name}</p>
            <p className="text-sm">{formatCurrency(price)}{selectedSize ? ` · ${selectedSize}` : ""}</p>
          </div>
          <button className="vn-cta !mt-0 !w-auto shrink-0 px-6" tabIndex={showSticky ? 0 : -1} onClick={() => add(false)} disabled={saving || (!!selectedSize && !canAdd)}>
            {needsSize && !selectedSize ? "Elegir talla" : "Agregar"}
          </button>
        </div>
      )}

      {lightboxIndex !== null && stills.length > 0 && (
        <ImageLightbox
          images={stills.map((img) => ({ url: optimizedImage(img.url, 2000), alt: img.altText ?? product.name }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
      <QuickView product={quick} onClose={() => setQuick(null)} onAdded={showToast} />
      <Toast message={toast} />
    </div>
  );
}
