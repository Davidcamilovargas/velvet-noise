import { FormEvent, useEffect, useState } from "react";
import { fetchAdminCategories, createCategory, updateCategory, deleteCategory } from "../../services/category.service";
import { getApiErrorMessage } from "../../services/api";
import type { Category } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";

const EMPTY_FORM = { name: "", description: "", imageUrl: "", isActive: true };

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetchAdminCategories()
      .then(setCategories)
      .catch((err) => setError(getApiErrorMessage(err)));
  }

  useEffect(load, []);

  function startEdit(category: Category) {
    setEditingId(category.id);
    setForm({ name: category.name, description: category.description ?? "", imageUrl: category.imageUrl ?? "", isActive: category.isActive });
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
        name: form.name,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        isActive: form.isActive,
      };
      if (editingId) {
        await updateCategory(editingId, payload);
      } else {
        await createCategory(payload);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteCategory(id);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-velvet-black">Categorías</h1>
      {error && <Alert variant="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 border border-velvet-black/10 bg-velvet-silk/40 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <Input label="Imagen (URL)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
        <Input label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="sm:col-span-2 lg:col-span-2" />
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-velvet-ash">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          Activa
        </label>
        <div className="flex items-end gap-2 lg:col-span-4">
          <Button type="submit" isLoading={saving}>
            {editingId ? "Guardar cambios" : "Crear categoría"}
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
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories?.map((c) => (
              <tr key={c.id} className="border-b border-velvet-black/10 last:border-0">
                <td className="px-4 py-3 font-medium text-velvet-black">{c.name}</td>
                <td className="px-4 py-3 text-velvet-ash">{c.slug}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label ${
                      c.isActive ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-velvet-ash/40 bg-velvet-ash/10 text-velvet-ash"
                    }`}
                  >
                    {c.isActive ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(c)} className="mr-3 text-velvet-ash hover:text-velvet-black">
                    Editar
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-velvet-ash hover:text-velvet-burgundy">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories?.length === 0 && <p className="p-6 text-center text-sm text-velvet-ash">Todavía no hay categorías.</p>}
      </div>
    </div>
  );
}
