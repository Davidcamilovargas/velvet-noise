import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { StoreLayout } from "../layouts/StoreLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { AuthProvider } from "../context/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";

// Cada página pública/admin se carga bajo demanda: separa el bundle del
// panel administrativo del bundle público (requisito de rendimiento, Fase 16).
const Home = lazy(() => import("../pages/Home"));
const Shop = lazy(() => import("../pages/Shop"));
const ProductDetail = lazy(() => import("../pages/ProductDetail"));
const Cart = lazy(() => import("../pages/Cart"));
const Checkout = lazy(() => import("../pages/Checkout"));
const Login = lazy(() => import("../pages/Login"));
const Register = lazy(() => import("../pages/Register"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));
const Orders = lazy(() => import("../pages/Orders"));
const OrderDetail = lazy(() => import("../pages/OrderDetail"));
const Profile = lazy(() => import("../pages/Profile"));
const Contact = lazy(() => import("../pages/Contact"));
const NotFound = lazy(() => import("../pages/NotFound"));
const AdminDashboard = lazy(() => import("../pages/Admin/Dashboard"));
const AdminProducts = lazy(() => import("../pages/Admin/Products"));
const AdminCategories = lazy(() => import("../pages/Admin/Categories"));
const AdminInventory = lazy(() => import("../pages/Admin/Inventory"));
const AdminOrders = lazy(() => import("../pages/Admin/Orders"));
const AdminCustomers = lazy(() => import("../pages/Admin/Customers"));
const AdminCustomerDetail = lazy(() => import("../pages/Admin/CustomerDetail"));
const AdminCoupons = lazy(() => import("../pages/Admin/Coupons"));
const AdminReviews = lazy(() => import("../pages/Admin/Reviews"));
const AdminSettings = lazy(() => import("../pages/Admin/Settings"));
const AdminAuditLog = lazy(() => import("../pages/Admin/AuditLog"));

function PageFallback() {
  return <div className="flex min-h-[40vh] items-center justify-center text-sm uppercase tracking-label text-velvet-ash">Cargando…</div>;
}

function withSuspense(element: JSX.Element): JSX.Element {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <StoreLayout />,
    children: [
      { index: true, element: withSuspense(<Home />) },
      { path: "shop", element: withSuspense(<Shop />) },
      { path: "product/:idOrSlug", element: withSuspense(<ProductDetail />) },
      { path: "cart", element: withSuspense(<Cart />) },
      { path: "login", element: withSuspense(<Login />) },
      { path: "register", element: withSuspense(<Register />) },
      { path: "forgot-password", element: withSuspense(<ForgotPassword />) },
      { path: "reset-password/:token", element: withSuspense(<ResetPassword />) },
      { path: "contacto", element: withSuspense(<Contact />) },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "checkout", element: withSuspense(<Checkout />) },
          { path: "orders", element: withSuspense(<Orders />) },
          { path: "orders/:id", element: withSuspense(<OrderDetail />) },
          { path: "profile", element: withSuspense(<Profile />) },
        ],
      },
    ],
  },
  {
    path: "/admin",
    element: <ProtectedRoute allowedRoles={["ADMIN"]} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: withSuspense(<AdminDashboard />) },
          { path: "products", element: withSuspense(<AdminProducts />) },
          { path: "categories", element: withSuspense(<AdminCategories />) },
          { path: "inventory", element: withSuspense(<AdminInventory />) },
          { path: "orders", element: withSuspense(<AdminOrders />) },
          { path: "customers", element: withSuspense(<AdminCustomers />) },
          { path: "customers/:id", element: withSuspense(<AdminCustomerDetail />) },
          { path: "coupons", element: withSuspense(<AdminCoupons />) },
          { path: "reviews", element: withSuspense(<AdminReviews />) },
          { path: "settings", element: withSuspense(<AdminSettings />) },
          { path: "audit-log", element: withSuspense(<AdminAuditLog />) },
        ],
      },
    ],
  },
  { path: "*", element: withSuspense(<NotFound />) },
]);

export function AppRouter() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
