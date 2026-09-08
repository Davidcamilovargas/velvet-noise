import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCartStore } from "../../store/cart.store";
import { useAuth } from "../../context/AuthContext";
import { fetchCategories } from "../../services/product.service";
import type { Category } from "../../types/api";

const NAV_LINKS = [
  { label: "Ofertas", to: "/shop?onSale=true" },
  { label: "Contacto", to: "/contacto" },
];

/**
 * Header tipo retail deportivo (adidas.com): barra de anuncio negra arriba,
 * header blanco con navegación y un mega-menú de "Tienda" que despliega las
 * categorías reales (no hay jerarquía de subcategorías en el modelo de
 * datos — ver backend/src/db/schema.ts — así que el panel lista las 5
 * categorías reales como columna única, más un bloque de campaña, en vez de
 * simular subcategorías que no existen).
 */
export function Header() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, logout } = useAuth();
  const localTotalItems = useCartStore((s) => s.totalItems());
  const backendItemCount = useCartStore((s) => s.backendItemCount);
  // Autenticado: el contador real vive en el backend. Invitado: en el store local.
  const totalItems = user ? backendItemCount ?? 0 : localTotalItems;

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => {
        /* el mega-menú simplemente no muestra categorías si falla — no es una ruta crítica */
      });
  }, []);

  function openShopMenu() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setShopMenuOpen(true);
  }

  function scheduleCloseShopMenu() {
    closeTimer.current = setTimeout(() => setShopMenuOpen(false), 150);
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const query = search.trim();
    navigate(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
    setSearchOpen(false);
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-40 bg-white">
      <div className="bg-velvet-black py-2 text-center text-[11px] font-semibold uppercase tracking-label text-white">
        Envíos a todo Colombia — 10% adicional con el código BIENVENIDO10
      </div>

      <div className="border-b border-velvet-black/10">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Velvet Noise — inicio">
            <img src="/brand/logo-isotipo-black.png" alt="" aria-hidden className="h-7 w-auto" />
            <span className="font-display text-lg tracking-wide text-velvet-black">
              Velvet <em className="not-italic font-display italic">Noise</em>
            </span>
          </Link>

          <nav className="hidden gap-7 text-xs font-semibold uppercase tracking-label text-velvet-black/70 md:flex">
            <div className="relative" onMouseEnter={openShopMenu} onMouseLeave={scheduleCloseShopMenu}>
              <Link
                to="/shop"
                className="flex items-center gap-1 py-1 transition hover:text-velvet-black"
                aria-haspopup="true"
                aria-expanded={shopMenuOpen}
              >
                Tienda
              </Link>

              {shopMenuOpen && (
                <div
                  className="absolute left-1/2 top-full w-[560px] -translate-x-1/2 border border-velvet-black/10 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
                  onMouseEnter={openShopMenu}
                  onMouseLeave={scheduleCloseShopMenu}
                >
                  <div className="grid grid-cols-[1fr_220px]">
                    <div className="p-6">
                      <span className="text-[11px] text-velvet-ash">Categorías</span>
                      <ul className="mt-3 space-y-2.5">
                        {categories.map((category) => (
                          <li key={category.id}>
                            <Link
                              to={`/shop?category=${category.slug}`}
                              onClick={() => setShopMenuOpen(false)}
                              className="normal-case text-sm font-normal tracking-normal text-velvet-black transition hover:text-velvet-burgundy"
                            >
                              {category.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <Link
                        to="/shop"
                        onClick={() => setShopMenuOpen(false)}
                        className="mt-5 inline-block text-[11px] font-semibold uppercase tracking-label text-velvet-black underline decoration-velvet-black/30 underline-offset-4 hover:decoration-velvet-black"
                      >
                        Ver todo el catálogo
                      </Link>
                    </div>
                    <div className="velvet-grain bg-velvet-wine p-6">
                      <img src="/brand/logo-simbolo.png" alt="" aria-hidden className="h-6 w-auto opacity-70" />
                      <p className="mt-4 font-display text-base italic leading-snug text-white">
                        Ruido por fuera.
                        <br />
                        Terciopelo por dentro.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {NAV_LINKS.map((link) => (
              <Link key={link.label} to={link.to} className="py-1 transition hover:text-velvet-black">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-5">
            <div className="hidden sm:block">
              {searchOpen ? (
                <form onSubmit={handleSearch} className="flex items-center border-b border-velvet-black/40">
                  <label htmlFor="site-search" className="sr-only">
                    Buscar productos
                  </label>
                  <input
                    id="site-search"
                    type="search"
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onBlur={() => !search && setSearchOpen(false)}
                    placeholder="Buscar"
                    className="w-40 bg-transparent py-1 text-sm text-velvet-black placeholder:text-velvet-ash outline-none"
                  />
                </form>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  aria-label="Buscar productos"
                  className="text-velvet-black/80 transition hover:text-velvet-black"
                >
                  <SearchIcon />
                </button>
              )}
            </div>

            <Link to="/cart" className="relative text-velvet-black/80 transition hover:text-velvet-black" aria-label="Carrito">
              <CartIcon />
              {totalItems > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-velvet-burgundy text-[10px] font-semibold text-white">
                  {totalItems}
                </span>
              )}
            </Link>

            {user ? (
              <div className="hidden items-center gap-4 sm:flex">
                <Link
                  to={user.role === "ADMIN" ? "/admin" : "/profile"}
                  className="text-xs font-semibold uppercase tracking-label text-velvet-black/80 hover:text-velvet-black"
                >
                  Hola, {user.firstName}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-xs font-semibold uppercase tracking-label text-velvet-black/50 transition hover:text-velvet-burgundy"
                >
                  Salir
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden text-xs font-semibold uppercase tracking-label text-velvet-black/80 hover:text-velvet-black sm:block"
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function CartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M2.25 3h1.386c.51 0 .955.343 1.087.836l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.72-4.708 1.972-6.243.096-.586-.393-1.007-.985-1.007H5.106M7.5 14.25L5.106 5.243M7.5 14.25l-1.5 6M17.25 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM9 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M21 21l-4.35-4.35m0 0a7.5 7.5 0 10-10.6 0 7.5 7.5 0 0010.6 0z" />
    </svg>
  );
}
