import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Category, Product } from "../../types/api";
import { useAddToCart } from "../../hooks/useAddToCart";
import { calculateDiscountPercent, formatCurrency } from "../../utils/format";
import { optimizedImage } from "../../utils/image";
import { COLOR_SWATCH, colorsOf, firstSentence, primaryImage, secondImage, sizesInStock } from "../../utils/variants";

const ALL = "Todo";
const SALE = "Ofertas";

/**
 * Grilla de la Home: filtro con indicador que se desliza, tarjetas que
 * aparecen escalonadas al entrar en pantalla y, con mouse, un panel de
 * tallas que sube sobre la foto. En celular, "+" abre la vista rápida.
 */
export function ShopGrid({
  products,
  categories,
  onQuickView,
  onAdded,
}: {
  products: Product[];
  categories: Category[];
  onQuickView: (p: Product) => void;
  onAdded: (m: string) => void;
}) {
  const [current, setCurrent] = useState(ALL);
  const [shown, setShown] = useState(ALL);
  const [leaving, setLeaving] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const gridRef = useRef<HTMLElement>(null);
  const reduce = useMemo(() => matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  const tabs = useMemo(() => {
    const withProducts = categories.filter((c) => products.some((p) => p.categoryId === c.id)).map((c) => c.name);
    return [ALL, ...withProducts, ...(products.some((p) => p.compareAtPrice) ? [SALE] : [])];
  }, [categories, products]);

  const list = useMemo(
    () =>
      products.filter((p) =>
        shown === ALL ? true : shown === SALE ? !!p.compareAtPrice : p.category?.name === shown
      ),
    [products, shown]
  );

  // Indicador negro bajo la categoría activa
  useLayoutEffect(() => {
    const move = () => {
      const btn = chipsRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      const pill = pillRef.current;
      if (!btn || !pill) return;
      pill.style.width = `${btn.offsetWidth}px`;
      pill.style.transform = `translateX(${btn.offsetLeft}px)`;
    };
    move();
    addEventListener("resize", move);
    document.fonts?.ready.then(move);
    return () => removeEventListener("resize", move);
  }, [current, tabs]);

  // Aparición escalonada, una sola vez por tarjeta
  useEffect(() => {
    const items = [...(gridRef.current?.querySelectorAll<HTMLElement>(".vn-item") ?? [])];
    if (reduce) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [list, reduce]);

  function choose(tab: string) {
    if (tab === current) return;
    setCurrent(tab);
    if (reduce) return setShown(tab);
    setLeaving(true);
    window.setTimeout(() => {
      setShown(tab);
      setLeaving(false);
    }, 150);
  }

  return (
    <>
      <div className="vn-shop-head" id="todo">
        <h2 className="vn-wide">{current}</h2>
        <span className="vn-tag text-velvet-ash">
          {list.length} {list.length === 1 ? "pieza" : "piezas"}
        </span>
      </div>
      <div ref={chipsRef} className="vn-chips" role="group" aria-label="Filtrar por categoría">
        <span ref={pillRef} className="vn-pill" aria-hidden />
        {tabs.map((t) => (
          <button key={t} aria-pressed={t === current} onClick={() => choose(t)}>
            {t}
          </button>
        ))}
      </div>
      <section ref={gridRef} className={`vn-grid${leaving ? " is-leaving" : ""}`} aria-live="polite">
        {list.length > 0 ? (
          list.map((p, i) => <Card key={p.id} product={p} delay={i % 4} onQuickView={onQuickView} onAdded={onAdded} />)
        ) : (
          <div className="col-span-full py-12">
            <p className="vn-wide text-[40px]">Nada aquí.</p>
            <p className="mt-2 text-velvet-ash">
              No hay piezas en esta categoría ahora.{" "}
              <button className="underline" onClick={() => choose(ALL)}>
                Ver todo
              </button>
            </p>
          </div>
        )}
      </section>
      <div className="flex justify-center pb-16">
        <Link to="/shop" className="vn-ghost !border-black hover:!bg-black hover:!text-velvet-silk">
          Ver el catálogo con filtros
        </Link>
      </div>
    </>
  );
}

function Card({
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
