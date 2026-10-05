import { Link } from "react-router-dom";
import { useSEO } from "../hooks/useSEO";
import { STORE_CONTACT, whatsappLink } from "../config/store";

export default function Contact() {
  useSEO({ title: "Contacto", description: "Preguntas sobre tu pedido, una talla o un cambio. Escríbenos." });
  const wa = whatsappLink("Hola, tengo una pregunta.");

  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <h1 className="font-display text-4xl text-velvet-black">Contacto</h1>
      <p className="mt-4 text-velvet-black/80">
        Preguntas sobre un pedido, una talla o un cambio. Respondemos {STORE_CONTACT.hours.toLowerCase()}.
      </p>

      <div className="mt-10 space-y-3">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center bg-velvet-black px-8 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 active:scale-[0.98]"
          >
            Escribir por WhatsApp
          </a>
        )}
        {STORE_CONTACT.email && (
          <a
            href={`mailto:${STORE_CONTACT.email}`}
            className="flex w-full items-center justify-center border border-velvet-black/20 px-8 py-3.5 text-sm text-velvet-black transition-colors hover:border-velvet-black"
          >
            {STORE_CONTACT.email}
          </a>
        )}
      </div>

      <p className="mt-10 border-t border-velvet-black/10 pt-6 text-sm text-velvet-ash">
        Si es sobre un pedido, ten a mano el número que aparece en{" "}
        <Link to="/orders" className="text-velvet-black underline underline-offset-4">
          tus pedidos
        </Link>
        . Los cambios y devoluciones están explicados en{" "}
        <Link to="/politicas/envios" className="text-velvet-black underline underline-offset-4">
          esta página
        </Link>
        .
      </p>
    </div>
  );
}
