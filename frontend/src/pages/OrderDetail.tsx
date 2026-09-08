import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { fetchOrderById, updateOrderStatus } from "../services/order.service";
import { createPayment } from "../services/payment.service";
import { useWompiWidget } from "../hooks/useWompiWidget";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../services/api";
import type { Order } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useSEO } from "../hooks/useSEO";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
// relleno sólido — solo borde + texto (manual: color como acento, no fondo).
const STATUS_STYLES: Record<Order["status"], string> = {
  PENDING: "border-velvet-ash/50 text-velvet-ash",
  PAID: "border-velvet-black/30 text-velvet-black/80",
  PROCESSING: "border-velvet-black/30 text-velvet-black/80",
  SHIPPED: "border-velvet-black/30 text-velvet-black/80",
  DELIVERED: "border-emerald-500 text-emerald-700",
  CANCELLED: "border-red-500 text-red-700",
  REFUNDED: "border-red-500 text-red-700",
};

const PAYMENT_STATUS_LABELS: Record<Order["paymentStatus"], string> = {
  PENDING: "Pendiente de pago",
  APPROVED: "Pago aprobado",
  DECLINED: "Pago rechazado",
  REFUNDED: "Reembolsado",
};

const PAYMENT_STATUS_STYLES: Record<Order["paymentStatus"], string> = {
  PENDING: "border-amber-500 text-amber-700",
  APPROVED: "border-emerald-500 text-emerald-700",
  DECLINED: "border-red-500 text-red-700",
  REFUNDED: "border-velvet-ash/50 text-velvet-ash",
};

const SHIPPING_METHOD_LABELS: Record<Order["shippingMethod"], string> = {
  STANDARD: "Envío estándar",
  EXPRESS: "Envío express",
  PICKUP: "Recoger en tienda",
};

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PROCESSING: "En preparación",
  SHIPPED: "Enviado",
  IN_TRANSIT: "En tránsito",
  DELIVERED: "Entregado",
  RETURNED: "Devuelto",
};

// Mismas transiciones que valida order.service.ts en el backend (fuente de
// verdad real) — aquí solo se usan para no ofrecer en el selector opciones
// que el backend rechazaría de todas formas.
const ADMIN_TRANSITIONS: Record<Order["status"], Order["status"][]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "SHIPPED", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export default function OrderDetail() {
  useSEO({ title: "Detalle del pedido", noindex: true });
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const justPlaced = (location.state as { justPlaced?: boolean } | null)?.justPlaced ?? false;

  const { user } = useAuth();
  const { openCheckout } = useWompiWidget();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentStage, setPaymentStage] = useState<"idle" | "opening" | "verifying">("idle");

  const [nextStatus, setNextStatus] = useState<Order["status"] | "">("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchOrderById(id)
      .then(setOrder)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [id]);

  async function handlePay() {
    if (!order) return;
    setPaymentError(null);
    setPaymentStage("opening");
    try {
      const paymentInfo = await createPayment(order.id);
      await openCheckout(paymentInfo); // el usuario completa el pago en el widget alojado por Wompi

      // El resultado que entrega el widget es solo informativo del lado del
      // cliente — la confirmación AUTORITATIVA llega por el webhook al
      // backend (ver docs/03-api.md, Fase 10). Por eso no se actualiza el
      // pedido con lo que dice el widget: se vuelve a consultar el pedido
      // real varias veces, dándole tiempo al webhook de llegar y procesarse.
      setPaymentStage("verifying");
      for (let attempt = 0; attempt < 8; attempt++) {
        await wait(2000);
        const refreshed = await fetchOrderById(order.id);
        setOrder(refreshed);
        if (refreshed.paymentStatus !== "PENDING") break;
      }
    } catch (err) {
      setPaymentError(getApiErrorMessage(err));
    } finally {
      setPaymentStage("idle");
    }
  }

  async function handleStatusChange(e: FormEvent) {
    e.preventDefault();
    if (!order || !nextStatus) return;
    setStatusError(null);
    setStatusSaving(true);
    try {
      const updated = await updateOrderStatus(order.id, {
        status: nextStatus,
        carrier: carrier || undefined,
        trackingNumber: trackingNumber || undefined,
      });
      setOrder(updated);
      setNextStatus("");
      setCarrier("");
      setTrackingNumber("");
    } catch (err) {
      setStatusError(getApiErrorMessage(err));
    } finally {
      setStatusSaving(false);
    }
  }

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-velvet-ash">Cargando pedido…</div>;
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Alert variant="error">{error ?? "Pedido no encontrado."}</Alert>
        <div className="mt-6 text-center">
          <Link to="/orders" className="text-xs font-semibold uppercase tracking-label text-velvet-black/60 hover:text-velvet-black">
            Ver mis pedidos
          </Link>
        </div>
      </div>
    );
  }

  const addr = order.addressSnapshot as Record<string, string | boolean | undefined>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {justPlaced && (
        <div className="mb-6">
          <Alert variant="success">
            Tu pedido fue registrado con éxito. Número de pedido <strong>{order.orderNumber}</strong>.
          </Alert>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-velvet-black">Pedido {order.orderNumber}</h1>
          <p className="mt-1 text-sm text-velvet-ash">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <span className={`border px-3 py-1 text-xs font-semibold uppercase tracking-label ${STATUS_STYLES[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
          <span className={`border px-3 py-1 text-xs font-semibold uppercase tracking-label ${PAYMENT_STATUS_STYLES[order.paymentStatus]}`}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </span>
        </div>
      </div>

      {order.paymentStatus === "PENDING" && order.status !== "CANCELLED" && (
        <div className="mt-4 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>Tu pedido está registrado y en espera de pago.</p>
          {paymentError && (
            <div className="mt-3">
              <Alert variant="error">{paymentError}</Alert>
            </div>
          )}
          {paymentStage === "verifying" ? (
            <p className="mt-3 text-amber-800/80">
              Verificando tu pago con Wompi… si tarda más de lo esperado, puedes actualizar esta página en unos
              segundos — la confirmación puede tardar unos instantes en llegar.
            </p>
          ) : (
            <Button onClick={handlePay} isLoading={paymentStage === "opening"} className="mt-3">
              Pagar con Wompi
            </Button>
          )}
        </div>
      )}

      {order.paymentStatus === "DECLINED" && (
        <div className="mt-4">
          <Alert variant="error">Tu último intento de pago fue rechazado. Puedes intentarlo de nuevo.</Alert>
        </div>
      )}

      {order.status === "CANCELLED" && order.paymentStatus === "APPROVED" && (
        <div className="mt-4">
          <Alert variant="error">
            Tu pago fue aprobado pero este pedido se canceló porque el stock ya no alcanzaba. Nos pondremos en
            contacto contigo al <strong>{order.customerPhone}</strong> para procesar el reembolso.
          </Alert>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="border border-velvet-black/10 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Entrega</h2>
          <p className="mt-2 text-sm text-velvet-black">{SHIPPING_METHOD_LABELS[order.shippingMethod]}</p>
          {addr?.pickup ? (
            <p className="mt-1 text-sm text-velvet-ash">{String(addr.storeAddress ?? "")}</p>
          ) : (
            <p className="mt-1 text-sm text-velvet-ash">
              {addr?.addressLine}
              {addr?.complement ? `, ${addr.complement}` : ""}
              <br />
              {addr?.city}, {addr?.department}
            </p>
          )}
        </div>
        <div className="border border-velvet-black/10 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Contacto</h2>
          <p className="mt-2 text-sm text-velvet-black">
            {order.customerFirstName} {order.customerLastName}
          </p>
          <p className="text-sm text-velvet-ash">{order.customerEmail}</p>
          <p className="text-sm text-velvet-ash">{order.customerPhone}</p>
        </div>
      </div>

      <div className="mt-6 border border-velvet-black/10 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Productos</h2>
        <ul className="mt-3 divide-y divide-velvet-black/10">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="text-velvet-black">{item.productNameSnapshot}</p>
                <p className="mt-0.5 text-xs text-velvet-ash">
                  SKU {item.skuSnapshot} · {item.quantity} × {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <span className="text-velvet-black/90">{formatCurrency(item.subtotal)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-1 border-t border-velvet-black/10 pt-3 text-sm text-velvet-ash">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          {Number(order.discountTotal) > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Descuento</span>
              <span>-{formatCurrency(order.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Impuestos</span>
            <span>{formatCurrency(order.taxTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Envío</span>
            <span>{Number(order.shippingTotal) > 0 ? formatCurrency(order.shippingTotal) : "Gratis"}</span>
          </div>
        </div>
        <div className="mt-3 flex justify-between border-t border-velvet-black/10 pt-3 text-base font-semibold text-velvet-black">
          <span>Total</span>
          <span>{formatCurrency(order.total, order.currency)}</span>
        </div>
      </div>

      {order.shipments.length > 0 && (
        <div className="mt-6 border border-velvet-black/10 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Envío</h2>
          {order.shipments.map((s) => (
            <div key={s.id} className="mt-2 text-sm text-velvet-black">
              <p>
                Estado: <span className="font-semibold">{SHIPMENT_STATUS_LABELS[s.status] ?? s.status}</span>
              </p>
              {s.carrier && <p className="text-velvet-ash">Transportadora: {s.carrier}</p>}
              {s.trackingNumber && <p className="text-velvet-ash">N° de guía: {s.trackingNumber}</p>}
              {s.shippedAt && <p className="text-velvet-ash">Enviado el {formatDate(s.shippedAt)}</p>}
              {s.deliveredAt && <p className="text-velvet-ash">Entregado el {formatDate(s.deliveredAt)}</p>}
            </div>
          ))}
        </div>
      )}

      {user?.role === "ADMIN" && (
        <div className="mt-6 border border-velvet-burgundy/30 bg-velvet-burgundy/[0.05] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-label text-velvet-burgundy">Gestión admin del pedido</h2>
          {statusError && (
            <div className="mt-3">
              <Alert variant="error">{statusError}</Alert>
            </div>
          )}
          {ADMIN_TRANSITIONS[order.status].length === 0 ? (
            <p className="mt-3 text-sm text-velvet-ash">Este pedido está en un estado final y ya no admite cambios.</p>
          ) : (
            <form onSubmit={handleStatusChange} className="mt-3 space-y-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="order-next-status" className="text-xs font-semibold uppercase tracking-label text-velvet-ash">
                  Cambiar estado a
                </label>
                <select
                  id="order-next-status"
                  className="border border-velvet-black/30 bg-white px-3.5 py-2.5 text-sm text-velvet-black outline-none transition focus:border-velvet-black focus:ring-1 focus:ring-velvet-black/40"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as Order["status"])}
                  required
                >
                  <option value="" disabled>
                    Selecciona un estado
                  </option>
                  {ADMIN_TRANSITIONS[order.status].map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              {(nextStatus === "SHIPPED" || nextStatus === "DELIVERED") && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Transportadora" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
                  <Input label="Número de guía" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
                </div>
              )}
              {(nextStatus === "CANCELLED" || nextStatus === "REFUNDED") && order.paymentStatus === "APPROVED" && (
                <p className="text-xs text-amber-700">
                  Este pedido ya está pagado: al confirmar, el stock reservado se devolverá automáticamente al inventario.
                </p>
              )}
              <Button type="submit" isLoading={statusSaving} disabled={!nextStatus}>
                Confirmar cambio de estado
              </Button>
            </form>
          )}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link to="/orders" className="text-xs font-semibold uppercase tracking-label text-velvet-black/60 hover:text-velvet-black">
          Ver todos mis pedidos
        </Link>
      </div>
    </div>
  );
}
