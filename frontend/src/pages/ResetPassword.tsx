import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { resetPasswordRequest } from "../services/auth.service";
import { getApiErrorMessage } from "../services/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setIsLoading(true);
    try {
      await resetPasswordRequest(token, password);
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <Alert variant="error">Enlace inválido.</Alert>
        <Link to="/forgot-password" className="mt-4 inline-block font-semibold text-velvet-black hover:underline">
          Solicitar uno nuevo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="flex justify-center">
        <img src="/brand/logo-isotipo-black.png" alt="" aria-hidden className="h-10 w-auto" />
      </div>

      <div className="mt-8 border border-velvet-black/10 px-6 py-8 sm:px-10">
        <h1 className="font-display text-2xl text-velvet-black">Nueva contraseña</h1>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Input
            label="Nueva contraseña"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="text-xs text-velvet-ash">
            Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número.
          </p>
          <Button type="submit" variant="primary" isLoading={isLoading} className="w-full">
            Restablecer contraseña
          </Button>
        </form>
      </div>
    </div>
  );
}
