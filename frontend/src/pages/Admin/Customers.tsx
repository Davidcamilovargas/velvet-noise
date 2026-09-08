import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCustomers, setCustomerStatus } from "../../services/customer.service";
import { getApiErrorMessage } from "../../services/api";
import type { CustomerSummary } from "../../types/api";
import { Input } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";
import { formatCurrency, formatDate } from "../../utils/format";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerSummary[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchCustomers(search || undefined)
      .then(setCustomers)
      .catch((err) => setError(getApiErrorMessage(err)));
  }

  useEffect(load, [search]);

  async function toggleStatus(c: CustomerSummary) {
    setError(null);
    try {
      await setCustomerStatus(c.id, !c.isActive);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-velvet-black">Clientes</h1>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="border border-velvet-black/10 bg-velvet-silk/40 p-4">
        <Input label="Buscar" placeholder="Nombre, correo o teléfono" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-x-auto border border-velvet-black/10 bg-velvet-silk/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-velvet-black/10 text-xs font-semibold uppercase tracking-label text-velvet-ash">
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Registrado</th>
              <th className="px-4 py-3 text-right">Pedidos pagados</th>
              <th className="px-4 py-3 text-right">Total gastado</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((c) => (
              <tr key={c.id} className="border-b border-velvet-black/10 last:border-0">
                <td className="px-4 py-3 font-medium text-velvet-black">
                  <Link to={`/admin/customers/${c.id}`} className="hover:text-velvet-burgundy hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-velvet-ash">{c.email}</td>
                <td className="px-4 py-3 text-velvet-ash">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-3 text-right text-velvet-black/80">{c.orderCount}</td>
                <td className="px-4 py-3 text-right font-medium text-velvet-black">{formatCurrency(c.totalSpent)}</td>
                <td className="px-4 py-3">
                  <span className={c.isActive ? "text-emerald-700" : "text-red-700"}>{c.isActive ? "Activo" : "Desactivado"}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggleStatus(c)} className="text-velvet-ash hover:text-velvet-black">
                    {c.isActive ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers?.length === 0 && <p className="p-6 text-center text-sm text-velvet-ash">No se encontraron clientes.</p>}
      </div>
    </div>
  );
}
