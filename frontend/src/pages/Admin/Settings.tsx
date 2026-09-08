import { FormEvent, useEffect, useState } from "react";
import { fetchStoreSettings, updateStoreSettings } from "../../services/settings.service";
import { getApiErrorMessage } from "../../services/api";
import type { StoreSettings } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";

type ShippingKey = "STANDARD" | "EXPRESS" | "PICKUP";
const SHIPPING_LABELS: Record<ShippingKey, string> = { STANDARD: "Estándar", EXPRESS: "Express", PICKUP: "Recoger en tienda" };

export default function AdminSettings() {
  const [form, setForm] = useState<{
    storeName: string;
    logoUrl: string;
    contactEmail: string;
    contactPhone: string;
    address: string;
    currency: string;
    taxPercentage: string;
    shippingPrices: Record<ShippingKey, string>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStoreSettings()
      .then((s: StoreSettings) =>
        setForm({
          storeName: s.storeName,
          logoUrl: s.logoUrl ?? "",
          contactEmail: s.contactEmail ?? "",
          contactPhone: s.contactPhone ?? "",
          address: s.address ?? "",
          currency: s.currency,
          taxPercentage: String(Number(s.taxPercentage)),
          shippingPrices: {
            STANDARD: s.shippingMethods?.STANDARD?.price != null ? String(s.shippingMethods.STANDARD.price) : "",
            EXPRESS: s.shippingMethods?.EXPRESS?.price != null ? String(s.shippingMethods.EXPRESS.price) : "",
            PICKUP: s.shippingMethods?.PICKUP?.price != null ? String(s.shippingMethods.PICKUP.price) : "",
          },
        })
      )
      .catch((err) => setError(getApiErrorMessage(err)));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const shippingMethods: Record<string, { price: number }> = {};
      (Object.keys(form.shippingPrices) as ShippingKey[]).forEach((key) => {
        if (form.shippingPrices[key] !== "") shippingMethods[key] = { price: Number(form.shippingPrices[key]) };
      });
      await updateStoreSettings({
        storeName: form.storeName,
        logoUrl: form.logoUrl || undefined,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        address: form.address || undefined,
        currency: form.currency,
        taxPercentage: Number(form.taxPercentage),
        shippingMethods: Object.keys(shippingMethods).length > 0 ? shippingMethods : undefined,
      });
      setSuccess("Configuración guardada. Los nuevos pedidos y carritos ya usan estos valores.");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!form) return error ? <Alert variant="error">{error}</Alert> : <div className="py-16 text-center text-velvet-ash">Cargando…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-2xl text-velvet-black">Configuración de la tienda</h1>
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 border border-velvet-black/10 bg-velvet-silk/40 p-6 sm:grid-cols-2">
          <Input label="Nombre de la tienda" value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} required />
          <Input label="Logo (URL)" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
          <Input label="Correo de contacto" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          <Input label="Teléfono de contacto" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
          <Input label="Dirección (recogida en tienda)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="sm:col-span-2" />
          <Input label="Moneda (ISO 4217)" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} required />
          <Input label="IVA (%)" type="number" min={0} max={100} value={form.taxPercentage} onChange={(e) => setForm({ ...form, taxPercentage: e.target.value })} required />
        </div>

        <div className="border border-velvet-black/10 bg-velvet-silk/40 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Tarifas de envío</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(Object.keys(SHIPPING_LABELS) as ShippingKey[]).map((key) => (
              <Input
                key={key}
                label={`${SHIPPING_LABELS[key]} (COP)`}
                type="number"
                min={0}
                value={form.shippingPrices[key]}
                onChange={(e) => setForm({ ...form, shippingPrices: { ...form.shippingPrices, [key]: e.target.value } })}
                placeholder="Usar valor por defecto"
              />
            ))}
          </div>
        </div>

        <Button type="submit" isLoading={saving}>
          Guardar configuración
        </Button>
      </form>
    </div>
  );
}
