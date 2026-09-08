import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCategories, fetchProducts } from "../services/product.service";
import type { Category, Product } from "../types/api";
import { ProductCard } from "../components/product/ProductCard";
import { ProductCardSkeleton } from "../components/product/ProductCardSkeleton";
import { getApiErrorMessage } from "../services/api";
import { Alert } from "../components/ui/Alert";
import { useSEO } from "../hooks/useSEO";

// Tono "sereno, nunca eufórico" (manual de marca): frases cortas, sin signos
// de exclamación, sin superlativos de venta. Se reemplazan los íconos emoji
// del diseño original por numeración editorial — más cerca de una revista
// que de un banner de e-commerce.
const BENEFITS = [
  { n: "01", title: "Envíos a todo el país", description: "Tu pedido, a la puerta de tu casa." },
  { n: "02", title: "Pagos seguros", description: "Procesados por Wompi. Nunca vemos tu tarjeta." },
  { n: "03", title: "Garantía en cada prenda", description: "Cambios y devoluciones sin fricción." },
  { n: "04", title: "Atención directa", description: "Antes, durante y después de tu compra." },
];

export default function Home() {
  useSEO({
    description: "Velvet Noise — ropa con carácter. Envíos a todo Colombia y pagos 100% seguros vía Wompi.",
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [onSale, setOnSale] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([
      fetchCategories(),
      fetchProducts({ featured: true, pageSize: 8 }),
      fetchProducts({ onSale: true, pageSize: 4 }),
    ])
      .then(([categoriesRes, featuredRes, onSaleRes]) => {
        if (!active) return;
        setCategories(categoriesRes);
        setFeatured(featuredRes.data);
        setOnSale(onSaleRes.data);
      })
      .catch((err) => active && setError(getApiErrorMessage(err)))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="bg-white">
      {/* HERO — el único momento "de campaña" de la página: pantalla completa,
          editorial, sobre fondo oscuro con grano, como un banner de colección
          de adidas.com dentro de una tienda blanca. El resto de la página usa
          el chrome claro tipo retail deportivo. */}
      <section className="velvet-grain relative flex min-h-[92vh] flex-col justify-end overflow-hidden bg-velvet-wine">
        <div
          className="absolute inset-0 opacity-70"
          style={{ backgroundImage: "radial-gradient(ellipse at 25% 15%, #5a1c30 0%, #000000 72%)" }}
          aria-hidden
        />
        <img
          src="/brand/logo-simbolo.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-[32rem] w-auto opacity-[0.07] sm:h-[42rem]"
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-40 sm:px-6 lg:px-8">
          <span className="text-xs font-semibold uppercase tracking-label text-velvet-silk/60">
            Colección actual
          </span>
          <h1 className="mt-5 max-w-4xl font-display text-6xl leading-[0.95] text-velvet-silk sm:text-7xl lg:text-8xl">
            Ruido por fuera.
            <br />
            <em className="italic text-velvet-silk/80">Terciopelo</em> por dentro.
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-velvet-silk/60">
            Velvet Noise es una casa de ropa hecha para quienes prefieren la actitud a la explicación.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/shop"
              className="inline-flex items-center justify-center bg-velvet-silk px-8 py-3.5 text-xs font-semibold uppercase tracking-label text-velvet-black transition hover:bg-white"
            >
              Comprar ahora
            </Link>
            <Link
              to="/shop?onSale=true"
              className="inline-flex items-center justify-center border border-velvet-silk/40 px-8 py-3.5 text-xs font-semibold uppercase tracking-label text-velvet-silk transition hover:border-velvet-silk"
            >
              Ver ofertas
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {/* CATEGORÍAS */}
      <section id="categorias" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between border-b border-velvet-black/10 pb-4">
          <h2 className="font-display text-2xl text-velvet-black">Categorías</h2>
          <span className="text-xs uppercase tracking-label text-velvet-ash">
            {categories.length > 0 ? `${categories.length} en total` : ""}
          </span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-px bg-velvet-black/10 sm:grid-cols-3 md:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse bg-velvet-silk" />)
            : categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/shop?category=${category.slug}`}
                  className="group flex h-32 flex-col items-center justify-center bg-white text-center transition hover:bg-velvet-silk/40"
                >
                  <span className="text-sm uppercase tracking-label text-velvet-black/80 transition group-hover:text-velvet-black">
                    {category.name}
                  </span>
                </Link>
              ))}
          {!isLoading && categories.length === 0 && (
            <p className="col-span-full bg-white py-10 text-center text-sm text-velvet-ash">
              Aún no hay categorías publicadas.
            </p>
          )}
        </div>
      </section>

      {/* PRODUCTOS DESTACADOS */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between border-b border-velvet-black/10 pb-4">
          <h2 className="font-display text-2xl text-velvet-black">Destacados</h2>
          <Link to="/shop" className="text-xs font-semibold uppercase tracking-label text-velvet-black/60 hover:text-velvet-black">
            Ver todo →
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : featured.map((product) => <ProductCard key={product.id} product={product} />)}
          {!isLoading && featured.length === 0 && (
            <p className="col-span-full text-sm text-velvet-ash">
              Aún no hay productos destacados. Márcalos desde el panel administrativo.
            </p>
          )}
        </div>
      </section>

      {/* OFERTAS */}
      {(isLoading || onSale.length > 0) && (
        <section className="border-y border-velvet-black/10 bg-velvet-silk/30">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between border-b border-velvet-black/10 pb-4">
              <h2 className="font-display text-2xl text-velvet-black">
                Ofertas <span className="text-velvet-burgundy">especiales</span>
              </h2>
              <Link to="/shop?onSale=true" className="text-xs font-semibold uppercase tracking-label text-velvet-black/60 hover:text-velvet-black">
                Ver todo →
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
                : onSale.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </div>
        </section>
      )}

      {/* BENEFICIOS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-px bg-velvet-black/10 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="bg-white px-6 py-8">
              <span className="font-display text-sm text-velvet-ash">{benefit.n}</span>
              <h3 className="mt-3 text-sm uppercase tracking-label text-velvet-black">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-velvet-ash">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
