import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listAddresses, deleteAddress } from "../services/address.service";
import { getApiErrorMessage } from "../services/api";
import type { Address } from "../types/api";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { useSEO } from "../hooks/useSEO";

export default function Profile() {
  useSEO({ title: "Mi perfil", noindex: true });
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listAddresses()
      .then(setAddresses)
      .catch((err) => setAddressError(getApiErrorMessage(err)));
  }, [user]);

  if (!user) return null; // ProtectedRoute ya garantiza que hay usuario

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function handleDeleteAddress(id: string) {
    try {
      await deleteAddress(id);
      setAddresses((prev) => prev?.filter((a) => a.id !== id) ?? null);
    } catch (err) {
      setAddressError(getApiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl text-velvet-black">Mi perfil</h1>

      <div className="mt-6 border border-velvet-black/10 p-6">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Nombre</dt>
            <dd className="mt-1.5 text-sm text-velvet-black">
              {user.firstName} {user.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Correo electrónico</dt>
            <dd className="mt-1.5 text-sm text-velvet-black">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Teléfono</dt>
            <dd className="mt-1.5 text-sm text-velvet-black">{user.phone ?? "No registrado"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Tipo de cuenta</dt>
            <dd className="mt-1.5 text-sm text-velvet-black">{user.role === "ADMIN" ? "Administrador" : "Cliente"}</dd>
          </div>
        </dl>

        <Button variant="secondary" onClick={handleLogout} className="mt-6">
          Cerrar sesión
        </Button>
      </div>

      <div className="mt-6 border border-velvet-black/10 p-6">
        <h2 className="text-xs font-semibold uppercase tracking-label text-velvet-ash">Direcciones guardadas</h2>
        {addressError && (
          <div className="mt-3">
            <Alert variant="error">{addressError}</Alert>
          </div>
        )}
        {addresses === null ? (
          <p className="mt-3 text-sm text-velvet-ash">Cargando…</p>
        ) : addresses.length === 0 ? (
          <p className="mt-3 text-sm text-velvet-ash">
            Todavía no tienes direcciones guardadas. Se agregan automáticamente al hacer checkout.
          </p>
        ) : (
          <ul className="mt-3 space-y-px bg-velvet-black/10">
            {addresses.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 bg-white px-4 py-3 text-sm">
                <span>
                  <span className="text-velvet-black">{a.label}</span>
                  {a.isDefault && (
                    <span className="ml-2 border border-velvet-burgundy/50 px-2 py-0.5 text-[11px] uppercase tracking-label text-velvet-burgundy">
                      Predeterminada
                    </span>
                  )}
                  <br />
                  <span className="text-velvet-ash">
                    {a.addressLine}
                    {a.complement ? `, ${a.complement}` : ""}, {a.city}, {a.department}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  onClick={() => handleDeleteAddress(a.id)}
                  className="!px-0 !py-0 shrink-0 !text-velvet-ash hover:!text-red-600"
                >
                  Eliminar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
