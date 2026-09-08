import { FormEvent, useEffect, useState } from "react";
import { fetchInventory, adjustInventory } from "../../services/inventory.service";
import { getApiErrorMessage } from "../../services/api";
import type { InventoryItem } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";
import { formatDate } from "../../utils/format";

export default function AdminInventory() {
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetchInventory({ search: search || undefined, lowStockOnly: lowStockOnly || undefined })
      .then(setItems)
      .catch((err) => setError(getApiErrorMessage(err)));
  }

  useEffect(load, [search, lowStockOnly]);

  function startAdjust(id: string) {
    setAdjustingId(id);
    setDelta("");
    setReason("");
    setError(null);
  }

  async function handleAdjust(e: FormEvent) {
    e.preventDefault();
    if (!adjustingId) return;
    setError(null);
    setSaving(true);
    try {
      await adjustInventory(adjustingId, Number(delta), reason);
      setAdjustingId(null);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-velvet-black">Inventario</h1>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-wrap items-end gap-3 border border-velvet-black/10 bg-velvet-silk/40 p-4">
        <Input label="Buscar" placeholder="Producto o SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 pb-2.5 text-sm text-velvet-black/80">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Solo stock bajo
        </label>
      </div>

      <div className="overflow-x-auto border border-velvet-black/10 bg-velvet-silk/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-velvet-black/10 text-xs font-semibold uppercase tracking-label text-velvet-ash">
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Variante</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Mínimo</th>
              <th className="px-4 py-3">Actualizado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item) => (
              <tr key={item.id} className="border-b border-velvet-black/10 last:border-0">
                <td className="px-4 py-3 font-medium text-velvet-black">{item.productName}</td>
                <td className="px-4 py-3 text-velvet-ash">{item.variantLabel ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-velvet-ash">{item.variantSku ?? item.productSku}</td>
                <td className={`px-4 py-3 text-right font-semibold ${item.stock <= item.minStock ? "text-amber-600" : "text-velvet-black"}`}>{item.stock}</td>
                <td className="px-4 py-3 text-right text-velvet-ash">{item.minStock}</td>
                <td className="px-4 py-3 text-velvet-ash">{formatDate(item.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startAdjust(item.id)} className="text-velvet-ash hover:text-velvet-black">
                    Ajustar stock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items?.length === 0 && <p className="p-6 text-center text-sm text-velvet-ash">No se encontró inventario con esos filtros.</p>}
      </div>

      {adjustingId && (
        <form onSubmit={handleAdjust} className="fixed inset-0 z-20 flex items-center justify-center bg-velvet-black/70 px-4">
          <div className="w-full max-w-sm border border-velvet-black/10 bg-white p-6">
            <h2 className="font-display text-lg text-velvet-black">Ajustar stock</h2>
            <p className="mt-1 text-sm text-velvet-ash">
              Usa un número positivo para reponer stock (ej. llegó mercancía) o negativo para retirarlo (ej. producto dañado).
            </p>
            <div className="mt-4 space-y-3">
              <Input label="Cantidad (+/-)" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} required />
              <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAdjustingId(null)}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={saving}>
                Confirmar ajuste
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
