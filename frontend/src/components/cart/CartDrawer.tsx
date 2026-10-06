import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCartStore } from "../../store/cart.store";
import { useCart } from "../../hooks/useCart";
import { formatCurrency } from "../../utils/format";
import { CartLines, ShippingNote } from "./CartLines";

/**
 * Carrito lateral: se abre desde el ícono del header y cada vez que se
 * agrega algo. Mismo carrito que /cart (ver hooks/useCart).
 */
export function CartDrawer() {
  const open = useCartStore((s) => s.drawerOpen);
  const close = useCartStore((s) => s.closeDrawer);
  const cart = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Se cierra al cambiar de página
  useEffect(() => {
    close();
  }, [location.pathname, close]);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement;
    cart.refresh();
    requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      returnFocus.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const total = cart.subtotal - cart.discount;

  return (
    <div className={`vn-cart vn-qv${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="vn-scrim" onClick={close} />
      <div className="vn-sheet vn-cart-sheet" role="dialog" aria-modal="true" aria-labelledby="vn-cart-title">
        <div className="flex items-center justify-between border-b border-black py-4">
          <h2 id="vn-cart-title" className="vn-wide text-2xl">
            Carrito {cart.count > 0 && <span className="text-velvet-ash">({cart.count})</span>}
          </h2>
          <button ref={closeRef} onClick={close} className="min-h-[44px] px-2 text-sm font-semibold">
            Cerrar
          </button>
        </div>

        {cart.lines.length === 0 ? (
          <div className="py-12">
            <p className="vn-wide text-4xl">Vacío.</p>
            <p className="mt-2 text-velvet-ash">Todavía no has agregado nada.</p>
            <Link to="/shop" className="vn-cta mt-6 flex items-center justify-center">
              Ver el catálogo
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <CartLines lines={cart.lines} onQuantity={cart.setQuantity} onRemove={cart.remove} onNavigate={close} />
            </div>
            <div className="border-t border-black pt-4">
              {cart.error && <p className="mb-3 text-sm text-red-700">{cart.error}</p>}
              {cart.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Descuento{cart.couponCode ? ` (${cart.couponCode})` : ""}</span>
                  <span>−{formatCurrency(cart.discount)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">Subtotal</span>
                <span className="text-xl font-semibold">{formatCurrency(total)}</span>
              </div>
              <p className="text-xs text-velvet-ash">IVA incluido.</p>
              <div className="mt-3">
                <ShippingNote />
              </div>
              <button
                className="vn-cta"
                disabled={cart.hasStockIssue}
                onClick={() => {
                  close();
                  navigate("/checkout");
                }}
              >
                Ir a pagar
              </button>
              <Link to="/cart" onClick={close} className="mt-3 flex min-h-[44px] items-center justify-center text-sm underline underline-offset-4">
                Ver carrito completo
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
