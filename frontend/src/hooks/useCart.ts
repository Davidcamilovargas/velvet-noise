import { useCallback, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCartStore } from "../store/cart.store";
import {
  applyBackendCoupon,
  getBackendCart,
  removeBackendCartItem,
  removeBackendCoupon,
  updateBackendCartItem,
} from "../services/cart.service";
import { getApiErrorMessage } from "../services/api";

export interface CartViewLine {
  key: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
  max: number;
  exceedsStock: boolean;
}

/**
 * El carrito con la misma forma tenga o no sesión, para el carrito lateral,
 * /cart y el checkout. Invitado: store local. Con sesión: backend (fuente de
 * verdad), guardado en el store para que todos lo compartan.
 */
export function useCart() {
  const { user } = useAuth();
  const store = useCartStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backend = store.backendCart;

  const lines: CartViewLine[] = user
    ? (backend?.items ?? []).map((i) => ({
        key: i.id,
        name: i.productName,
        slug: i.productSlug,
        imageUrl: i.imageUrl,
        variantLabel: i.variantLabel,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        max: Math.max(1, i.stock),
        exceedsStock: i.exceedsStock,
      }))
    : store.lines.map((l) => ({
        key: `${l.productId}:${l.variantId ?? ""}`,
        name: l.name,
        slug: l.slug,
        imageUrl: l.imageUrl,
        variantLabel: l.variantLabel,
        unitPrice: Number(l.unitPrice),
        quantity: l.quantity,
        max: Math.max(1, l.stockAtAdd),
        exceedsStock: false,
      }));

  const subtotal = user ? backend?.subtotal ?? 0 : store.subtotal();
  const discount = user ? backend?.discountTotal ?? 0 : 0;
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setError(null);
      try {
        await fn();
      } catch (err) {
        setError(getApiErrorMessage(err));
      }
    },
    []
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    await run(async () => store.setBackendCart(await getBackendCart()));
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, run]);

  function guestIds(key: string): [string, string | null] {
    const [productId, variantId] = key.split(":");
    return [productId, variantId || null];
  }

  const setQuantity = (line: CartViewLine, quantity: number) =>
    run(async () => {
      const q = Math.max(1, Math.min(line.max, quantity));
      if (user) store.setBackendCart(await updateBackendCartItem(line.key, q));
      else store.updateQuantity(...guestIds(line.key), q);
    });

  const remove = (line: CartViewLine) =>
    run(async () => {
      if (user) store.setBackendCart(await removeBackendCartItem(line.key));
      else store.removeItem(...guestIds(line.key));
    });

  const applyCoupon = (code: string) => run(async () => store.setBackendCart(await applyBackendCoupon(code)));
  const removeCoupon = () => run(async () => store.setBackendCart(await removeBackendCoupon()));

  return {
    isGuest: !user,
    lines,
    count,
    subtotal,
    discount,
    couponCode: backend?.couponCode ?? null,
    couponError: backend?.couponError ?? null,
    taxTotal: user ? backend?.taxTotal ?? 0 : null,
    hasStockIssue: lines.some((l) => l.exceedsStock),
    isLoading,
    error,
    refresh,
    setQuantity,
    remove,
    applyCoupon,
    removeCoupon,
  };
}
