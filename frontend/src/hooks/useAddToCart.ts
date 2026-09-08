import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useCartStore } from "../store/cart.store";
import { addBackendCartItem } from "../services/cart.service";
import { getApiErrorMessage } from "../services/api";
import type { Product, ProductVariant } from "../types/api";

/**
 * Agregar al carrito se comporta distinto según haya sesión o no:
 * - Invitado: se guarda solo en el store local (localStorage).
 * - Autenticado: se envía al backend (fuente de verdad) y se actualiza el
 *   contador del header con la respuesta real del servidor.
 * Centralizar esto evita repetir la rama if/else en cada botón "Agregar al
 * carrito" (ProductCard, ProductDetail).
 */
export function useAddToCart() {
  const { user } = useAuth();
  const localAddItem = useCartStore((s) => s.addItem);
  const setBackendItemCount = useCartStore((s) => s.setBackendItemCount);

  const addToCart = useCallback(
    async (product: Product, variant: ProductVariant | undefined, quantity: number) => {
      if (!user) {
        localAddItem(product, variant, quantity);
        return { ok: true as const };
      }
      try {
        const cart = await addBackendCartItem(product.id, variant?.id, quantity);
        setBackendItemCount(cart.items.reduce((sum, i) => sum + i.quantity, 0));
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, message: getApiErrorMessage(err) };
      }
    },
    [user, localAddItem, setBackendItemCount]
  );

  return addToCart;
}
