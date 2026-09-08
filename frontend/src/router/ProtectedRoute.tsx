import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types/api";

/**
 * Protege rutas del lado del cliente (mejora de UX: evita el parpadeo de
 * una pantalla que de todas formas fallaría). La autoridad real de
 * permisos SIEMPRE es el backend (`requireAuth`/`requireRole` en cada
 * endpoint) — este componente nunca es la única barrera.
 */
export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm uppercase tracking-label text-velvet-ash">Cargando…</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
