import { useEffect, useState } from "react";
import { fetchAdminReviews, setReviewStatus, deleteReview } from "../../services/review.service";
import { getApiErrorMessage } from "../../services/api";
import type { AdminReview } from "../../types/api";
import { Alert } from "../../components/ui/Alert";
import { formatDate } from "../../utils/format";

type StatusFilter = "pending" | "approved" | "all";

export default function AdminReviews() {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchAdminReviews(status)
      .then(setReviews)
      .catch((err) => setError(getApiErrorMessage(err)));
  }

  useEffect(load, [status]);

  async function approve(id: string) {
    try {
      await setReviewStatus(id, true);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function reject(id: string) {
    try {
      await setReviewStatus(id, false);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function remove(id: string) {
    try {
      await deleteReview(id);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-velvet-black">Reseñas</h1>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex gap-2 text-sm">
        {(["pending", "approved", "all"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`border px-4 py-1.5 text-xs font-semibold uppercase tracking-label ${status === s ? "border-velvet-burgundy text-velvet-black" : "border-velvet-black/30 text-velvet-ash hover:border-velvet-black/60 hover:text-velvet-black"}`}
          >
            {s === "pending" ? "Pendientes" : s === "approved" ? "Aprobadas" : "Todas"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {reviews?.map((r) => (
          <div key={r.id} className="border border-velvet-black/10 bg-velvet-silk/40 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-velvet-black">{r.productName}</p>
                <p className="text-xs text-velvet-ash">
                  {r.customerFirstName} {r.customerLastName} · {r.customerEmail} · {formatDate(r.createdAt)}
                </p>
                <p className="mt-1 text-amber-500" aria-label={`${r.rating} de 5 estrellas`}>
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </p>
                <p className="mt-2 text-sm text-velvet-black/80">{r.comment}</p>
              </div>
              <span
                className={`shrink-0 border px-3 py-1 text-xs font-semibold uppercase tracking-label ${
                  r.isApproved ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-amber-500 bg-amber-50 text-amber-700"
                }`}
              >
                {r.isApproved ? "Aprobada" : "Pendiente"}
              </span>
            </div>
            <div className="mt-3 flex gap-4 text-sm">
              {!r.isApproved && (
                <button onClick={() => approve(r.id)} className="text-velvet-ash hover:text-emerald-700">
                  Aprobar
                </button>
              )}
              {r.isApproved && (
                <button onClick={() => reject(r.id)} className="text-velvet-ash hover:text-amber-700">
                  Quitar aprobación
                </button>
              )}
              <button onClick={() => remove(r.id)} className="text-velvet-ash hover:text-velvet-burgundy">
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {reviews?.length === 0 && <p className="p-6 text-center text-sm text-velvet-ash">No hay reseñas en esta vista.</p>}
      </div>
    </div>
  );
}
