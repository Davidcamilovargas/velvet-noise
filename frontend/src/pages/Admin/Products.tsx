import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAdminProducts,
  createProduct,
  updateProduct,
  setProductStatus,
  deleteProduct,
  fetchCategories,
  uploadProductImages,
  uploadProductImagesZip,
  deleteProductImage,
  setPrimaryProductImage,
  reorderProductImages,
  uploadProduct360Frames,
  fetchProductByIdOrSlug,
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
};

// AGREGADO: orden con el que el admin quiere ver la lista de productos —
// además del filtro por categoría de abajo. Es puramente visual (se aplica
// sobre lo que ya llegó del backend), no cambia lo que se guarda en la
// base de datos.
type AdminSortOption = "name_asc" | "category" | "newest";

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // AGREGADO: filtrar la lista de admin por categoría, y elegir cómo
  // ordenarla (alfabético, por categoría, o más reciente primero) — el
  // admin pidió poder organizar el catálogo "como ellos lo quieran manejar".
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortOption, setSortOption] = useState<AdminSortOption>("category");
  const [form, setForm] = useState(EMPTY_FORM);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  function load() {
    fetchAdminProducts({ search: search || undefined, category: categoryFilter || undefined })
      .then((res) => setProducts(res.data))
      .catch((err) => setError(getApiErrorMessage(err)));
  }

  useEffect(load, [search, categoryFilter]);
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => setError(getApiErrorMessage(err)));
  }, []);

  const sortedProducts = useMemo(() => {
    if (!products) return null;
    const list = [...products];
    if (sortOption === "name_asc") {
      list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    } else if (sortOption === "category") {
      list.sort((a, b) => {
        const catCompare = (a.category?.name ?? "").localeCompare(b.category?.name ?? "", "es");
        return catCompare !== 0 ? catCompare : a.name.localeCompare(b.name, "es");
      });
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [products, sortOption]);

  function startCreate() {
    setEditingId(null);
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" });
    setVariants([]);
    setShowForm(true);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditingProduct(p);
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
        const updated = await updateProduct(editingId, {
          name: form.name,
          description: form.description,
          price: Number(form.price),
          compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
          categoryId: form.categoryId,
          isActive: form.isActive,
          isFeatured: form.isFeatured,
        });
        // Se mantiene el formulario abierto en modo edición (en vez de
        // cerrarlo) para que el admin pueda seguir subiendo/organizando
        // fotos justo después de guardar los datos del producto.
        setEditingProduct(updated);
        load();
      } else {
        const created = await createProduct({
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
          images: [],
          variants: variants.map((v) => ({
            color: v.color || undefined,
            size: v.size || undefined,
            stock: Number(v.stock),
          })),
        });
        // AGREGADO: en vez de cerrar el formulario, se pasa a modo edición
        // del producto recién creado — así el admin sube las fotos reales
        // en el mismo flujo, sin tener que buscar el producto de nuevo en
        // la tabla.
        setEditingId(created.id);
        setEditingProduct(created);
        load();
      }
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

      <div className="grid grid-cols-1 gap-3 border border-velvet-black/10 bg-velvet-silk/40 p-4 sm:grid-cols-3">
        <Input label="Buscar" placeholder="Nombre o descripción" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-category-filter" className="text-xs font-semibold uppercase tracking-label text-velvet-ash">
            Categoría
          </label>
          <select
            id="admin-category-filter"
            className="border border-velvet-black/30 bg-transparent px-3.5 py-2.5 text-sm text-velvet-black outline-none transition focus:border-velvet-black"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="" className="bg-white">
              Todas las categorías
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug} className="bg-white">
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-sort" className="text-xs font-semibold uppercase tracking-label text-velvet-ash">
            Ordenar por
          </label>
          <select
            id="admin-sort"
            className="border border-velvet-black/30 bg-transparent px-3.5 py-2.5 text-sm text-velvet-black outline-none transition focus:border-velvet-black"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as AdminSortOption)}
          >
            <option value="category" className="bg-white">
              Por categoría
            </option>
            <option value="name_asc" className="bg-white">
              Alfabético (A-Z)
            </option>
            <option value="newest" className="bg-white">
              Más recientes primero
            </option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-velvet-black/10 bg-velvet-silk/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-velvet-black/10 text-xs font-semibold uppercase tracking-label text-velvet-ash">
              <th className="px-4 py-3">Foto</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts?.map((p) => (
              <tr key={p.id} className="border-b border-velvet-black/10 last:border-0">
                <td className="px-4 py-3">
                  {p.images[0] ? (
                    <img src={p.images[0].url} alt="" className="h-10 w-10 object-cover" />
                  ) : (
                    <div className="h-10 w-10 border border-velvet-black/10 bg-velvet-ash/10" />
                  )}
                </td>
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
        {sortedProducts?.length === 0 && <p className="p-6 text-center text-sm text-velvet-ash">No se encontraron productos.</p>}
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

            {!editingId && (
              <p className="mt-4 text-xs text-velvet-ash">
                Guarda el producto primero — las fotos, gifs, videos y la vista 360° se suben justo después, en este mismo
                formulario.
              </p>
            )}

            {editingId && editingProduct && (
              <ProductMediaManager
                product={editingProduct}
                onChanged={(updated) => {
                  setEditingProduct(updated);
                  load();
                }}
                setError={setError}
              />
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cerrar
              </Button>
              {!editingId && (
                <Button type="submit" isLoading={saving}>
                  Crear producto
                </Button>
              )}
              {editingId && (
                <Button type="submit" isLoading={saving}>
                  Guardar cambios
                </Button>
              )}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AGREGADO: gestor de fotos/gifs/videos/vista 360° de un producto ya
// creado. Reemplaza el campo antiguo "Imagen principal (URL)" — ahora el
// admin sube el archivo real (foto por foto, varios de una vez, o un .zip)
// en vez de escribir un link, y el archivo real queda guardado en
// Cloudinary y referenciado en la base de datos.
// ---------------------------------------------------------------------------
function ProductMediaManager({
  product,
  onChanged,
  setError,
}: {
  product: Product;
  onChanged: (updated: Product) => void;
  setError: (msg: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploading360, setUploading360] = useState(false);
  // AGREGADO: antes de esto, subir fotos no mostraba ninguna confirmación
  // visible — la subida sí se guardaba en la base de datos, pero en
  // pantalla no cambiaba nada evidente y parecía que no había pasado
  // nada. Ahora se muestra un aviso verde explícito tras cada acción
  // (subir, borrar, marcar principal, reordenar), que desaparece solo a
  // los pocos segundos.
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const view360InputRef = useRef<HTMLInputElement>(null);

  function announceSuccess(message: string) {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage((current) => (current === message ? null : current)), 4000);
  }

  // Vuelve a pedir el producto completo (con la galería actualizada) al
  // backend después de cualquier cambio de fotos — más simple y confiable
  // que tratar de reconstruir el estado a mano en el frontend.
  async function refreshProduct() {
    const fresh = await fetchProductByIdOrSlug(product.id);
    onChanged(fresh);
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadProductImages(product.id, Array.from(files));
      await refreshProduct();
      announceSuccess(
        uploaded.length === 1 ? "1 foto subida y guardada correctamente." : `${uploaded.length} fotos subidas y guardadas correctamente.`
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setUploading(false);
      if (filesInputRef.current) filesInputRef.current.value = "";
    }
  }

  async function handleZipSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadProductImagesZip(product.id, files[0]);
      await refreshProduct();
      announceSuccess(`${uploaded.length} fotos del .zip subidas y guardadas correctamente.`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setUploading(false);
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  }

  async function handle360Selected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading360(true);
    try {
      // El orden en que el navegador entrega los archivos seleccionados es
      // el orden en que se guardan los frames de la vuelta 360° — por eso
      // conviene que el admin los nombre "01.jpg", "02.jpg", etc. antes de
      // seleccionarlos, para que el orden alfabético coincida con la vuelta
      // real del producto.
      const frames = await uploadProduct360Frames(product.id, Array.from(files));
      await refreshProduct();
      announceSuccess(`Vista 360° guardada con ${frames.length} frames.`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setUploading360(false);
      if (view360InputRef.current) view360InputRef.current.value = "";
    }
  }

  async function handleSetPrimary(imageId: string) {
    setError(null);
    try {
      await setPrimaryProductImage(product.id, imageId);
      await refreshProduct();
      announceSuccess("Foto principal actualizada.");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleDeleteImage(imageId: string) {
    setError(null);
    try {
      await deleteProductImage(product.id, imageId);
      await refreshProduct();
      announceSuccess("Foto eliminada correctamente.");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleMove(imageId: string, direction: -1 | 1) {
    const sorted = [...product.images].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((img) => img.id === imageId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setError(null);
    try {
      await reorderProductImages(product.id, reordered.map((img) => img.id));
      await refreshProduct();
      announceSuccess("Orden de las fotos actualizado.");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  const sortedImages = [...product.images].sort((a, b) => a.position - b.position);

  return (
    <div className="mt-6 border-t border-velvet-black/10 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Fotos, gifs y videos</h3>

      {successMessage && (
        <div className="mt-2">
          <Alert variant="success">{successMessage}</Alert>
        </div>
      )}

      {sortedImages.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {sortedImages.map((img, i) => (
            <div key={img.id} className="relative border border-velvet-black/10 p-1">
              {img.mediaType === "VIDEO" ? (
                <video src={img.url} className="h-24 w-full object-cover" muted />
              ) : (
                <img src={img.url} alt={img.altText ?? ""} className="h-24 w-full object-cover" />
              )}
              {img.isPrimary && (
                <span className="absolute left-1 top-1 bg-velvet-burgundy px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-label text-white">
                  Principal
                </span>
              )}
              <div className="mt-1 flex items-center justify-between gap-1 text-[10px]">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleMove(img.id, -1)}
                    disabled={i === 0}
                    className="text-velvet-ash hover:text-velvet-black disabled:opacity-30"
                    title="Mover antes"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(img.id, 1)}
                    disabled={i === sortedImages.length - 1}
                    className="text-velvet-ash hover:text-velvet-black disabled:opacity-30"
                    title="Mover después"
                  >
                    ↓
                  </button>
                </div>
                {!img.isPrimary && (
                  <button type="button" onClick={() => handleSetPrimary(img.id)} className="text-velvet-ash hover:text-velvet-black">
                    Marcar principal
                  </button>
                )}
                <button type="button" onClick={() => handleDeleteImage(img.id)} className="text-velvet-ash hover:text-velvet-burgundy">
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {sortedImages.length === 0 && <p className="mt-2 text-xs text-velvet-ash">Este producto todavía no tiene fotos.</p>}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer border border-velvet-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-label text-velvet-black hover:bg-velvet-silk/60">
          {uploading ? "Subiendo..." : "+ Subir fotos/gifs/videos"}
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </label>
        <label className="cursor-pointer border border-velvet-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-label text-velvet-black hover:bg-velvet-silk/60">
          {uploading ? "Subiendo..." : "+ Subir un .zip con varias fotos"}
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleZipSelected(e.target.files)}
          />
        </label>
      </div>

      <div className="mt-5 border-t border-velvet-black/10 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Vista 360° interactiva</h3>
        <p className="mt-1 text-xs text-velvet-ash">
          Sube todas las fotos de la vuelta completa del producto (24 a 72 fotos, tomadas girando el producto en el mismo
          sentido). El cliente podrá arrastrar la foto para "girarlo" en la ficha de producto.
          {product.view360Frames && product.view360Frames.length > 0 && (
            <> Actualmente hay {product.view360Frames.length} frames cargados; subir fotos nuevas reemplaza la vuelta completa.</>
          )}
        </p>
        <label className="mt-2 inline-block cursor-pointer border border-velvet-black/30 px-3 py-2 text-xs font-semibold uppercase tracking-label text-velvet-black hover:bg-velvet-silk/60">
          {uploading360 ? "Subiendo..." : "+ Subir frames de la vista 360°"}
          <input
            ref={view360InputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading360}
            onChange={(e) => handle360Selected(e.target.files)}
          />
        </label>
      </div>
    </div>
  );
}