import { useSEO } from "../hooks/useSEO";

export default function Contact() {
  useSEO({ title: "Contacto", description: "¿Tienes preguntas sobre tu pedido o un producto? Escríbenos." });
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-velvet-black">Contacto</h1>
      <p className="mt-3 text-velvet-ash">
        ¿Tienes preguntas sobre tu pedido o un producto? Escríbenos y te responderemos lo antes posible.
      </p>
      <div className="mt-8 space-y-2 border-y border-velvet-black/10 py-6 text-sm text-velvet-black/80">
        <p>hola@velvetnoise.co</p>
        <p>+57 300 000 0000</p>
        <p className="text-velvet-ash">Lunes a viernes, 8:00 a.m. – 6:00 p.m.</p>
      </div>
      <p className="mt-8 text-xs uppercase tracking-label text-velvet-ash">
        El formulario de contacto con envío real de correo se habilita junto con el módulo de notificaciones.
      </p>
    </div>
  );
}
