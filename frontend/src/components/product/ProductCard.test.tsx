import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProductCard } from "./ProductCard";
import { useCartStore } from "../../store/cart.store";
import type { Product } from "../../types/api";

// ProductCard usa useAuth() (vía useAddToCart) solo para decidir si agregar
// al carrito local o al del backend — se mockea como invitado (user: null)
// para poder probar el componente sin envolverlo en todo el árbol de
// providers reales ni golpear la red.
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: null, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() }),
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Camiseta básica",
    slug: "camiseta-basica",
    description: "desc",
    price: "50000",
    compareAtPrice: null,
    sku: "SKU-1",
    categoryId: "c1",
    isActive: true,
    isFeatured: false,
    ratingAverage: "0",
    ratingCount: 0,
    images: [],
    variants: [],
    stock: 5,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderCard(product: Product) {
  return render(
    <MemoryRouter>
      <ProductCard product={product} />
    </MemoryRouter>
  );
}

describe("ProductCard", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [] });
  });

  it("muestra el nombre y el precio formateado del producto", () => {
    renderCard(makeProduct({ name: "Camiseta básica", price: "50000" }));
    expect(screen.getByText("Camiseta básica")).toBeInTheDocument();
    expect(screen.getByText(/50\.000/)).toBeInTheDocument();
  });

  it("muestra el precio tachado y el badge de descuento cuando hay compareAtPrice mayor", () => {
    renderCard(makeProduct({ price: "8000", compareAtPrice: "10000" }));
    expect(screen.getByText("-20%")).toBeInTheDocument();
    expect(screen.getByText(/10\.000/)).toBeInTheDocument();
  });

  it("no muestra badge de descuento si no hay compareAtPrice", () => {
    renderCard(makeProduct({ compareAtPrice: null }));
    expect(screen.queryByText(/^-\d+%$/)).not.toBeInTheDocument();
  });

  it("muestra 'Agotado' y deshabilita el botón cuando el stock es 0", () => {
    renderCard(makeProduct({ stock: 0 }));
    const button = screen.getByRole("button", { name: "Agotado" });
    expect(button).toBeDisabled();
  });

  it("al hacer clic en 'Agregar al carrito' sin variantes, agrega el producto al carrito local (invitado)", () => {
    const product = makeProduct({ stock: 5, variants: [] });
    renderCard(product);
    fireEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0].productId).toBe("p1");
  });

  it("si el producto tiene más de una variante, pide elegir en el detalle en vez de un botón directo", () => {
    const product = makeProduct({
      variants: [
        { id: "v1", color: "Rojo", size: "M", stock: 3, priceOverride: null, imageUrl: null, sku: "SKU-1-R", isDefault: true },
        { id: "v2", color: "Azul", size: "M", stock: 2, priceOverride: null, imageUrl: null, sku: "SKU-1-A", isDefault: false },
      ],
    });
    renderCard(product);
    expect(screen.getByText(/Elige color\/talla/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar al carrito" })).not.toBeInTheDocument();
  });
});
