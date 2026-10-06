import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBackendCart } from "../services/cart.service";
import { listAddresses } from "../services/address.service";
import { fetchShippingMethods } from "../services/shipping.service";
import { createOrder } from "../services/order.service";
import { getApiErrorMessage } from "../services/api";
import type { Address, ShippingMethod, ShippingMethodOption } from "../types/api";
import { formatCurrency } from "../utils/format";
import { optimizedImage } from "../utils/image";
import { useCartStore } from "../store/cart.store";
import { useCart } from "../hooks/useCart";
import { useHeaderOffset } from "../hooks/useHeaderOffset";
import { Alert } from "../components/ui/Alert";
import { useSEO } from "../hooks/useSEO";
import "../styles/home.css";

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

// Para autocompletar el campo (se puede escribir otro valor igual).
const DEPARTMENTS = [
  "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare",
  "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta",
  "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander", "Sucre",
  "Tolima", "Valle del Cauca", "Vaupés", "Vichada",
];

function Field({
  id,
  label,
  hint,
  ...rest
}: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <input id={id} className="vn-input" {...rest} />
      {hint && <span className="text-xs text-velvet-ash">{hint}</span>}
    </div>
  );
}

function Steps({ current }: { current: 1 | 2 }) {
  const steps = ["Tus datos", "Envío", "Pago"];
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Pasos del checkout">
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "next";
        return (
          <li key={s} className={`flex items-center gap-2 ${state === "next" ? "text-velvet-ash" : ""}`} aria-current={state === "current" ? "step" : undefined}>
            <span className={`flex h-7 w-7 items-center justify-center text-xs font-bold ${state === "current" ? "bg-black text-velvet-silk" : "border border-current"}`}>
              {state === "done" ? "✓" : n}
            </span>
            <span className={state === "current" ? "font-semibold" : ""}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function Checkout() {
  useSEO({ title: "Checkout", noindex: true });
  const { user, isLoading } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  useHeaderOffset(rootRef);

  return (
    <div ref={rootRef} className="vn-home min-h-screen">
      <div className="flex flex-wrap items-end justify-between gap-6 px-[var(--gutter)] pb-6 pt-10">
        <h1 className="vn-wide text-[clamp(44px,8vw,112px)]">Checkout</h1>
        {!isLoading && <Steps current={user ? 2 : 1} />}
      </div>
      {isLoading ? (
        <p className="px-[var(--gutter)] py-16 text-velvet-ash">Cargando…</p>
      ) : user ? (
        // Sin sesión se piden primero los datos de contacto; al enviarlos se
        // abre una sesión y este mismo componente pasa al envío.
        <CheckoutForm />
      ) : (
        <GuestCheckoutStep />
      )}
    </div>
  );
}

/** Resumen del pedido con fotos, cupón (cuando ya hay sesión) y totales. */
function OrderSummary({ shippingCost, shippingKnown }: { shippingCost?: number; shippingKnown: boolean }) {
  const cart = useCart();
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const total = cart.subtotal - cart.discount + (shippingCost ?? 0);

  // No es un <form>: este resumen vive dentro del formulario del checkout.
  async function apply() {
    if (!code.trim()) return;
    setApplying(true);
    await cart.applyCoupon(code.trim().toUpperCase());
    setApplying(false);
    setCode("");
  }

  return (
    <aside className="border border-black p-5 lg:sticky lg:top-[calc(var(--hdr)+16px)] lg:self-start">
      <h2 className="vn-tag">Tu pedido</h2>
      <ul className="mt-4 divide-y divide-black/10">
        {cart.lines.map((l) => (
          <li key={l.key} className="flex gap-3 py-3">
            <div className="relative h-20 w-16 shrink-0 bg-[#e3dfd8]">
              {l.imageUrl && <img src={optimizedImage(l.imageUrl, 160)} alt="" className="h-full w-full object-cover" />}
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center bg-black px-1 text-[11px] font-bold text-velvet-silk">{l.quantity}</span>
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{l.name}</p>
              {l.variantLabel && <p className="text-velvet-ash">{l.variantLabel}</p>}
              {l.exceedsStock && <p className="text-red-700">Solo quedan {l.max}.</p>}
            </div>
            <span className="text-sm font-semibold">{formatCurrency(l.unitPrice * l.quantity)}</span>
          </li>
        ))}
      </ul>

      {!cart.isGuest &&
        (cart.couponCode ? (
          <div className="mt-3 flex items-center justify-between border border-black/15 px-3 py-2 text-sm">
            <span>
              Cupón <b>{cart.couponCode}</b>
              {cart.couponError && <span className="block text-red-700">{cart.couponError}</span>}
            </span>
            <button type="button" onClick={cart.removeCoupon} className="min-h-[44px] px-1 underline underline-offset-4">Quitar</button>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <label htmlFor="vn-co-coupon" className="sr-only">Código de cupón</label>
            <input
              id="vn-co-coupon"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  apply();
                }
              }}
              placeholder="Código de cupón"
              className="vn-input !min-h-[44px] flex-1 uppercase"
            />
            <button type="button" onClick={apply} className="min-h-[44px] border border-black px-4 text-sm font-semibold" disabled={applying}>
              {applying ? "…" : "Aplicar"}
            </button>
          </div>
        ))}
      {cart.error && <p className="mt-2 text-sm text-red-700">{cart.error}</p>}

      <div className="mt-4 space-y-1.5 border-t border-black/15 pt-4 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(cart.subtotal)}</span></div>
        {cart.discount > 0 && (
          <div className="flex justify-between"><span>Descuento</span><span>−{formatCurrency(cart.discount)}</span></div>
        )}
        <div className="flex justify-between">
          <span>Envío</span>
          <span>{!shippingKnown ? "En el siguiente paso" : shippingCost ? formatCurrency(shippingCost) : "Gratis"}</span>
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-black/15 pt-3">
        <span className="font-semibold">Total</span>
        <span className="text-2xl font-semibold">{formatCurrency(total)}</span>
      </div>
      <p className="text-xs text-velvet-ash">IVA incluido.</p>
    </aside>
  );
}

function GuestCheckoutStep() {
  const { guestCheckout } = useAuth();
  const lines = useCartStore((s) => s.lines);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailTaken(false);
    setIsSubmitting(true);
    try {
      await guestCheckout({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
    } catch (err) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
      setEmailTaken(code === "EMAIL_TAKEN");
      setError(getApiErrorMessage(err));
      setIsSubmitting(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="border-t border-black px-[var(--gutter)] py-12">
        <p className="vn-wide text-4xl">Tu carrito está vacío.</p>
        <p className="mt-2 text-velvet-ash">Agrega algo antes de pagar.</p>
        <Link to="/shop" className="vn-cta mt-6 flex max-w-xs items-center justify-center">Ver el catálogo</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 border-t border-black px-[var(--gutter)] pb-16 pt-8 lg:grid-cols-[1fr_400px]">
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <h2 className="vn-wide text-3xl">Tus datos</h2>
        <p className="mt-2 text-velvet-ash">No necesitas crear una cuenta. Usamos tu correo y teléfono solo para tu pedido.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="g-first" label="Nombre" required autoComplete="given-name" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
          <Field id="g-last" label="Apellido" required autoComplete="family-name" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
          <Field id="g-email" label="Correo electrónico" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Field id="g-phone" label="Teléfono" type="tel" required autoComplete="tel" inputMode="tel" placeholder="300 123 4567" hint="Para coordinar la entrega." value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>

        {error && (
          <div className="mt-4">
            <Alert variant="error">
              {error}
              {emailTaken && (
                <>
                  {" "}
                  <Link to="/login" state={{ from: "/checkout" }} className="font-semibold underline">Iniciar sesión</Link>
                </>
              )}
            </Alert>
          </div>
        )}

        <button type="submit" className="vn-cta sm:!w-auto sm:px-10" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Continuar con el envío"}
        </button>

        <p className="mt-6 border-t border-black/15 pt-4 text-sm text-velvet-ash">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" state={{ from: "/checkout" }} className="font-semibold text-black underline underline-offset-4">Inicia sesión</Link>
        </p>
      </form>

      <OrderSummary shippingKnown={false} />
    </div>
  );
}

function CheckoutForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const backendCart = useCartStore((s) => s.backendCart);
  const setBackendCart = useCartStore((s) => s.setBackendCart);

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
        setBackendCart(cartData);
        setAddresses(addressList);
        setShippingMethods(methods);
        const defaultAddress = addressList.find((a) => a.isDefault) ?? addressList[0];
        if (defaultAddress) setSelectedAddressId(defaultAddress.id);
        else setShowNewAddressForm(true);
      })
      .catch((err) => setLoadError(getApiErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [setBackendCart]);

  const shippingCost = shippingMethods.find((m) => m.method === shippingMethod)?.price ?? 0;
  const needsAddress = shippingMethod !== "PICKUP";
  const hasUsableAddress =
    !needsAddress ||
    !!selectedAddressId ||
    (showNewAddressForm && newAddress.department.trim() && newAddress.city.trim() && newAddress.addressLine.trim());

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!backendCart || backendCart.items.length === 0) return;
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
      // El pedido vació el carrito en el backend.
      setBackendCart({ ...backendCart, items: [], subtotal: 0, discountTotal: 0, total: 0, couponCode: null });
      navigate(`/orders/${order.id}`, { state: { justPlaced: true }, replace: true });
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <p className="border-t border-black px-[var(--gutter)] py-16 text-velvet-ash">Cargando checkout…</p>;

  if (loadError) {
    return (
      <div className="border-t border-black px-[var(--gutter)] py-12">
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }

  if (!backendCart || backendCart.items.length === 0) {
    return (
      <div className="border-t border-black px-[var(--gutter)] py-12">
        <p className="vn-wide text-4xl">Tu carrito está vacío.</p>
        <p className="mt-2 text-velvet-ash">Agrega algo antes de pagar.</p>
        <Link to="/shop" className="vn-cta mt-6 flex max-w-xs items-center justify-center">Ver el catálogo</Link>
      </div>
    );
  }

  const staleItem = backendCart.items.find((i) => i.exceedsStock);

  return (
    <form onSubmit={handleSubmit} className="grid gap-10 border-t border-black px-[var(--gutter)] pb-16 pt-8 lg:grid-cols-[1fr_400px]">
      <div className="max-w-2xl space-y-10">
        {staleItem && (
          <Alert variant="error">
            El stock de "{staleItem.productName}" cambió. <Link to="/cart" className="font-semibold underline">Ajusta tu carrito</Link> antes de continuar.
          </Alert>
        )}

        {/* MÉTODO DE ENVÍO */}
        <section>
          <h2 className="vn-wide text-3xl">Envío</h2>
          <fieldset className="mt-5">
            <legend className="sr-only">Método de envío</legend>
            <div className="grid gap-2">
              {shippingMethods.map((m) => (
                <label key={m.method} className={`vn-option${shippingMethod === m.method ? " is-on" : ""}`}>
                  <input type="radio" name="shippingMethod" checked={shippingMethod === m.method} onChange={() => setShippingMethod(m.method)} className="h-5 w-5 accent-black" />
                  <span className="flex-1">{m.label}</span>
                  <span className="font-semibold">{m.price > 0 ? formatCurrency(m.price) : "Gratis"}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {!needsAddress && <p className="mt-3 text-sm text-velvet-ash">Te escribimos cuando tu pedido esté listo para recoger en Bogotá.</p>}
        </section>

        {/* DIRECCIÓN */}
        {needsAddress && (
          <section>
            <h3 className="text-lg font-bold [font-stretch:112%]">Dirección de entrega</h3>
            {addresses.length > 0 && !showNewAddressForm && (
              <div className="mt-4 grid gap-2">
                {addresses.map((a) => (
                  <label key={a.id} className={`vn-option !items-start${selectedAddressId === a.id ? " is-on" : ""}`}>
                    <input type="radio" name="addressId" className="mt-1 h-5 w-5 accent-black" checked={selectedAddressId === a.id} onChange={() => setSelectedAddressId(a.id)} />
                    <span className="flex-1 text-sm">
                      <b>{a.label}</b>
                      <br />
                      {a.addressLine}
                      {a.complement ? `, ${a.complement}` : ""}, {a.city}, {a.department}
                    </span>
                  </label>
                ))}
                <button type="button" onClick={() => setShowNewAddressForm(true)} className="min-h-[44px] justify-self-start text-sm underline underline-offset-4">
                  Usar otra dirección
                </button>
              </div>
            )}

            {(addresses.length === 0 || showNewAddressForm) && (
              <div className="mt-4 grid gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field id="a-dep" label="Departamento" list="vn-departments" autoComplete="address-level1" value={newAddress.department} onChange={(e) => setNewAddress((s) => ({ ...s, department: e.target.value }))} />
                  <Field id="a-city" label="Ciudad o municipio" autoComplete="address-level2" value={newAddress.city} onChange={(e) => setNewAddress((s) => ({ ...s, city: e.target.value }))} />
                </div>
                <datalist id="vn-departments">
                  {DEPARTMENTS.map((d) => <option key={d} value={d} />)}
                </datalist>
                <Field id="a-line" label="Dirección" autoComplete="street-address" placeholder="Cra 1 # 2-3" value={newAddress.addressLine} onChange={(e) => setNewAddress((s) => ({ ...s, addressLine: e.target.value }))} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field id="a-comp" label="Apto, torre o indicaciones (opcional)" value={newAddress.complement} onChange={(e) => setNewAddress((s) => ({ ...s, complement: e.target.value }))} />
                  <Field id="a-zip" label="Código postal (opcional)" autoComplete="postal-code" inputMode="numeric" value={newAddress.postalCode} onChange={(e) => setNewAddress((s) => ({ ...s, postalCode: e.target.value }))} />
                </div>
                <label className="flex min-h-[44px] items-center gap-3 text-sm">
                  <input type="checkbox" checked={newAddress.saveAddress} onChange={(e) => setNewAddress((s) => ({ ...s, saveAddress: e.target.checked }))} className="h-5 w-5 accent-black" />
                  Guardar esta dirección para la próxima compra
                </label>
                {addresses.length > 0 && (
                  <button type="button" onClick={() => setShowNewAddressForm(false)} className="min-h-[44px] justify-self-start text-sm underline underline-offset-4">
                    Usar una dirección guardada
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* CONTACTO */}
        <section>
          <h3 className="text-lg font-bold [font-stretch:112%]">Contacto</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="c-phone" label="Teléfono" type="tel" inputMode="tel" autoComplete="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="300 123 4567" />
            <Field id="c-notes" label="Notas para la entrega (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Portería, horario…" />
          </div>
        </section>

        {submitError && <Alert variant="error">{submitError}</Alert>}

        <div>
          <button type="submit" className="vn-cta sm:!w-auto sm:px-12" disabled={isSubmitting || !!staleItem}>
            {isSubmitting ? "Confirmando…" : "Confirmar pedido"}
          </button>
          <p className="mt-3 max-w-md text-sm text-velvet-ash">
            Después de confirmar pagas con Wompi: tarjeta de crédito o débito, PSE o Nequi.
          </p>
        </div>
      </div>

      <OrderSummary shippingCost={shippingCost} shippingKnown />
    </form>
  );
}
