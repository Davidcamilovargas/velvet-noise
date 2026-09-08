import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { forgotPasswordRequest } from "../services/auth.service";
import { getApiErrorMessage } from "../services/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const msg = await forgotPasswordRequest(email);
      setMessage(msg);
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
        <h1 className="font-display text-2xl text-velvet-black">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-velvet-ash">
          Ingresa tu correo y, si tienes una cuenta, te enviaremos un enlace para restablecer tu contraseña.
        </p>

        {message ? (
          <div className="mt-6">
            <Alert variant="success">{message}</Alert>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            {error && <Alert variant="error">{error}</Alert>}
            <Input label="Correo electrónico" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" variant="primary" isLoading={isLoading} className="w-full">
              Enviar enlace de recuperación
            </Button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-velvet-ash">
        <Link to="/login" className="font-semibold text-velvet-black hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
