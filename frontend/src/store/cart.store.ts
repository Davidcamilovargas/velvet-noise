import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product, ProductVariant } from "../types/api";

export interface CartLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  // Snapshot para poder pintar el carrito sin re-consultar el backend en
  // cada render; el precio real y el stock SIEMPRE se revalidan en backend
  // al ir a checkout (Fase 9) — este snapshot es solo para la UI.
  name: string;
  slug: string;
  imageUrl: string | null;
  unitPrice: string;
  variantLabel: string | null;
  stockAtAdd: number;
}

interface CartState {
  lines: CartLine[];
  addItem: (product: Product, variant: ProductVariant | undefined, quantity: number) => void;
  updateQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  clear: () => void;
  totalItems: () => number;
  subtotal: () => number;
  // Cuando el usuario está autenticado, el carrito "real" vive en el
  // backend (ver services/cart.service.ts) y este campo refleja su cantidad
  // total de unidades solo para pintar el contador del header sin tener que
  // duplicar toda la forma del carrito del backend en este store local.
  backendItemCount: number | null;
  setBackendItemCount: (count: number | null) => void;
}

function variantLabel(variant?: ProductVariant): string | null {
  if (!variant || (!variant.color && !variant.size)) return null;
  return [variant.color, variant.size].filter(Boolean).join(" / ");
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],

      addItem: (product, variant, quantity) => {
        if (quantity < 1) return;
        const variantId = variant?.id ?? null;
        const stock = variant?.stock ?? product.stock;

        set((state) => {
          const existing = state.lines.find((l) => l.productId === product.id && l.variantId === variantId);
          if (existing) {
            const nextQuantity = Math.min(existing.quantity + quantity, stock);
            return {
              lines: state.lines.map((l) =>
                l.productId === product.id && l.variantId === variantId ? { ...l, quantity: nextQuantity } : l
              ),
            };
          }
          const line: CartLine = {
            productId: product.id,
            variantId,
            quantity: Math.min(quantity, stock),
            name: product.name,
            slug: product.slug,
            imageUrl: product.images.find((i) => i.isPrimary)?.url ?? product.images[0]?.url ?? null,
            unitPrice: variant?.priceOverride ?? product.price,
            variantLabel: variantLabel(variant),
            stockAtAdd: stock,
          };
          return { lines: [...state.lines, line] };
        });
      },

      updateQuantity: (productId, variantId, quantity) => {
        set((state) => ({
          lines: state.lines
            .map((l) =>
              l.productId === productId && l.variantId === variantId
                ? { ...l, quantity: Math.max(1, Math.min(quantity, l.stockAtAdd)) }
                : l
            )
            .filter((l) => l.quantity > 0),
        }));
      },

      removeItem: (productId, variantId) => {
        set((state) => ({
          lines: state.lines.filter((l) => !(l.productId === productId && l.variantId === variantId)),
        }));
      },

      clear: () => set({ lines: [] }),

      totalItems: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),

      subtotal: () => get().lines.reduce((sum, l) => sum + Number(l.unitPrice) * l.quantity, 0),

      backendItemCount: null,
      setBackendItemCount: (count) => set({ backendItemCount: count }),
    }),
    {
      name: "velvet-noise-cart",
      // El carrito de invitado se mantiene en localStorage para sobrevivir
      // a recargas (requisito de la Fase 8). Al iniciar sesión, se
      // sincroniza con el carrito del backend (`/api/cart`, ver
      // context/AuthContext.tsx) y se limpia este storage local.
      // `backendItemCount` NUNCA se persiste: es un valor derivado del
      // backend que se recalcula en cada sesión, para no arrastrar el
      // conteo de un usuario a la sesión de otro en el mismo navegador.
      partialize: (state) => ({ lines: state.lines }),
    }
  )
);
