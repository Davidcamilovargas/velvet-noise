import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { useSEO } from "../hooks/useSEO";
import { formatCurrency } from "../utils/format";
import { CartLines, ShippingNote } from "../components/cart/CartLines";
import { Alert } from "../components/ui/Alert";

export default function Cart() {
  useSEO({ title: "Carrito", noindex: true });
  const navigate = useNavigate();
  const cart = useCart();
  const [coupon, setCoupon] = useState("");
  const [applying, setApplying] = useState(false);
  const { refresh } = cart;

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onCoupon(e: FormEvent) {
    e.preventDefault();
    if (!coupon.trim()) return;
    setApplying(true);
    await cart.applyCoupon(coupon.trim().toUpperCase());
    setApplying(false);
    setCoupon("");
  }

  if (cart.isLoading && cart.lines.length === 0) {
    return <div className="vn-home min-h-[60vh] px-4 py-16 text-center text-velvet-ash">Cargando carrito…</div>;
  }

  if (cart.lines.length === 0) {
    return (
      <div className="vn-home min-h-[60vh] px-[var(--gutter)] py-16">
        <h1 className="vn-wide text-[clamp(48px,9vw,140px)]">Vacío.</h1>
        <p className="mt-4 text-velvet-ash">Tu carrito no tiene nada todavía.</p>
        <Link to="/shop" className="vn-cta mt-8 flex max-w-xs items-center justify-center">Ver el catálogo</Link>
      </div>
    );
  }

  const total = cart.subtotal - cart.discount;

  return (
    <div className="vn-home min-h-screen">
      <div className="vn-shop-head !pt-10">
        <h1 className="vn-wide text-[clamp(48px,9vw,140px)]">Carrito</h1>
        <span className="vn-tag text-velvet-ash">
          {cart.count} {cart.count === 1 ? "prenda" : "prendas"}
        </span>
      </div>

      <div className="grid gap-10 border-t border-black px-[var(--gutter)] pb-16 pt-2 lg:grid-cols-[1fr_380px]">
        <div>
          {cart.error && <div className="mt-4"><Alert variant="error">{cart.error}</Alert></div>}
          <CartLines lines={cart.lines} onQuantity={cart.setQuantity} onRemove={cart.remove} large />
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--hdr,96px)+16px)] lg:self-start">
          <div className="border border-black p-5">
            <h2 className="vn-tag">Resumen</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(cart.subtotal)}</span></div>
              {cart.discount > 0 && (
                <div className="flex justify-between">
                  <span>Descuento {cart.couponCode && `(${cart.couponCode})`}</span>
                  <span>−{formatCurrency(cart.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-velvet-ash"><span>Envío</span><span>Al pagar</span></div>
            </div>
            <div className="mt-4 flex items-baseline justify-between border-t border-black/15 pt-4">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-semibold">{formatCurrency(total)}</span>
            </div>
            <p className="text-xs text-velvet-ash">IVA incluido.</p>

            {cart.isGuest ? (
              <p className="mt-4 text-sm text-velvet-ash">¿Tienes un cupón? Lo aplicas en el checkout.</p>
            ) : cart.couponCode ? (
              <div className="mt-4 flex items-center justify-between border border-black/15 px-3 py-2 text-sm">
                <span>
                  Cupón <b>{cart.couponCode}</b>
                  {cart.couponError && <span className="block text-red-700">{cart.couponError}</span>}
                </span>
                <button onClick={cart.removeCoupon} className="min-h-[44px] px-1 underline underline-offset-4">Quitar</button>
              </div>
            ) : (
              <form onSubmit={onCoupon} className="mt-4 flex gap-2">
                <label htmlFor="vn-coupon" className="sr-only">Código de cupón</label>
                <input id="vn-coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Código de cupón" className="vn-input !min-h-[44px] flex-1 uppercase" autoCapitalize="characters" />
                <button className="min-h-[44px] border border-black px-4 text-sm font-semibold" disabled={applying}>
                  {applying ? "…" : "Aplicar"}
                </button>
              </form>
            )}

            <div className="mt-4"><ShippingNote /></div>
            <button className="vn-cta" disabled={cart.hasStockIssue} onClick={() => navigate("/checkout")}>
              Ir a pagar
            </button>
            {cart.hasStockIssue && <p className="mt-2 text-sm text-red-700">Ajusta las cantidades marcadas para continuar.</p>}
            <Link to="/shop" className="mt-3 flex min-h-[44px] items-center justify-center text-sm underline underline-offset-4">
              Seguir comprando
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
