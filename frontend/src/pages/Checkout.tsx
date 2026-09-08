import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBackendCart, type BackendCart } from "../services/cart.service";
import { listAddresses } from "../services/address.service";
import { fetchShippingMethods } from "../services/shipping.service";
import { createOrder } from "../services/order.service";
import { getApiErrorMessage } from "../services/api";
import type { Address, ShippingMethod, ShippingMethodOption } from "../types/api";
import { formatCurrency } from "../utils/format";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { Link } from "react-router-dom";
import { useSEO } from "../hooks/useSEO";

interface NewAddressForm {
  label: string;
  department: string;
  city: string;
  addressLine: string;
  complement: string;
  postalCode: string;
  saveAddress: boolean;
}

const EMPTY_NEW_ADDRESS: NewAddressForm = {
  label: "Casa",
  department: "",
  city: "",
  addressLine: "",
  complement: "",
  postalCode: "",
  saveAddress: true,
};

const SECTION_TITLE_CLASSES = "text-xs font-semibold uppercase tracking-label text-velvet-ash";

export default function Checkout() {
  useSEO({ title: "Checkout", noindex: true });
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cart, setCart] = useState<BackendCart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethodOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("STANDARD");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<NewAddressForm>(EMPTY_NEW_ADDRESS);
  const [customerPhone, setCustomerPhone] = useState(user?.phone ?? "");
  const [notes, setNotes] = useState("");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getBackendCart(), listAddresses(), fetchShippingMethods()])
      .then(([cartData, addressList, methods]) => {
        setCart(cartData);
        setAddresses(addressList);
        setShippingMethods(methods);
        const defaultAddress = addressList.find((a) => a.isDefault) ?? addressList[0];
        if (defaultAddress) setSelectedAddressId(defaultAddress.id);
        else setShowNewAddressForm(true);
      })
      .catch((err) => setLoadError(getApiErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  const shippingCost = shippingMethods.find((m) => m.method === shippingMethod)?.price ?? 0;
  const subtotal = cart?.subtotal ?? 0;
  const discountTotal = cart?.discountTotal ?? 0;
  const taxTotal = cart?.taxTotal ?? 0;
  const estimatedTotal = subtotal - discountTotal + taxTotal + shippingCost;

  const needsAddress = shippingMethod !== "PICKUP";
  const hasUsableAddress =
    !needsAddress ||
    !!selectedAddressId ||
    (showNewAddressForm && newAddress.department.trim() && newAddress.city.trim() && newAddress.addressLine.trim());

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cart || cart.items.length === 0) return;
    setSubmitError(null);

    if (!customerPhone.trim()) {
      setSubmitError("Ingresa un teléfono de contacto.");
      return;
    }
    if (needsAddress && !hasUsableAddress) {
      setSubmitError("Selecciona o agrega una dirección de envío.");
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await createOrder({
        shippingMethod,
        customerPhone: customerPhone.trim(),
        notes: notes.trim() || undefined,
        addressId: needsAddress && !showNewAddressForm ? selectedAddressId ?? undefined : undefined,
        newAddress:
          needsAddress && showNewAddressForm
            ? {
                label: newAddress.label.trim() || "Casa",
                department: newAddress.department.trim(),
                city: newAddress.city.trim(),
                addressLine: newAddress.addressLine.trim(),
                complement: newAddress.complement.trim() || undefined,
                postalCode: newAddress.postalCode.trim() || undefined,
                saveAddress: newAddress.saveAddress,
              }
            : undefined,
      });
      navigate(`/orders/${order.id}`, { state: { justPlaced: true }, replace: true });
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-velvet-ash">Cargando checkout…</div>;
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState title="Tu carrito está vacío" description="Agrega productos antes de continuar al checkout." />
        <div className="mt-6 text-center">
          <Link to="/shop" className="text-sm text-velvet-black/70 transition hover:text-velvet-black">
            Ir a la tienda
          </Link>
        </div>
      </div>
    );
  }

  const staleItem = cart.items.find((i) => i.exceedsStock);
  if (staleItem) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Alert variant="error">
          El stock de "{staleItem.productName}" cambió. Vuelve al carrito para ajustar la cantidad antes de continuar.
        </Alert>
        <div className="mt-6 text-center">
          <Link to="/cart" className="text-sm text-velvet-black/70 transition hover:text-velvet-black">
            Volver al carrito
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl text-velvet-black">Checkout</h1>

      <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* MÉTODO DE ENVÍO */}
          <section className="border border-velvet-black/10 p-6">
            <h2 className={SECTION_TITLE_CLASSES}>Método de envío</h2>
            <div className="mt-4 space-y-2">
              {shippingMethods.map((m) => (
                <label
                  key={m.method}
                  className={`flex cursor-pointer items-center justify-between border px-4 py-3 text-sm transition ${
                    shippingMethod === m.method ? "border-velvet-black bg-velvet-silk/40" : "border-velvet-black/15"
                  }`}
                >
                  <span className="flex items-center gap-3 text-velvet-black/90">
                    <input
                      type="radio"
                      name="shippingMethod"
                      checked={shippingMethod === m.method}
                      onChange={() => setShippingMethod(m.method)}
                      className="accent-velvet-black"
                    />
                    {m.label}
                  </span>
                  <span className="font-medium text-velvet-black">{m.price > 0 ? formatCurrency(m.price) : "Gratis"}</span>
                </label>
              ))}
            </div>
          </section>

          {/* DIRECCIÓN */}
          {needsAddress && (
            <section className="border border-velvet-black/10 p-6">
              <h2 className={SECTION_TITLE_CLASSES}>Dirección de envío</h2>

              {addresses.length > 0 && !showNewAddressForm && (
                <div className="mt-4 space-y-2">
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer items-start gap-3 border px-4 py-3 text-sm transition ${
                        selectedAddressId === a.id ? "border-velvet-black bg-velvet-silk/40" : "border-velvet-black/15"
                      }`}
                    >
                      <input
                        type="radio"
                        name="addressId"
                        className="mt-1 accent-velvet-black"
                        checked={selectedAddressId === a.id}
                        onChange={() => setSelectedAddressId(a.id)}
                      />
                      <span className="text-velvet-black/80">
                        <span className="font-medium text-velvet-black">{a.label}</span>
                        <br />
                        {a.addressLine}
                        {a.complement ? `, ${a.complement}` : ""}, {a.city}, {a.department}
                      </span>
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowNewAddressForm(true)}
                    className="text-xs font-semibold uppercase tracking-label text-velvet-black/60 transition hover:text-velvet-black"
                  >
                    + Usar una dirección nueva
                  </button>
                </div>
              )}

              {(addresses.length === 0 || showNewAddressForm) && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Nombre de la dirección"
                      value={newAddress.label}
                      onChange={(e) => setNewAddress((s) => ({ ...s, label: e.target.value }))}
                      placeholder="Casa, Oficina..."
                    />
                    <Input
                      label="Departamento"
                      value={newAddress.department}
                      onChange={(e) => setNewAddress((s) => ({ ...s, department: e.target.value }))}
                    />
                    <Input
                      label="Ciudad"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress((s) => ({ ...s, city: e.target.value }))}
                    />
                    <Input
                      label="Código postal (opcional)"
                      value={newAddress.postalCode}
                      onChange={(e) => setNewAddress((s) => ({ ...s, postalCode: e.target.value }))}
                    />
                  </div>
                  <Input
                    label="Dirección"
                    value={newAddress.addressLine}
                    onChange={(e) => setNewAddress((s) => ({ ...s, addressLine: e.target.value }))}
                    placeholder="Cra 1 # 2-3"
                  />
                  <Input
                    label="Complemento (opcional)"
                    value={newAddress.complement}
                    onChange={(e) => setNewAddress((s) => ({ ...s, complement: e.target.value }))}
                    placeholder="Apto, torre, indicaciones..."
                  />
                  <label className="flex items-center gap-2.5 text-sm text-velvet-black/80">
                    <input
                      type="checkbox"
                      checked={newAddress.saveAddress}
                      onChange={(e) => setNewAddress((s) => ({ ...s, saveAddress: e.target.checked }))}
                      className="h-4 w-4 border-velvet-black/30 bg-transparent accent-velvet-black"
                    />
                    Guardar esta dirección para futuras compras
                  </label>
                  {addresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowNewAddressForm(false)}
                      className="text-xs font-semibold uppercase tracking-label text-velvet-ash transition hover:text-velvet-black"
                    >
                      Usar una dirección guardada
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* CONTACTO */}
          <section className="border border-velvet-black/10 p-6">
            <h2 className={SECTION_TITLE_CLASSES}>Contacto</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Teléfono" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="300 123 4567" />
              <Input
                label="Notas del pedido (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Indicaciones para la entrega..."
              />
            </div>
          </section>
        </div>

        {/* RESUMEN */}
        <div>
          <div className="sticky top-24 border border-velvet-black/10 bg-velvet-silk/40 p-6">
            <h2 className={SECTION_TITLE_CLASSES}>Resumen del pedido</h2>
            <ul className="mt-4 space-y-2 text-sm text-velvet-black/80">
              {cart.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span className="line-clamp-1">
                    {item.quantity}× {item.productName}
                  </span>
                  <span className="shrink-0">{formatCurrency(item.subtotal)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-1 border-t border-velvet-black/10 pt-3 text-sm text-velvet-black/70">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Descuento{cart.couponCode ? ` (${cart.couponCode})` : ""}</span>
                  <span>-{formatCurrency(discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Impuestos</span>
                <span>{formatCurrency(taxTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Envío</span>
                <span>{shippingCost > 0 ? formatCurrency(shippingCost) : "Gratis"}</span>
              </div>
            </div>

            <div className="mt-3 flex justify-between border-t border-velvet-black/10 pt-3 text-base font-semibold text-velvet-black">
              <span>Total</span>
              <span>{formatCurrency(estimatedTotal)}</span>
            </div>

            {submitError && (
              <div className="mt-4">
                <Alert variant="error">{submitError}</Alert>
              </div>
            )}

            <Button type="submit" isLoading={isSubmitting} className="mt-5 w-full">
              Confirmar pedido
            </Button>
            <p className="mt-2 text-center text-xs text-velvet-ash">
              Tu pedido quedará registrado pendiente de pago. Coordinaremos el pago contigo.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
