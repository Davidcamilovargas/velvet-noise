import { FormEvent, useEffect, useState } from "react";
import {
  fetchAdminProducts,
  createProduct,
  updateProduct,
  setProductStatus,
  deleteProduct,
  fetchCategories,
} from "../../services/product.service";
import { getApiErrorMessage } from "../../services/api";
import type { Category, Product } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";
import { formatCurrency } from "../../utils/format";

interface VariantRow {
  color: string;
  size: string;
  stock: string;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  compareAtPrice: "",
  sku: "",
  categoryId: "",
  isActive: true,
  isFeatured: false,
  minStock: "5",
  stock: "0",
  imageUrl: "",
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  function load() {
    fetchAdminProducts({ search: search || undefined })
      .then((res) => setProducts(res.data))
      .catch((err) => setError(getApiErrorMessage(err)));
  }

  useEffect(load, [search]);
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => setError(getApiErrorMessage(err)));
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" });
    setVariants([]);
    setShowForm(true);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description,
      price: p.price,
      compareAtPrice: p.compareAtPrice ?? "",
      sku: p.sku,
      categoryId: p.categoryId,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      minStock: "5",
      stock: "0",
      imageUrl: p.images[0]?.url ?? "",
    });
    setVariants([]);
    setShowForm(true);
  }

  function addVariantRow() {
    setVariants((prev) => [...prev, { color: "", size: "", stock: "0" }]);
  }

  function updateVariantRow(index: number, field: keyof VariantRow, value: string) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }

  function removeVariantRow(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editingId) {
        await updateProduct(editingId, {
          name: form.name,
          description: form.description,
          price: Number(form.price),
          compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
          categoryId: form.categoryId,
          isActive: form.isActive,
          isFeatured: form.isFeatured,
        });
      } else {
        await createProduct({
          name: form.name,
          description: form.description,
          price: Number(form.price),
          compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
          sku: form.sku || undefined,
          categoryId: form.categoryId,
          isActive: form.isActive,
          isFeatured: form.isFeatured,
          minStock: Number(form.minStock),
          stock: variants.length === 0 ? Number(form.stock) : undefined,
          images: form.imageUrl ? [{ url: form.imageUrl, isPrimary: true }] : [],
          variants: variants.map((v) => ({
            color: v.color || undefined,
            size: v.size || undefined,
            stock: Number(v.stock),
          })),
        });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(p: Product) {
    try {
      await setProductStatus(p.id, !p.isActive);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleDelete(p: Product) {
    try {
      await deleteProduct(p.id);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-velvet-black">Productos</h1>
        <Button onClick={startCreate}>Nuevo producto</Button>
      </div>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="border border-velvet-black/10 bg-velvet-silk/40 p-4">
        <Input label="Buscar" placeholder="Nombre o descripción" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-x-auto border border-velvet-black/10 bg-velvet-silk/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-velvet-black/10 text-xs font-semibold uppercase tracking-label text-velvet-ash">
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products?.map((p) => (
              <tr key={p.id} className="border-b border-velvet-black/10 last:border-0">
                <td className="px-4 py-3 font-medium text-velvet-black">{p.name}</td>
                <td className="px-4 py-3 text-velvet-ash">{p.category?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right text-velvet-black/90">{formatCurrency(p.price)}</td>
                <td className="px-4 py-3 text-right text-velvet-black/90">{p.stock}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label ${
                      p.isActive ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-velvet-ash/40 bg-velvet-ash/10 text-velvet-ash"
                    }`}
                  >
                    {p.isActive ? "Activo" : "Inactivo"}
                  </span>
                  {p.isFeatured && (
                    <span className="ml-2 inline-block border border-velvet-burgundy/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-velvet-burgundy">
                      Destacado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(p)} className="mr-3 text-velvet-ash hover:text-velvet-black">
                    Editar
                  </button>
                  <button onClick={() => toggleStatus(p)} className="mr-3 text-velvet-ash hover:text-velvet-black">
                    {p.isActive ? "Desactivar" : "Activar"}
                  </button>
                  <button onClick={() => handleDelete(p)} className="text-velvet-ash hover:text-velvet-burgundy">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products?.length === 0 && <p className="p-6 text-center text-sm text-velvet-ash">No se encontraron productos.</p>}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-velvet-black/80 px-4 py-10">
          <div className="w-full max-w-2xl border border-velvet-black/10 bg-white p-6">
            <h2 className="font-display text-lg text-velvet-black">{editingId ? "Editar producto" : "Nuevo producto"}</h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="sm:col-span-2" />
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="product-description" className="text-xs font-semibold uppercase tracking-label text-velvet-ash">
                  Descripción
                </label>
                <textarea
                  id="product-description"
                  className="border border-velvet-black/30 bg-transparent px-3.5 py-2.5 text-sm text-velvet-black outline-none transition focus:border-velvet-black focus:ring-1 focus:ring-velvet-black/40"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>
              <Input label="Precio (COP)" type="number" min={1} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              <Input label="Precio antes de descuento (opcional)" type="number" min={1} value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
              {!editingId && <Input label="SKU (opcional, se genera solo)" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="product-category" className="text-xs font-semibold uppercase tracking-label text-velvet-ash">
                  Categoría
                </label>
                <select
                  id="product-category"
                  className="border border-velvet-black/30 bg-transparent px-3.5 py-2.5 text-sm text-velvet-black outline-none transition focus:border-velvet-black"
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  required
                >
                  <option value="" disabled className="bg-white">
                    Selecciona una categoría
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input label="Imagen principal (URL)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="sm:col-span-2" />
              {!editingId && (
                <>
                  <Input label="Stock mínimo (alerta)" type="number" min={0} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
                  {variants.length === 0 && (
                    <Input label="Stock inicial" type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                  )}
                </>
              )}
              <label className="flex items-center gap-2 text-sm text-velvet-ash">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Activo
              </label>
              <label className="flex items-center gap-2 text-sm text-velvet-ash">
                <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
                Destacado en el inicio
              </label>
            </div>

            {!editingId && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Variantes (color/talla)</h3>
                  <button type="button" onClick={addVariantRow} className="text-sm text-velvet-burgundy hover:text-velvet-black">
                    + Agregar variante
                  </button>
                </div>
                <p className="mt-1 text-xs text-velvet-ash">
                  Déjalo vacío para un producto sin variantes (usa el stock inicial de arriba). Si agregas variantes, cada una
                  necesita su propio stock.
                </p>
                {variants.map((v, i) => (
                  <div key={i} className="mt-2 grid grid-cols-4 items-end gap-2">
                    <Input label="Color" value={v.color} onChange={(e) => updateVariantRow(i, "color", e.target.value)} />
                    <Input label="Talla" value={v.size} onChange={(e) => updateVariantRow(i, "size", e.target.value)} />
                    <Input label="Stock" type="number" min={0} value={v.stock} onChange={(e) => updateVariantRow(i, "stock", e.target.value)} required />
                    <Button type="button" variant="ghost" onClick={() => removeVariantRow(i)}>
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {editingId && (
              <p className="mt-4 text-xs text-velvet-ash">
                El stock y las variantes se administran desde la sección Inventario una vez creado el producto.
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={saving}>
                {editingId ? "Guardar cambios" : "Crear producto"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
