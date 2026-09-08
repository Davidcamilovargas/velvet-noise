import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCustomerById, setCustomerStatus } from "../../services/customer.service";
import { getApiErrorMessage } from "../../services/api";
import type { CustomerDetail as CustomerDetailType, OrderStatus, PaymentStatus } from "../../types/api";
import { Button } from "../../components/ui/Button";
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

export default function AdminCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!id) return;
    fetchCustomerById(id)
      .then(setCustomer)
      .catch((err) => setError(getApiErrorMessage(err)));
  }

  useEffect(load, [id]);

  async function toggleStatus() {
    if (!customer) return;
    try {
      await setCustomerStatus(customer.id, !customer.isActive);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!customer) return <div className="py-16 text-center text-velvet-ash">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-velvet-black">
          {customer.firstName} {customer.lastName}
        </h1>
        <Button variant={customer.isActive ? "secondary" : "primary"} onClick={toggleStatus}>
          {customer.isActive ? "Desactivar cuenta" : "Reactivar cuenta"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 border border-velvet-black/10 bg-velvet-silk/40 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Correo</dt>
          <dd className="mt-1 text-velvet-black">{customer.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Teléfono</dt>
          <dd className="mt-1 text-velvet-black">{customer.phone ?? "No registrado"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Cliente desde</dt>
          <dd className="mt-1 text-velvet-black">{formatDate(customer.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Estado</dt>
          <dd className={`mt-1 font-medium ${customer.isActive ? "text-emerald-700" : "text-red-700"}`}>
            {customer.isActive ? "Activo" : "Desactivado"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Pedidos pagados</dt>
          <dd className="mt-1 text-velvet-black">{customer.orderCount}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Total gastado</dt>
          <dd className="mt-1 font-semibold text-velvet-black">{formatCurrency(customer.totalSpent)}</dd>
        </div>
      </div>

      <div className="border border-velvet-black/10 bg-velvet-silk/40 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Historial de pedidos</h2>
        {customer.orders.length === 0 ? (
          <p className="mt-3 text-sm text-velvet-ash">Este cliente todavía no tiene pedidos.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-velvet-black/10 text-xs font-semibold uppercase tracking-label text-velvet-ash">
                  <th className="py-2 pr-4">Pedido</th>
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4">Pago</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((o) => (
                  <tr key={o.id} className="border-b border-velvet-black/10 last:border-0">
                    <td className="py-2 pr-4">
                      <Link to={`/orders/${o.id}`} className="text-velvet-black/80 hover:text-velvet-burgundy hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-velvet-ash">{formatDate(o.createdAt)}</td>
                    <td className="py-2 pr-4 text-velvet-black/80">{STATUS_LABELS[o.status]}</td>
                    <td className="py-2 pr-4 text-velvet-black/80">{PAYMENT_STATUS_LABELS[o.paymentStatus]}</td>
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
