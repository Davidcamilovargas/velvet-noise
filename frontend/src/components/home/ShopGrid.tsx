import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Category, Product } from "../../types/api";
import { ProductTile } from "../product/ProductTile";
import { useReveal } from "../../hooks/useReveal";

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

  useReveal(gridRef, [list]);

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
          list.map((p, i) => <ProductTile key={p.id} product={p} delay={i % 4} onQuickView={onQuickView} onAdded={onAdded} />)
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
