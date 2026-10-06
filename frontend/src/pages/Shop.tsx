import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchCategories, fetchProducts } from "../services/product.service";
import type { Category, Product } from "../types/api";
import { ProductTile } from "../components/product/ProductTile";
import { QuickView } from "../components/home/QuickView";
import { Alert } from "../components/ui/Alert";
import { useDebounce } from "../hooks/useDebounce";
import { useSEO } from "../hooks/useSEO";
import { useHeaderOffset } from "../hooks/useHeaderOffset";
import { useReveal } from "../hooks/useReveal";
import { COLOR_SWATCH } from "../utils/variants";
import "../styles/home.css";

const SORT_OPTIONS = [
  { value: "newest", label: "Novedades" },
  { value: "popularity", label: "Más vendidos" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
];
const PAGE_SIZE = 12;

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

export default function Shop() {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  useHeaderOffset(rootRef);

  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [facets, setFacets] = useState<{ sizes: string[]; colors: string[] }>({ sizes: [], colors: [] });
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quick, setQuick] = useState<Product | null>(null);

  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const debouncedSearch = useDebounce(searchInput, 400);

  const category = params.get("category") ?? "";
  const sort = params.get("sort") ?? "newest";
  const inStock = params.get("inStock") === "true";
  const onSale = params.get("onSale") === "true";
  const minPrice = params.get("minPrice") ?? "";
  const maxPrice = params.get("maxPrice") ?? "";
  const sizes = list(params.get("size"));
  const colors = list(params.get("color"));
  const page = Number(params.get("page") ?? "1");
  const search = params.get("search") ?? "";

  const activeCategoryName = categories.find((c) => c.slug === category)?.name;
  const title = search ? `“${search}”` : onSale && !category ? "Ofertas" : activeCategoryName ?? "Catálogo";
  useSEO({
    title: search ? `Resultados para "${search}"` : activeCategoryName ?? (onSale ? "Ofertas" : "Tienda"),
    description: activeCategoryName
      ? `Compra ${activeCategoryName.toLowerCase()} con envío a todo Colombia.`
      : "Todo el catálogo de Velvet Noise: filtra por categoría, talla, color y precio.",
  });

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (!("page" in changes)) next.delete("page");
      setParams(next);
    },
    [params, setParams]
  );
  const toggleInList = (key: "size" | "color", value: string) => {
    const cur = list(params.get(key));
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    updateParams({ [key]: next.join(",") || null });
  };

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (debouncedSearch !== search) updateParams({ search: debouncedSearch || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    fetchProducts({
      search: search || undefined,
      category: category || undefined,
      sort: sort as "newest" | "popularity" | "price_asc" | "price_desc",
      inStock: inStock || undefined,
      onSale: onSale || undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      size: sizes.join(",") || undefined,
      color: colors.join(",") || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        if (!active) return;
        setProducts(res.data);
        setTotal(res.pagination.total);
        if (res.facets) setFacets(res.facets);
      })
      .catch((err) => active && setError(err?.message ?? "No se pudieron cargar los productos."))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  useReveal(gridRef, [products, isLoading]);

  // Indicador negro bajo la categoría activa
  useLayoutEffect(() => {
    const move = () => {
      const btn = chipsRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      const pill = pillRef.current;
      if (!pill) return;
      if (!btn) return void (pill.style.width = "0px");
      pill.style.width = `${btn.offsetWidth}px`;
      pill.style.transform = `translateX(${btn.offsetLeft}px)`;
      // Que la categoría activa quede a la vista si la barra se desliza.
      const bar = chipsRef.current;
      if (bar && (btn.offsetLeft < bar.scrollLeft || btn.offsetLeft + btn.offsetWidth > bar.scrollLeft + bar.clientWidth * 0.85)) {
        bar.scrollLeft = Math.max(0, btn.offsetLeft - 16);
      }
    };
    move();
    addEventListener("resize", move);
    // Los botones cambian de ancho cuando termina de cargar la tipografía.
    const ro = new ResizeObserver(move);
    chipsRef.current?.querySelectorAll("button").forEach((b) => ro.observe(b));
    return () => {
      removeEventListener("resize", move);
      ro.disconnect();
    };
  }, [category, onSale, categories]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilters = useMemo(() => {
    const out: { label: string; clear: () => void }[] = [];
    sizes.forEach((s) => out.push({ label: `Talla ${s}`, clear: () => toggleInList("size", s) }));
    colors.forEach((c) => out.push({ label: c, clear: () => toggleInList("color", c) }));
    if (minPrice || maxPrice)
      out.push({
        label: `${minPrice ? `$${Number(minPrice).toLocaleString("es-CO")}` : "$0"} – ${maxPrice ? `$${Number(maxPrice).toLocaleString("es-CO")}` : "más"}`,
        clear: () => updateParams({ minPrice: null, maxPrice: null }),
      });
    if (inStock) out.push({ label: "Disponibles", clear: () => updateParams({ inStock: null }) });
    if (search) out.push({ label: `Búsqueda: ${search}`, clear: () => { setSearchInput(""); updateParams({ search: null }); } });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  function clearAll() {
    setSearchInput("");
    const next = new URLSearchParams();
    if (category) next.set("category", category);
    setParams(next);
  }

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFiltersOpen(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  return (
    <div ref={rootRef} className="vn-home min-h-screen">
      <div className="vn-shop-head !pt-10">
        <h1 className="vn-wide text-[clamp(48px,9vw,140px)]">{title}</h1>
        <span className="vn-tag text-velvet-ash" aria-live="polite">
          {isLoading ? "Buscando…" : `${total} ${total === 1 ? "pieza" : "piezas"}`}
        </span>
      </div>

      <div className="vn-chips vn-shop-bar" role="toolbar" aria-label="Categorías y filtros">
        <div ref={chipsRef} className="relative flex gap-1" style={{ maskImage: "linear-gradient(to right, #000 85%, transparent)" }}>
          <span ref={pillRef} className="vn-pill" aria-hidden style={{ top: 0 }} />
          <button aria-pressed={!category && !onSale} onClick={() => updateParams({ category: null, onSale: null })}>
            Todo
          </button>
          {categories.map((c) => (
            <button key={c.id} aria-pressed={category === c.slug} onClick={() => updateParams({ category: c.slug, onSale: null })}>
              {c.name}
            </button>
          ))}
          <button aria-pressed={onSale && !category} onClick={() => updateParams({ onSale: "true", category: null })}>
            Ofertas
          </button>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-4">
          <label className="sr-only" htmlFor="vn-sort">Ordenar</label>
          <select id="vn-sort" value={sort} onChange={(e) => updateParams({ sort: e.target.value })} className="vn-select hidden md:block">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button className="vn-filter-btn" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
            Filtros{activeFilters.length ? ` (${activeFilters.length})` : ""}
          </button>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-[var(--gutter)] pt-4">
          {activeFilters.map((f) => (
            <button key={f.label} className="vn-token" onClick={f.clear} aria-label={`Quitar filtro ${f.label}`}>
              {f.label} <span aria-hidden>×</span>
            </button>
          ))}
          <button className="text-sm underline underline-offset-4" onClick={clearAll}>Limpiar</button>
        </div>
      )}

      {error && (
        <div className="px-[var(--gutter)] pt-6">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <section ref={gridRef} className="vn-grid" aria-busy={isLoading}>
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} aria-hidden>
                <div className="vn-skel aspect-[4/5]" />
                <div className="vn-skel mt-3 h-4 w-3/4" />
                <div className="vn-skel mt-2 h-3 w-1/2" />
              </div>
            ))
          : products.map((p, i) => <ProductTile key={p.id} product={p} delay={i % 4} onQuickView={setQuick} />)}
        {!isLoading && products.length === 0 && (
          <div className="col-span-full py-12">
            <p className="vn-wide text-[40px]">Nada aquí.</p>
            <p className="mt-2 max-w-md text-velvet-ash">
              No hay piezas con estos filtros.{" "}
              {activeFilters.length > 0 ? (
                <button className="underline underline-offset-4" onClick={clearAll}>Quitar filtros</button>
              ) : (
                <button className="underline underline-offset-4" onClick={() => updateParams({ category: null, onSale: null })}>Ver todo</button>
              )}
            </p>
          </div>
        )}
      </section>

      {!isLoading && totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pb-16" aria-label="Páginas">
          <button className="vn-page-btn" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>Anterior</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button key={n} className="vn-page-btn" aria-current={n === page ? "page" : undefined} onClick={() => updateParams({ page: String(n) })}>{n}</button>
          ))}
          <button className="vn-page-btn" disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}>Siguiente</button>
        </nav>
      )}

      {/* Panel de filtros: lateral en escritorio, hoja desde abajo en celular */}
      <div className={`vn-qv${filtersOpen ? " is-open" : ""}`} aria-hidden={!filtersOpen}>
        <div className="vn-scrim" onClick={() => setFiltersOpen(false)} />
        <div className="vn-sheet" role="dialog" aria-modal="true" aria-label="Filtros">
          <div className="vn-grab" />
          <div className="flex items-center justify-between pt-2">
            <h2 className="vn-wide text-3xl">Filtros</h2>
            <button className="min-h-[44px] px-2 text-sm font-semibold" onClick={() => setFiltersOpen(false)}>Cerrar</button>
          </div>

          <div className="vn-step">
            <label className="vn-tag block" htmlFor="vn-search">Buscar</label>
            <input id="vn-search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Hoodie, jean, gorra…" className="vn-input mt-2" />
          </div>

          {facets.sizes.length > 0 && (
            <div className="vn-step">
              <span className="vn-tag">Talla</span>
              <div className="vn-opts" role="group" aria-label="Talla">
                {facets.sizes.map((s) => (
                  <button key={s} aria-pressed={sizes.includes(s)} onClick={() => toggleInList("size", s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {facets.colors.length > 0 && (
            <div className="vn-step">
              <span className="vn-tag">Color</span>
              <div className="vn-opts" role="group" aria-label="Color">
                {facets.colors.map((c) => (
                  <button key={c} aria-pressed={colors.includes(c)} onClick={() => toggleInList("color", c)}>
                    <span className="vn-sw" style={{ background: COLOR_SWATCH[c] ?? "#B9B4AE" }} />
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="vn-step">
            <span className="vn-tag">Precio</span>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="vn-min">Precio mínimo</label>
              <input id="vn-min" type="number" inputMode="numeric" min={0} step={10000} placeholder="Mín" value={minPrice} onChange={(e) => updateParams({ minPrice: e.target.value || null })} className="vn-input" />
              <span className="text-velvet-ash">–</span>
              <label className="sr-only" htmlFor="vn-max">Precio máximo</label>
              <input id="vn-max" type="number" inputMode="numeric" min={0} step={10000} placeholder="Máx" value={maxPrice} onChange={(e) => updateParams({ maxPrice: e.target.value || null })} className="vn-input" />
            </div>
          </div>

          <div className="vn-step grid gap-3">
            <label className="flex min-h-[44px] items-center gap-3 text-sm">
              <input type="checkbox" checked={inStock} onChange={(e) => updateParams({ inStock: e.target.checked ? "true" : null })} className="h-5 w-5 accent-black" />
              Solo disponibles
            </label>
          </div>

          <div className="vn-step md:hidden">
            <label className="vn-tag block" htmlFor="vn-sort-m">Ordenar</label>
            <select id="vn-sort-m" value={sort} onChange={(e) => updateParams({ sort: e.target.value })} className="vn-select mt-2 w-full">
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="sticky bottom-0 -mx-4 mt-6 flex gap-2 bg-velvet-silk px-4 py-4 md:-mx-7 md:px-7">
            <button className="min-h-[52px] flex-1 border border-black text-sm font-semibold" onClick={clearAll}>Limpiar</button>
            <button className="vn-cta !mt-0 flex-[2]" onClick={() => setFiltersOpen(false)}>
              {isLoading ? "Buscando…" : `Ver ${total} ${total === 1 ? "pieza" : "piezas"}`}
            </button>
          </div>
        </div>
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </div>
  );
}
