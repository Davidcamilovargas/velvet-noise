import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listOrders } from "../../services/order.service";
import { getApiErrorMessage } from "../../services/api";
import type { Order, OrderStatus, PaymentStatus } from "../../types/api";
import { Input } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";
import { formatCurrency, formatDate } from "../../utils/format";

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

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listOrders({ status: status || undefined, search: search || undefined })
      .then(setOrders)
      .catch((err) => setError(getApiErrorMessage(err)));
  }, [status, search]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-velvet-black">Pedidos</h1>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-wrap items-end gap-3 border border-velvet-black/10 bg-velvet-silk/40 p-4">
        <Input label="Buscar" placeholder="N° de pedido, nombre o correo" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="order-status-filter" className="text-xs font-semibold uppercase tracking-label text-velvet-ash">
            Estado
          </label>
          <select
            id="order-status-filter"
            className="border border-velvet-black/30 bg-transparent px-3.5 py-2.5 text-sm text-velvet-black outline-none transition focus:border-velvet-black"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="" className="bg-white">
              Todos
            </option>
            {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => (
              <option key={s} value={s} className="bg-white">
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-velvet-black/10 bg-velvet-silk/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-velvet-black/10 text-xs font-semibold uppercase tracking-label text-velvet-ash">
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o) => (
              <tr key={o.id} className="border-b border-velvet-black/10 last:border-0">
                <td className="px-4 py-3">
                  <Link to={`/orders/${o.id}`} className="font-medium text-velvet-burgundy hover:text-velvet-black">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-velvet-ash">
                  {o.customerFirstName} {o.customerLastName}
                </td>
                <td className="px-4 py-3 text-velvet-ash">{formatDate(o.createdAt)}</td>
                <td className="px-4 py-3 text-velvet-ash">{STATUS_LABELS[o.status]}</td>
                <td className="px-4 py-3 text-velvet-ash">{PAYMENT_STATUS_LABELS[o.paymentStatus]}</td>
                <td className="px-4 py-3 text-right font-medium text-velvet-black">{formatCurrency(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders?.length === 0 && <p className="p-6 text-center text-sm text-velvet-ash">No se encontraron pedidos con esos filtros.</p>}
      </div>
    </div>
  );
}
