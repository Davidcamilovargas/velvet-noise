import { FormEvent, useEffect, useState } from "react";
import { fetchCoupons, createCoupon, updateCoupon, setCouponStatus, deleteCoupon } from "../../services/coupon.service";
import { getApiErrorMessage } from "../../services/api";
import type { Coupon } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";
import { formatCurrency, formatDate } from "../../utils/format";

function toLocalInput(iso: string): string {
  return iso.slice(0, 16);
}

const EMPTY_FORM = {
  code: "",
  discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
  percentage: "10",
  fixedAmount: "",
  startsAt: toLocalInput(new Date().toISOString()),
  expiresAt: toLocalInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
  maxUses: "",
  maxUsesPerUser: "1",
  minPurchase: "",
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetchCoupons()
      .then(setCoupons)
      .catch((err) => setError(getApiErrorMessage(err)));
  }

  useEffect(load, []);

  function startEdit(c: Coupon) {
    setEditingId(c.id);
    setForm({
      code: c.code,
      discountType: c.discountType,
      percentage: c.percentage ?? "10",
      fixedAmount: c.fixedAmount ?? "",
      startsAt: toLocalInput(c.startsAt),
      expiresAt: toLocalInput(c.expiresAt),
      maxUses: c.maxUses != null ? String(c.maxUses) : "",
      maxUsesPerUser: String(c.maxUsesPerUser),
      minPurchase: c.minPurchase ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        discountType: form.discountType,
        percentage: form.discountType === "PERCENTAGE" ? Number(form.percentage) : undefined,
        fixedAmount: form.discountType === "FIXED" ? Number(form.fixedAmount) : undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        expiresAt: new Date(form.expiresAt).toISOString(),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        maxUsesPerUser: Number(form.maxUsesPerUser),
        minPurchase: form.minPurchase ? Number(form.minPurchase) : null,
      };
      if (editingId) {
        await updateCoupon(editingId, payload);
      } else {
        await createCoupon({ ...payload, code: form.code });
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(c: Coupon) {
    try {
      await setCouponStatus(c.id, !c.isActive);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCoupon(id);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-velvet-black">Cupones</h1>
      {error && <Alert variant="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 border border-velvet-black/10 bg-velvet-silk/40 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Código" value={form.code} disabled={!!editingId} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required={!editingId} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="coupon-discount-type" className="text-xs font-semibold uppercase tracking-label text-velvet-ash">
            Tipo de descuento
          </label>
          <select
            id="coupon-discount-type"
            className="border border-velvet-black/30 bg-transparent px-3.5 py-2.5 text-sm text-velvet-black outline-none transition focus:border-velvet-black"
            value={form.discountType}
            onChange={(e) => setForm({ ...form, discountType: e.target.value as "PERCENTAGE" | "FIXED" })}
          >
            <option value="PERCENTAGE" className="bg-white">
              Porcentaje
            </option>
            <option value="FIXED" className="bg-white">
              Valor fijo
            </option>
          </select>
        </div>
        {form.discountType === "PERCENTAGE" ? (
          <Input label="Porcentaje (%)" type="number" min={1} max={100} value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} required />
        ) : (
          <Input label="Valor fijo (COP)" type="number" min={1} value={form.fixedAmount} onChange={(e) => setForm({ ...form, fixedAmount: e.target.value })} required />
        )}
        <Input label="Compra mínima (opcional)" type="number" min={0} value={form.minPurchase} onChange={(e) => setForm({ ...form, minPurchase: e.target.value })} />
        <Input label="Desde" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required />
        <Input label="Hasta" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} required />
        <Input label="Usos máximos totales (opcional)" type="number" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
        <Input label="Usos máximos por cliente" type="number" min={1} value={form.maxUsesPerUser} onChange={(e) => setForm({ ...form, maxUsesPerUser: e.target.value })} required />
        <div className="flex items-end gap-2 lg:col-span-4">
          <Button type="submit" isLoading={saving}>
            {editingId ? "Guardar cambios" : "Crear cupón"}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={cancelEdit}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto border border-velvet-black/10 bg-velvet-silk/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-velvet-black/10 text-xs font-semibold uppercase tracking-label text-velvet-ash">
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Descuento</th>
              <th className="px-4 py-3">Vigencia</th>
              <th className="px-4 py-3">Usos</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {coupons?.map((c) => (
              <tr key={c.id} className="border-b border-velvet-black/10 last:border-0">
                <td className="px-4 py-3 font-mono font-medium text-velvet-black">{c.code}</td>
                <td className="px-4 py-3 text-velvet-ash">
                  {c.discountType === "PERCENTAGE" ? `${Number(c.percentage)}%` : formatCurrency(c.fixedAmount ?? "0")}
                </td>
                <td className="px-4 py-3 text-velvet-ash">
                  {formatDate(c.startsAt)} — {formatDate(c.expiresAt)}
                </td>
                <td className="px-4 py-3 text-velvet-ash">{c.maxUses ?? "∞"} (máx. {c.maxUsesPerUser}/cliente)</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label ${
                      c.isActive ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-velvet-ash/40 bg-velvet-ash/10 text-velvet-ash"
                    }`}
                  >
                    {c.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(c)} className="mr-3 text-velvet-ash hover:text-velvet-black">
                    Editar
                  </button>
                  <button onClick={() => toggleStatus(c)} className="mr-3 text-velvet-ash hover:text-velvet-black">
                    {c.isActive ? "Desactivar" : "Activar"}
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-velvet-ash hover:text-velvet-burgundy">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons?.length === 0 && <p className="p-6 text-center text-sm text-velvet-ash">Todavía no hay cupones.</p>}
      </div>
    </div>
  );
}
