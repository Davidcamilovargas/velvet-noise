import { Link } from "react-router-dom";
import { useSEO } from "../hooks/useSEO";

export default function NotFound() {
  useSEO({ title: "Página no encontrada", noindex: true });
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-white px-4 text-center">
      <span className="font-display text-7xl text-velvet-black">404</span>
      <p className="mt-3 text-sm text-velvet-ash">No encontramos la página que buscas.</p>
      {/* Es un enlace de navegación, no una acción — se estiliza como el CTA
          primario de Home.tsx en vez de anidar <Button> dentro de <Link>. */}
      <Link
        to="/"
        className="mt-8 inline-flex items-center justify-center bg-velvet-black px-8 py-3.5 text-xs font-semibold uppercase tracking-label text-white transition hover:opacity-85"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
