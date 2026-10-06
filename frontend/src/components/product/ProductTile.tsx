import { Link } from "react-router-dom";
import type { Product } from "../../types/api";
import { calculateDiscountPercent, formatCurrency } from "../../utils/format";
import { optimizedImage } from "../../utils/image";
import { COLOR_SWATCH, colorsOf, firstSentence, primaryImage, secondImage, sizesInStock } from "../../utils/variants";

/**
 * Tarjeta de producto (Home, catálogo, relacionados). Movimiento sobrio: con
 * mouse solo cambia a la segunda foto y aparece "+" (vista rápida); nada se
 * agranda ni tapa la foto. Las tallas con stock van siempre como texto.
 * Necesita estar dentro de .vn-home (styles/home.css) y aparece con useReveal.
 */
export function ProductTile({
  product: p,
  delay,
  onQuickView,
}: {
  product: Product;
  delay: number;
  onQuickView: (p: Product) => void;
}) {
  const sold = p.stock <= 0;
  const off = calculateDiscountPercent(p.price, p.compareAtPrice);
  const img = primaryImage(p), alt = secondImage(p);
  const sizes = sizesInStock(p);
  const colors = colorsOf(p);

  return (
    <article className="vn-item" style={{ ["--d" as string]: delay }}>
      <div className="vn-media-wrap">
        <Link to={`/product/${p.slug}`} className="vn-media" aria-label={p.name}>
          {img && <img src={optimizedImage(img, 600)} alt={p.name} loading="lazy" decoding="async" />}
          {alt && <img className="vn-alt" src={optimizedImage(alt, 600)} alt="" loading="lazy" decoding="async" />}
          {sold ? <span className="vn-flag">Agotado</span> : off ? <span className="vn-flag is-sale">−{off}%</span> : null}
        </Link>
        {!sold && (
          <button className="vn-qv-btn" onClick={() => onQuickView(p)} aria-label={`Vista rápida de ${p.name}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>
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
        {!sold && sizes.length > 0 && (
          <span className="vn-gsm text-black/70">
            <span className="sr-only">Tallas disponibles: </span>
            {sizes.join(" · ")}
          </span>
        )}
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
