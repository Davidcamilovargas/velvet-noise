import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchCategories, fetchProducts } from "../services/product.service";
import type { Category, Product } from "../types/api";
import { ProductCard } from "../components/product/ProductCard";
import { ProductCardSkeleton } from "../components/product/ProductCardSkeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useDebounce } from "../hooks/useDebounce";
import { useSEO } from "../hooks/useSEO";

const SORT_OPTIONS = [
  { value: "newest", label: "Novedades" },
  { value: "popularity", label: "Popularidad" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
];

const SELECT_CLASSES =
  "w-full border border-velvet-black/30 bg-transparent px-3 py-2.5 text-sm text-velvet-black outline-none transition focus:border-velvet-black";
const LABEL_CLASSES = "text-xs font-semibold uppercase tracking-label text-velvet-ash";

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const debouncedSearch = useDebounce(searchInput, 400);

  const category = params.get("category") ?? "";
  const sort = params.get("sort") ?? "newest";
  const inStock = params.get("inStock") === "true";
  const onSale = params.get("onSale") === "true";
  const minPrice = params.get("minPrice") ?? "";
  const maxPrice = params.get("maxPrice") ?? "";
  const page = Number(params.get("page") ?? "1");
  const pageSize = 12;

  const activeCategoryName = categories.find((c) => c.slug === category)?.name;
  const search = params.get("search") ?? "";
  useSEO({
    title: search ? `Resultados para "${search}"` : activeCategoryName ? activeCategoryName : "Tienda",
    description: activeCategoryName
      ? `Compra ${activeCategoryName.toLowerCase()} con envío a todo el país.`
      : "Explora todo el catálogo: filtra por categoría, precio y disponibilidad.",
  });

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next);
  }

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (debouncedSearch !== (params.get("search") ?? "")) updateParam("search", debouncedSearch || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    fetchProducts({
      search: params.get("search") ?? undefined,
      category: category || undefined,
      sort: sort as "newest" | "popularity" | "price_asc" | "price_desc",
      inStock: inStock || undefined,
      onSale: onSale || undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      page,
      pageSize,
    })
      .then((res) => {
        if (!active) return;
        setProducts(res.data);
        setTotal(res.pagination.total);
      })
      .catch((err) => active && setError(err?.message ?? "No se pudieron cargar los productos."))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl text-velvet-black sm:text-4xl">Tienda</h1>

      <div className="mt-8 grid grid-cols-1 gap-10 border-t border-velvet-black/10 pt-8 lg:grid-cols-[240px_1fr]">
        {/* FILTROS */}
        <aside className="space-y-7">
          <Input
            label="Buscar"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Nombre del producto..."
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="shop-category" className={LABEL_CLASSES}>
              Categoría
            </label>
            <select
              id="shop-category"
              value={category}
              onChange={(e) => updateParam("category", e.target.value || null)}
              className={SELECT_CLASSES}
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={LABEL_CLASSES}>Rango de precio</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="Mín"
                value={minPrice}
                onChange={(e) => updateParam("minPrice", e.target.value || null)}
                className="w-full border border-velvet-black/30 bg-transparent px-3 py-2.5 text-sm text-velvet-black outline-none transition placeholder:text-velvet-ash focus:border-velvet-black"
              />
              <span className="text-velvet-ash">–</span>
              <input
                type="number"
                min={0}
                placeholder="Máx"
                value={maxPrice}
                onChange={(e) => updateParam("maxPrice", e.target.value || null)}
                className="w-full border border-velvet-black/30 bg-transparent px-3 py-2.5 text-sm text-velvet-black outline-none transition placeholder:text-velvet-ash focus:border-velvet-black"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2.5 text-sm text-velvet-black/80">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => updateParam("inStock", e.target.checked ? "true" : null)}
                className="h-4 w-4 border-velvet-black/30 bg-transparent accent-velvet-black"
              />
              Solo disponibles
            </label>
            <label className="flex items-center gap-2.5 text-sm text-velvet-black/80">
              <input
                type="checkbox"
                checked={onSale}
                onChange={(e) => updateParam("onSale", e.target.checked ? "true" : null)}
                className="h-4 w-4 border-velvet-black/30 bg-transparent accent-velvet-black"
              />
              Solo en oferta
            </label>
          </div>
        </aside>

        {/* RESULTADOS */}
        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-velvet-black/10 pb-4">
            <p className="text-sm text-velvet-ash">{isLoading ? "Buscando..." : `${total} producto(s) encontrados`}</p>
            <select value={sort} onChange={(e) => updateParam("sort", e.target.value)} className={`${SELECT_CLASSES} w-auto`}>
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {isLoading
              ? Array.from({ length: 9 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>

          {!isLoading && products.length === 0 && (
            <EmptyState title="No encontramos productos" description="Intenta ajustar los filtros o la búsqueda." />
          )}

          {!isLoading && totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3">
              <Button variant="secondary" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>
                Anterior
              </Button>
              <span className="text-sm text-velvet-ash">
                Página {page} de {totalPages}
              </span>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => updateParam("page", String(page + 1))}>
                Siguiente
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
