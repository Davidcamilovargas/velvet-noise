import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../services/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";
import { useSEO } from "../hooks/useSEO";

export default function Register() {
  useSEO({ title: "Crear cuenta" });
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await register({ ...form, phone: form.phone || undefined });
      navigate("/", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="flex justify-center">
        <img src="/brand/logo-isotipo-black.png" alt="" aria-hidden className="h-10 w-auto" />
      </div>

      <div className="mt-8 border border-velvet-black/10 px-6 py-8 sm:px-10">
        <h1 className="font-display text-2xl text-velvet-black">Crear cuenta</h1>
        <p className="mt-1 text-sm text-velvet-ash">Regístrate para comprar, guardar direcciones y ver tus pedidos.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre" required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
            <Input label="Apellido" required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
          </div>
          <Input
            label="Correo electrónico"
            type="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            autoComplete="email"
          />
          <Input label="Teléfono (opcional)" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          <Input
            label="Contraseña"
            type="password"
            required
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            autoComplete="new-password"
          />
          <p className="text-xs text-velvet-ash">
            Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número.
          </p>
          <Button type="submit" variant="primary" isLoading={isLoading} className="w-full">
            Crear cuenta
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-velvet-ash">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="font-semibold text-velvet-black hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
