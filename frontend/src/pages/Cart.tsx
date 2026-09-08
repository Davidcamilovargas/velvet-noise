import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCartStore } from "../store/cart.store";
import {
  applyBackendCoupon,
  getBackendCart,
  removeBackendCartItem,
  removeBackendCoupon,
  updateBackendCartItem,
  type BackendCart,
} from "../services/cart.service";
import { getApiErrorMessage } from "../services/api";
import { formatCurrency } from "../utils/format";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { useSEO } from "../hooks/useSEO";

export default function Cart() {
  useSEO({ title: "Carrito de compras", noindex: true });
  const { user } = useAuth();
  return user ? <AuthenticatedCart /> : <GuestCart />;
}

/** Carrito de invitado: 100% local (Zustand + localStorage), sin llamadas al backend. */
function GuestCart() {
  const navigate = useNavigate();
  const { lines, updateQuantity, removeItem, subtotal } = useCartStore();

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState title="Tu carrito está vacío" description="Explora la tienda y encuentra algo que te guste." />
        <div className="mt-6 text-center">
          <Link to="/shop" className="text-sm text-velvet-black/70 transition hover:text-velvet-black">
            Ir a la tienda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl text-velvet-black">Carrito</h1>
      <div className="mt-6">
        <Alert variant="info">
          Estás comprando como invitado.{" "}
          <Link to="/login" className="font-semibold underline">
            Inicia sesión
          </Link>{" "}
          para guardar tu carrito y ver tus pedidos.
        </Alert>
      </div>

      <div className="mt-6 space-y-4">
        {lines.map((line) => (
          <div key={`${line.productId}-${line.variantId}`} className="flex items-center gap-4 border border-velvet-black/10 p-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden bg-velvet-silk">
              {line.imageUrl && (
                <img src={line.imageUrl} alt={line.name} loading="lazy" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex-1">
              <Link to={`/product/${line.slug}`} className="text-sm text-velvet-black transition hover:text-velvet-black/70">
                {line.name}
              </Link>
              {line.variantLabel && <p className="text-xs text-velvet-ash">{line.variantLabel}</p>}
              <p className="mt-1 text-sm text-velvet-black/80">{formatCurrency(line.unitPrice)}</p>
            </div>
            <QuantityStepper
              quantity={line.quantity}
              max={line.stockAtAdd}
              onChange={(q) => updateQuantity(line.productId, line.variantId, q)}
            />
            <button
              onClick={() => removeItem(line.productId, line.variantId)}
              className="text-xs uppercase tracking-label text-velvet-ash transition hover:text-red-600"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>

      <CartSummary subtotal={subtotal()} onCheckout={() => navigate("/checkout")} />
    </div>
  );
}

/** Carrito autenticado: el backend es la fuente de verdad (ver Fase 8, docs/03-api.md). */
function AuthenticatedCart() {
  const navigate = useNavigate();
  const setBackendItemCount = useCartStore((s) => s.setBackendItemCount);
  const [cart, setCart] = useState<BackendCart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  function applyCartUpdate(updated: BackendCart) {
    setCart(updated);
    setBackendItemCount(updated.items.reduce((sum, i) => sum + i.quantity, 0));
  }

  useEffect(() => {
    getBackendCart()
      .then(applyCartUpdate)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleQuantityChange(itemId: string, quantity: number) {
    setError(null);
    try {
      applyCartUpdate(await updateBackendCartItem(itemId, quantity));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleRemove(itemId: string) {
    setError(null);
    try {
      applyCartUpdate(await removeBackendCartItem(itemId));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleApplyCoupon() {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setError(null);
    try {
      applyCartUpdate(await applyBackendCoupon(couponInput.trim()));
      setCouponInput("");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleRemoveCoupon() {
    setError(null);
    try {
      applyCartUpdate(await removeBackendCoupon());
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  if (isLoading) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-velvet-ash">Cargando carrito…</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState title="Tu carrito está vacío" description="Explora la tienda y encuentra algo que te guste." />
        <div className="mt-6 text-center">
          <Link to="/shop" className="text-sm text-velvet-black/70 transition hover:text-velvet-black">
            Ir a la tienda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl text-velvet-black">Carrito</h1>
      {error && (
        <div className="mt-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {cart.items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 border border-velvet-black/10 p-4">
            <div className="flex-1">
              <Link to={`/product/${item.productSlug}`} className="text-sm text-velvet-black transition hover:text-velvet-black/70">
                {item.productName}
              </Link>
              {item.variantLabel && <p className="text-xs text-velvet-ash">{item.variantLabel}</p>}
              <p className="mt-1 text-sm text-velvet-black/80">{formatCurrency(item.unitPrice)}</p>
              {item.exceedsStock && (
                <p className="mt-1 text-xs text-red-600">Solo quedan {item.stock} unidades disponibles.</p>
              )}
            </div>
            <QuantityStepper quantity={item.quantity} max={item.stock} onChange={(q) => handleQuantityChange(item.id, q)} />
            <button
              onClick={() => handleRemove(item.id)}
              className="text-xs uppercase tracking-label text-velvet-ash transition hover:text-red-600"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>

      {/* CUPÓN */}
      <div className="mt-6 flex items-end gap-2">
        {cart.couponCode ? (
          <div className="flex flex-1 items-center justify-between border border-emerald-500 bg-emerald-50 px-4 py-2.5">
            <span className="text-sm text-emerald-700">
              Cupón <strong>{cart.couponCode}</strong> aplicado
              {cart.couponError && <span className="ml-2 text-red-600">— {cart.couponError}</span>}
            </span>
            <button onClick={handleRemoveCoupon} className="text-xs uppercase tracking-label text-velvet-ash transition hover:text-red-600">
              Quitar
            </button>
          </div>
        ) : (
          <>
            <Input
              label="Código de cupón"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="BIENVENIDO10"
              className="flex-1"
            />
            <Button variant="secondary" onClick={handleApplyCoupon} isLoading={couponLoading}>
              Aplicar
            </Button>
          </>
        )}
      </div>

      <CartSummary
        subtotal={cart.subtotal}
        discount={cart.discountTotal}
        tax={cart.taxTotal}
        total={cart.total}
        onCheckout={() => navigate("/checkout")}
        checkoutDisabled={cart.items.some((i) => i.exceedsStock)}
      />
    </div>
  );
}

function QuantityStepper({ quantity, max, onChange }: { quantity: number; max: number; onChange: (q: number) => void }) {
  return (
    <div className="flex items-center border border-velvet-black/30">
      <button onClick={() => onChange(Math.max(1, quantity - 1))} className="px-3 py-1.5 text-velvet-black/70 transition hover:text-velvet-black">
        −
      </button>
      <span className="w-8 text-center text-sm text-velvet-black">{quantity}</span>
      <button
        onClick={() => onChange(Math.min(max, quantity + 1))}
        disabled={quantity >= max}
        className="px-3 py-1.5 text-velvet-black/70 transition hover:text-velvet-black disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

function CartSummary({
  subtotal,
  discount = 0,
  tax = 0,
  total,
  onCheckout,
  checkoutDisabled,
}: {
  subtotal: number;
  discount?: number;
  tax?: number;
  total?: number;
  onCheckout?: () => void;
  checkoutDisabled?: boolean;
}) {
  return (
    <div className="mt-8 ml-auto max-w-sm border border-velvet-black/10 bg-velvet-silk/40 p-6">
      <div className="flex justify-between text-sm text-velvet-black/70">
        <span>Subtotal</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div className="mt-1 flex justify-between text-sm text-emerald-600">
          <span>Descuento</span>
          <span>-{formatCurrency(discount)}</span>
        </div>
      )}
      {tax > 0 && (
        <div className="mt-1 flex justify-between text-sm text-velvet-black/70">
          <span>Impuestos</span>
          <span>{formatCurrency(tax)}</span>
        </div>
      )}
      <div className="mt-1 flex justify-between text-sm text-velvet-ash">
        <span>Envío</span>
        <span>Se calcula en el checkout</span>
      </div>
      <div className="mt-3 flex justify-between border-t border-velvet-black/10 pt-3 text-base font-semibold text-velvet-black">
        <span>Total</span>
        <span>{formatCurrency(total ?? subtotal)}</span>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <Button onClick={onCheckout} disabled={!onCheckout || checkoutDisabled} className="w-full">
          Ir al checkout
        </Button>
        <Link to="/shop" className="text-center text-sm text-velvet-black/70 transition hover:text-velvet-black">
          Continuar comprando
        </Link>
      </div>
    </div>
  );
}
