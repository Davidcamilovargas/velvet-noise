import { useEffect, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { fetchShippingMethods } from "../services/shipping.service";
import type { ShippingMethodOption } from "../types/api";
import { formatCurrency } from "../utils/format";
import { STORE_CONTACT, whatsappLink } from "../config/store";
import { useSEO } from "../hooks/useSEO";
import NotFound from "./NotFound";

/**
 * Políticas de la tienda. El texto se apoya en la Ley 1480 de 2011
 * (Estatuto del Consumidor) y la Ley 1581 de 2012 (datos personales).
 * Es una base razonable, no asesoría legal: revisarlo con un abogado o
 * contador antes de crecer en ventas.
 */
const POLICIES = {
  envios: { title: "Envíos, cambios y devoluciones", Body: ShippingPolicy },
  terminos: { title: "Términos y condiciones", Body: TermsPolicy },
  privacidad: { title: "Política de privacidad", Body: PrivacyPolicy },
} as const;

type PolicySlug = keyof typeof POLICIES;

export default function Policy() {
  const { slug } = useParams<{ slug: string }>();
  const policy = slug && slug in POLICIES ? POLICIES[slug as PolicySlug] : null;
  useSEO({ title: policy?.title });

  if (!policy) return <NotFound />;
  const { title, Body } = policy;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-[200px_1fr]">
        <nav aria-label="Políticas" className="flex gap-4 overflow-x-auto text-sm md:flex-col md:gap-3">
          {(Object.keys(POLICIES) as PolicySlug[]).map((key) => (
            <NavLink
              key={key}
              to={`/politicas/${key}`}
              className={({ isActive }) =>
                `shrink-0 transition ${isActive ? "text-velvet-black underline decoration-velvet-burgundy underline-offset-4" : "text-velvet-ash hover:text-velvet-black"}`
              }
            >
              {POLICIES[key].title}
            </NavLink>
          ))}
        </nav>

        <article className="max-w-[68ch]">
          <h1 className="font-display text-3xl text-velvet-black sm:text-4xl">{title}</h1>
          <div className="policy-body mt-8 space-y-4 text-[15px] leading-relaxed text-velvet-black/80">
            <Body />
          </div>
          <ContactLine />
        </article>
      </div>
    </div>
  );
}

function ContactLine() {
  const wa = whatsappLink("Hola, tengo una pregunta sobre las políticas de la tienda.");
  if (!STORE_CONTACT.email && !wa) return null;
  return (
    <p className="mt-10 border-t border-velvet-black/10 pt-6 text-sm text-velvet-ash">
      ¿Dudas? Escríbenos
      {STORE_CONTACT.email && (
        <>
          {" "}a{" "}
          <a href={`mailto:${STORE_CONTACT.email}`} className="text-velvet-black underline underline-offset-4">
            {STORE_CONTACT.email}
          </a>
        </>
      )}
      {wa && (
        <>
          {STORE_CONTACT.email ? " o por " : " por "}
          <a href={wa} target="_blank" rel="noreferrer" className="text-velvet-black underline underline-offset-4">
            WhatsApp
          </a>
        </>
      )}
      .
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-6 font-display text-xl text-velvet-black">{children}</h2>;
}

function ShippingPolicy() {
  const [methods, setMethods] = useState<ShippingMethodOption[] | null>(null);

  useEffect(() => {
    fetchShippingMethods()
      .then(setMethods)
      .catch(() => setMethods([]));
  }, []);

  return (
    <>
      <p>Enviamos a todo Colombia. El costo del envío se ve antes de confirmar el pedido.</p>

      <H2>Opciones de envío</H2>
      {methods === null ? (
        <p className="text-velvet-ash">Cargando opciones…</p>
      ) : methods.length > 0 ? (
        <ul className="divide-y divide-velvet-black/10 border-y border-velvet-black/10">
          {methods.map((m) => (
            <li key={m.method} className="flex justify-between gap-4 py-3">
              <span>{m.label}</span>
              <span className="shrink-0 text-velvet-black">{m.price > 0 ? formatCurrency(m.price) : "Gratis"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Las opciones y precios de envío se muestran en el checkout.</p>
      )}
      <p>
        Cuando el pedido sale, te enviamos la transportadora y el número de guía. Puedes seguir el estado en{" "}
        <Link to="/orders" className="underline underline-offset-4">
          tus pedidos
        </Link>
        .
      </p>

      <H2>Cambios de talla</H2>
      <p>
        Si la talla no te queda, escríbenos antes de usar o lavar la prenda. La prenda debe volver con sus etiquetas y en
        el mismo estado en que llegó. Te ayudamos a cambiarla por otra talla o por otra prenda, según disponibilidad.
      </p>

      <H2>Derecho de retracto</H2>
      <p>
        Como compraste en línea, tienes 5 días hábiles desde que recibes el pedido para arrepentirte de la compra, sin
        dar explicaciones (Ley 1480 de 2011, artículo 47). La prenda debe volver sin uso y con sus etiquetas. El costo
        del envío de vuelta corre por tu cuenta, y te devolvemos el dinero pagado dentro de los 30 días calendario
        siguientes.
      </p>

      <H2>Garantía</H2>
      <p>
        Si una prenda llega con un defecto de fabricación, escríbenos con una foto. La reparamos, la cambiamos o te
        devolvemos el dinero, como establece la garantía legal de la Ley 1480 de 2011. La garantía no cubre el desgaste
        normal ni daños por lavado o uso distinto a las indicaciones de cuidado.
      </p>

      <H2>Reversión del pago</H2>
      <p>
        Si pagaste con tarjeta u otro medio electrónico y el pedido no llegó, no corresponde a lo que pediste, llegó
        defectuoso, o no reconoces el cobro, puedes pedir la reversión del pago (Ley 1480 de 2011, artículo 51). Avísanos
        dentro de los 5 días hábiles siguientes a que te enteres y presenta también la solicitud ante el banco o entidad
        emisora.
      </p>
    </>
  );
}

function TermsPolicy() {
  return (
    <>
      <p>
        Estos términos aplican a las compras en esta tienda en línea de Velvet Noise. Al hacer un pedido, los aceptas.
      </p>

      <H2>Precios y pago</H2>
      <p>
        Los precios están en pesos colombianos (COP) e incluyen el IVA. El valor total, con el envío, se muestra antes
        de confirmar el pedido. Los pagos se procesan con Wompi (tarjeta de crédito o débito, PSE y Nequi). No guardamos
        los datos de tu tarjeta.
      </p>

      <H2>Disponibilidad</H2>
      <p>
        La prenda queda separada para ti cuando se aprueba el pago. Si se agota antes de que el pago se apruebe, te
        avisamos y te devolvemos el dinero completo.
      </p>

      <H2>Pedidos sin cuenta</H2>
      <p>
        Puedes comprar solo con tu nombre, correo y teléfono. Con eso queda creada una cuenta a tu nombre para que
        puedas ver el pedido. Si quieres entrar después, usa{" "}
        <Link to="/forgot-password" className="underline underline-offset-4">
          ¿Olvidaste tu contraseña?
        </Link>{" "}
        con el mismo correo.
      </p>

      <H2>Cambios, retracto y garantía</H2>
      <p>
        Están en{" "}
        <Link to="/politicas/envios" className="underline underline-offset-4">
          Envíos, cambios y devoluciones
        </Link>
        .
      </p>

      <H2>Reclamos</H2>
      <p>
        Si algo no salió bien, escríbenos primero y lo resolvemos directamente. También puedes acudir a la
        Superintendencia de Industria y Comercio (www.sic.gov.co).
      </p>
    </>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <p>
        Velvet Noise trata tus datos personales según la Ley 1581 de 2012. Aquí explicamos qué guardamos, para qué y
        cómo puedes pedir que lo cambiemos o lo borremos.
      </p>

      <H2>Qué datos guardamos</H2>
      <p>
        Nombre, correo, teléfono, direcciones de envío y el historial de tus pedidos. Los datos de la tarjeta no pasan
        por nosotros: los recibe directamente Wompi.
      </p>

      <H2>Para qué los usamos</H2>
      <p>
        Para preparar y enviar tus pedidos, avisarte del estado de cada uno, atender cambios y garantías, y cumplir
        obligaciones contables. Solo te enviamos novedades de la marca si lo aceptas.
      </p>

      <H2>Con quién los compartimos</H2>
      <p>
        Con la transportadora que entrega el pedido (nombre, teléfono y dirección) y con Wompi para procesar el pago.
        No vendemos ni cedemos tus datos.
      </p>

      <H2>Tus derechos</H2>
      <p>
        Puedes conocer, actualizar y corregir tus datos, pedir que los borremos y retirar la autorización para usarlos.
        Escríbenos y respondemos dentro de los plazos de ley: 10 días hábiles para consultas y 15 días hábiles para
        reclamos.
      </p>
    </>
  );
}
