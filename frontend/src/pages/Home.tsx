import { useCallback, useEffect, useState } from "react";
import { fetchCategories, fetchProducts } from "../services/product.service";
import type { Category, Product } from "../types/api";
import { getApiErrorMessage } from "../services/api";
import { Alert } from "../components/ui/Alert";
import { useSEO } from "../hooks/useSEO";
import { HeroScroll } from "../components/home/HeroScroll";
import { Manifesto } from "../components/home/Manifesto";
import { DropShowcase } from "../components/home/DropShowcase";
import { ShopGrid } from "../components/home/ShopGrid";
import { QuickView } from "../components/home/QuickView";
import { Toast } from "../components/home/Toast";
import { useToast } from "../hooks/useToast";
import "../styles/home.css";

// Dirección "Ruido / entregas" (design/direction-approved.md): hero de video
// con scroll, frase de materiales, las piezas destacadas como recorrido
// horizontal y la grilla completa con filtro y vista rápida.
const BENEFITS = [
  { title: "Envíos a Colombia", detail: "3-5 días hábiles · $12.000" },
  { title: "Express", detail: "1-2 días hábiles · $25.000" },
  { title: "Recoge en Bogotá", detail: "Sin costo, elígelo al pagar" },
  { title: "Cambios de talla", detail: "Sin usar ni lavar la prenda" },
];

export default function Home() {
  useSEO({
    description: "Velvet Noise — ruido por fuera, terciopelo por dentro. Envíos a todo Colombia, pagos con Wompi.",
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [drop, setDrop] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quick, setQuick] = useState<Product | null>(null);
  const { message: toast, show: showToast } = useToast();

  useEffect(() => {
    let active = true;
    Promise.all([fetchCategories(), fetchProducts({ pageSize: 48 }), fetchProducts({ featured: true, pageSize: 3 })])
      .then(([cats, all, featured]) => {
        if (!active) return;
        setCategories(cats);
        setProducts(all.data);
        // Si no hay destacados marcados en el admin, se usan los primeros con stock.
        setDrop(featured.data.length ? featured.data : all.data.filter((p) => p.stock > 0).slice(0, 3));
      })
      .catch((err) => active && setError(getApiErrorMessage(err)))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const closeQuick = useCallback(() => setQuick(null), []);

  return (
    <div className="vn-home">
      <HeroScroll />
      <Manifesto />

      {error && (
        <div className="px-4 py-6">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-[50vh] items-center justify-center bg-black text-sm text-velvet-silk/70">Cargando la entrega…</div>
      ) : (
        <DropShowcase products={drop} onAdded={showToast} />
      )}

      <div className="vn-labels" aria-label="Beneficios">
        {BENEFITS.map((b) => (
          <div key={b.title}>
            <b>{b.title}</b>
            <span>{b.detail}</span>
          </div>
        ))}
      </div>

      {!isLoading && <ShopGrid products={products} categories={categories} onQuickView={setQuick} />}

      <QuickView product={quick} onClose={closeQuick} onAdded={showToast} />

      <Toast message={toast} />
    </div>
  );
}
