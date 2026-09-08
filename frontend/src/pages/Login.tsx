import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../services/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";
import { useSEO } from "../hooks/useSEO";

export default function Login() {
  useSEO({ title: "Iniciar sesión" });
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
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
        <h1 className="font-display text-2xl text-velvet-black">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-velvet-ash">Ingresa a tu cuenta para ver tus pedidos y continuar comprando.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Input
            label="Correo electrónico"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            label="Contraseña"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <div className="flex items-center justify-end text-sm">
            <Link to="/forgot-password" className="text-velvet-ash transition hover:text-velvet-black">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Button type="submit" variant="primary" isLoading={isLoading} className="w-full">
            Iniciar sesión
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-velvet-ash">
        ¿No tienes cuenta?{" "}
        <Link to="/register" className="font-semibold text-velvet-black hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
