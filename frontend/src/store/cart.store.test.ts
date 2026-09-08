import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "./cart.store";
import type { Product } from "../types/api";

const product: Product = {
  id: "p1",
  name: "Producto de prueba",
  slug: "producto-de-prueba",
  description: "desc",
  price: "10000",
  compareAtPrice: null,
  sku: "SKU-1",
  categoryId: "c1",
  isActive: true,
  isFeatured: false,
  ratingAverage: "0",
  ratingCount: 0,
  images: [],
  variants: [],
  stock: 3,
  createdAt: new Date().toISOString(),
};

describe("cart.store", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [] });
  });

  it("agrega un producto nuevo al carrito", () => {
    useCartStore.getState().addItem(product, undefined, 2);
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().totalItems()).toBe(2);
  });

  it("no permite superar el stock disponible al agregar", () => {
    useCartStore.getState().addItem(product, undefined, 5); // stock = 3
    expect(useCartStore.getState().lines[0].quantity).toBe(3);
  });

  it("acumula cantidades si se agrega el mismo producto de nuevo", () => {
    useCartStore.getState().addItem(product, undefined, 1);
    useCartStore.getState().addItem(product, undefined, 1);
    expect(useCartStore.getState().lines[0].quantity).toBe(2);
  });

  it("calcula el subtotal correctamente", () => {
    useCartStore.getState().addItem(product, undefined, 2);
    expect(useCartStore.getState().subtotal()).toBe(20000);
  });

  it("elimina un producto del carrito", () => {
    useCartStore.getState().addItem(product, undefined, 1);
    useCartStore.getState().removeItem(product.id, null);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("respeta el límite de stock al actualizar cantidad manualmente", () => {
    useCartStore.getState().addItem(product, undefined, 1);
    useCartStore.getState().updateQuantity(product.id, null, 10);
    expect(useCartStore.getState().lines[0].quantity).toBe(3);
  });
});
