import { Link } from "react-router-dom";
import type { Product } from "../../types/api";
import { useAddToCart } from "../../hooks/useAddToCart";
import { calculateDiscountPercent, formatCurrency } from "../../utils/format";
import { optimizedImage } from "../../utils/image";
import { COLOR_SWATCH, colorsOf, firstSentence, primaryImage, secondImage, sizesInStock } from "../../utils/variants";

/**
 * Tarjeta de producto del estilo "Ruido / entregas" (Home, catálogo,
 * relacionados). Con mouse: segunda foto y panel de tallas sobre la imagen.
 * En celular: "+" abre la vista rápida. Necesita estar dentro de .vn-home
 * (estilos en styles/home.css) y aparece con useReveal.
 */
export function ProductTile({
  product: p,
  delay,
  onQuickView,
  onAdded,
}: {
  product: Product;
  delay: number;
  onQuickView: (p: Product) => void;
  onAdded: (m: string) => void;
}) {
  const addToCart = useAddToCart();
  const sold = p.stock <= 0;
  const off = calculateDiscountPercent(p.price, p.compareAtPrice);
  const img = primaryImage(p), alt = secondImage(p);
  const sizes = sizesInStock(p);
  const colors = colorsOf(p);
  const singleColor = colors.length <= 1;

  // Agregar directo desde la tarjeta solo cuando no hay que elegir color:
  // si hay varios colores, la talla abre la vista rápida para elegirlo.
  async function quickAdd(size: string | null) {
    if (!singleColor) return onQuickView(p);
    const v = size ? p.variants.find((x) => x.size === size && x.stock > 0) : p.variants.find((x) => x.stock > 0);
    if (!v) return;
    const r = await addToCart(p, v, 1);
    if (r.ok) onAdded(`${p.name}${size ? ` · talla ${size}` : ""} — en tu carrito`);
  }

  return (
    <article className="vn-item" style={{ ["--d" as string]: delay }}>
      <Link to={`/product/${p.slug}`} className="vn-media" aria-label={p.name}>
        {img && <img src={optimizedImage(img, 600)} alt={p.name} loading="lazy" decoding="async" />}
        {alt && <img className="vn-alt" src={optimizedImage(alt, 600)} alt="" loading="lazy" decoding="async" />}
        {sold ? <span className="vn-flag">Agotado</span> : off ? <span className="vn-flag is-sale">−{off}%</span> : null}
      </Link>
      {!sold && (
        <>
          <div className="vn-quick">
            {sizes.length > 0 ? (
              <div className="vn-sizes" aria-label={`Agregar ${p.name}`}>
                {sizes.map((s) => (
                  <button key={s} onClick={() => quickAdd(s)} aria-label={`Agregar ${p.name} talla ${s}`}>
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <button className="vn-cta !mt-0 !min-h-[40px] text-sm" onClick={() => quickAdd(null)}>
                Agregar al carrito
              </button>
            )}
            <button className="vn-qv-open" onClick={() => onQuickView(p)}>
              Vista rápida
            </button>
          </div>
          <button className="vn-m-add" onClick={() => onQuickView(p)} aria-label={`Elegir talla de ${p.name}`}>
            +
          </button>
        </>
      )}
      <div className="vn-body">
        <div className="vn-row">
          <Link to={`/product/${p.slug}`} className="vn-name">
            {p.name}
          </Link>
          <span className="vn-price">
            {formatCurrency(p.price)}
            {p.compareAtPrice && <s>{formatCurrency(p.compareAtPrice)}</s>}
          </span>
        </div>
        <span className="vn-gsm">{sold ? "Agotado. Se repone cuando se acaba." : firstSentence(p)}</span>
        {colors.length > 1 && (
          <span className="vn-swatches" aria-label={`Colores: ${colors.join(", ")}`}>
            {colors.map((c) => (
              <i key={c} style={{ background: COLOR_SWATCH[c] ?? "#bbb" }} />
            ))}
          </span>
        )}
      </div>
    </article>
  );
}
