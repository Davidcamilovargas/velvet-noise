import { useEffect, useState } from "react";
import { fetchAuditLogs } from "../../services/auditLog.service";
import { getApiErrorMessage } from "../../services/api";
import type { AuditLogEntry } from "../../types/api";
import { Alert } from "../../components/ui/Alert";
import { formatDate } from "../../utils/format";

const RESOURCES = ["", "order", "product", "category", "coupon", "customer", "inventory", "review", "store_settings"];

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [resource, setResource] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditLogs(resource || undefined)
      .then(setLogs)
      .catch((err) => setError(getApiErrorMessage(err)));
  }, [resource]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-velvet-black">Auditoría</h1>
      <p className="text-sm text-velvet-ash">
        Registro de acciones administrativas sensibles (crear/editar/borrar recursos, cambios de estado de pedidos, ajustes de
        inventario) — cada una queda asociada al administrador que la realizó y no se puede editar ni borrar desde aquí.
      </p>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="border border-velvet-black/10 bg-velvet-silk/40 p-4">
        <label htmlFor="audit-resource-filter" className="text-xs font-semibold uppercase tracking-label text-velvet-ash">
          Filtrar por recurso
        </label>
        <select
          id="audit-resource-filter"
          className="mt-1 block border border-velvet-black/30 bg-transparent px-3.5 py-2 text-sm text-velvet-black outline-none focus:border-velvet-black"
          value={resource}
          onChange={(e) => setResource(e.target.value)}
        >
          {RESOURCES.map((r) => (
            <option key={r} value={r} className="bg-white">
              {r || "Todos"}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto border border-velvet-black/10 bg-velvet-silk/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-velvet-black/10 text-xs font-semibold uppercase tracking-label text-velvet-ash">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Acción</th>
              <th className="px-4 py-3">Recurso</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map((l) => (
              <tr key={l.id} className="border-b border-velvet-black/10 last:border-0 align-top">
                <td className="whitespace-nowrap px-4 py-3 text-velvet-ash">{formatDate(l.createdAt)}</td>
                <td className="px-4 py-3 text-velvet-black">{l.adminEmail ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-velvet-black">{l.action}</td>
                <td className="px-4 py-3 text-velvet-ash">
                  {l.resource}
                  {l.resourceId && <span className="text-velvet-ash/70"> · {l.resourceId.slice(0, 8)}</span>}
                </td>
                <td className="px-4 py-3 text-velvet-ash/70">{l.ipAddress ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs?.length === 0 && <p className="p-6 text-center text-sm text-velvet-ash">Todavía no hay registros de auditoría.</p>}
      </div>
    </div>
  );
}
