import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDashboardSummary } from "../../services/dashboard.service";
import { getApiErrorMessage } from "../../services/api";
import type { DashboardSummary, OrderStatus, PaymentStatus } from "../../types/api";
import { formatCurrency, formatDate } from "../../utils/format";
import { Alert } from "../../components/ui/Alert";
import { SalesChart } from "../../components/admin/SalesChart";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  PROCESSING: "En preparación",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  DECLINED: "Rechazado",
  REFUNDED: "Reembolsado",
};

export default function AdminDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardSummary()
      .then(setSummary)
      .catch((err) => setError(getApiErrorMessage(err)));
  }, []);

  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }

  if (!summary) {
    return <div className="py-16 text-center text-velvet-ash">Cargando panel…</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-velvet-black">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Ingresos totales" value={formatCurrency(summary.totalRevenue)} />
        <MetricCard label="Pedidos pagados" value={String(summary.paidOrders)} />
        <MetricCard label="Ticket promedio" value={formatCurrency(summary.averageOrderValue)} />
        <MetricCard label="Pendientes de pago" value={String(summary.pendingPaymentOrders)} tone={summary.pendingPaymentOrders > 0 ? "warn" : "default"} />
      </div>

      <div className="border border-velvet-black/10 bg-velvet-silk/40 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Ventas (últimos 14 días)</h2>
        <div className="mt-4">
          <SalesChart data={summary.salesLast14Days} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border border-velvet-black/10 bg-velvet-silk/40 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Pedidos por estado</h2>
          <ul className="mt-3 space-y-2">
            {summary.ordersByStatus.map((s) => (
              <li key={s.status} className="flex items-center justify-between text-sm">
                <span className="text-velvet-ash">{STATUS_LABELS[s.status]}</span>
                <span className="font-medium text-velvet-black">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-velvet-black/10 bg-velvet-silk/40 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Productos más vendidos</h2>
          {summary.topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-velvet-ash">Todavía no hay ventas pagadas.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {summary.topProducts.map((p) => (
                <li key={p.productId} className="flex items-center justify-between text-sm">
                  <span className="line-clamp-1 text-velvet-ash">{p.name}</span>
                  <span className="shrink-0 font-medium text-velvet-black">
                    {p.quantitySold} un. · {formatCurrency(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {summary.lowStockItems.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-label text-amber-800">Stock bajo</h2>
          <ul className="mt-3 space-y-1.5">
            {summary.lowStockItems.map((item) => (
              <li key={item.variantId} className="flex items-center justify-between text-sm text-amber-800">
                <span>
                  {item.productName}
                  {item.variantLabel && <span className="text-amber-700"> · {item.variantLabel}</span>}
                </span>
                <span className="font-medium">
                  {item.stock} / mín. {item.minStock}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border border-velvet-black/10 bg-velvet-silk/40 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Pedidos recientes</h2>
        {summary.recentOrders.length === 0 ? (
          <p className="mt-3 text-sm text-velvet-ash">Todavía no hay pedidos.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-velvet-black/10 text-xs font-semibold uppercase tracking-label text-velvet-ash">
                  <th className="py-2 pr-4">Pedido</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4">Pago</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-velvet-black/10 last:border-0">
                    <td className="py-2 pr-4">
                      <Link to={`/orders/${o.id}`} className="text-velvet-burgundy hover:text-velvet-black">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-velvet-ash">
                      {o.customerFirstName} {o.customerLastName}
                    </td>
                    <td className="py-2 pr-4 text-velvet-ash">{formatDate(o.createdAt)}</td>
                    <td className="py-2 pr-4 text-velvet-ash">{STATUS_LABELS[o.status]}</td>
                    <td className="py-2 pr-4 text-velvet-ash">{PAYMENT_STATUS_LABELS[o.paymentStatus]}</td>
                    <td className="py-2 pr-4 text-right font-medium text-velvet-black">{formatCurrency(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <div className={`border p-5 ${tone === "warn" ? "border-amber-300 bg-amber-50" : "border-velvet-black/10 bg-velvet-silk/40"}`}>
      <p className="text-xs font-medium uppercase tracking-label text-velvet-ash">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-800" : "text-velvet-black"}`}>{value}</p>
    </div>
  );
}
