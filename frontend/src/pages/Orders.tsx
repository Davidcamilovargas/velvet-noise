import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listOrders } from "../services/order.service";
import { getApiErrorMessage } from "../services/api";
import type { Order } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { useSEO } from "../hooks/useSEO";

const STATUS_LABELS: Record<Order["status"], string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  PROCESSING: "En preparación",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

// Acento por estado: verde solo en estados resueltos, rojo en estados
// terminados por error/cancelación, ceniza para lo intermedio. Nunca un
// relleno sólido — solo borde + texto, como pide el manual para el color.
const STATUS_STYLES: Record<Order["status"], string> = {
  PENDING: "border-velvet-ash/50 text-velvet-ash",
  PAID: "border-velvet-black/30 text-velvet-black/80",
  PROCESSING: "border-velvet-black/30 text-velvet-black/80",
  SHIPPED: "border-velvet-black/30 text-velvet-black/80",
  DELIVERED: "border-emerald-500 text-emerald-700",
  CANCELLED: "border-red-500 text-red-700",
  REFUNDED: "border-red-500 text-red-700",
};

export default function Orders() {
  useSEO({ title: "Mis pedidos", noindex: true });
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listOrders()
      .then(setOrders)
      .catch((err) => setError(getApiErrorMessage(err)));
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }

  if (!orders) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-velvet-ash">Cargando pedidos…</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState title="Todavía no tienes pedidos" description="Cuando compres algo, lo verás aquí." />
        <div className="mt-6 text-center">
          <Link to="/shop" className="text-xs font-semibold uppercase tracking-label text-velvet-black/60 hover:text-velvet-black">
            Ir a la tienda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl text-velvet-black">Mis pedidos</h1>

      <div className="mt-8 space-y-px bg-velvet-black/10">
        {orders.map((order) => (
          <Link
            key={order.id}
            to={`/orders/${order.id}`}
            className="flex items-center justify-between gap-4 bg-white p-5 transition hover:bg-velvet-silk/40"
          >
            <div>
              <p className="text-sm text-velvet-black">{order.orderNumber}</p>
              <p className="mt-1 text-xs text-velvet-ash">{formatDate(order.createdAt)}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`border px-3 py-1 text-xs font-semibold uppercase tracking-label ${STATUS_STYLES[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
              <span className="text-sm font-semibold text-velvet-black">{formatCurrency(order.total, order.currency)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
