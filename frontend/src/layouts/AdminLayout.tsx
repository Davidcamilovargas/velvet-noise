import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSEO } from "../hooks/useSEO";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/products", label: "Productos" },
  { to: "/admin/categories", label: "Categorías" },
  { to: "/admin/inventory", label: "Inventario" },
  { to: "/admin/orders", label: "Pedidos" },
  { to: "/admin/customers", label: "Clientes" },
  { to: "/admin/coupons", label: "Cupones" },
  { to: "/admin/reviews", label: "Reseñas" },
  { to: "/admin/settings", label: "Configuración" },
  { to: "/admin/audit-log", label: "Auditoría" },
];

/**
 * Layout base del panel administrativo. La protección real por rol es
 * `<ProtectedRoute allowedRoles={["ADMIN"]}>` en router/index.tsx (Fase 6) —
 * esto solo define la cáscara visual y la navegación.
 *
 * Paleta de marca aplicada, pero con menos teatralidad que la tienda:
 * es una herramienta de trabajo, no una pieza de campaña.
 */
export function AdminLayout() {
  // noindex para TODO el panel administrativo desde un único lugar — ningún
  // buscador debería indexar estas páginas (aunque ya están protegidas por
  // rol, ver router/ProtectedRoute.tsx, "no indexar" es una capa aparte:
  // evita que la URL /admin/... aparezca en resultados de búsqueda aunque
  // el contenido en sí no cargue sin sesión).
  useSEO({ title: "Panel administrativo", noindex: true });
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-velvet-black/10 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/brand/logo-simbolo-black.png" alt="" aria-hidden className="h-6 w-auto opacity-80" />
            <span className="font-display text-lg text-velvet-black">Panel administrativo</span>
          </div>
          <div className="flex items-center gap-4 text-xs uppercase tracking-label">
            {user && <span className="text-velvet-ash">{user.firstName}</span>}
            <Link to="/" className="text-velvet-black/70 hover:text-velvet-black">
              Volver a la tienda
            </Link>
            <button
              onClick={handleLogout}
              className="border border-velvet-black/25 px-3 py-1.5 font-semibold text-velvet-black/80 transition hover:border-velvet-burgundy hover:text-velvet-burgundy"
            >
              Salir
            </button>
          </div>
        </div>
        <nav className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold uppercase tracking-label text-velvet-ash">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "text-velvet-black" : "transition hover:text-velvet-black")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
