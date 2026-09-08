import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-velvet-black/10 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <img src="/brand/logo-isotipo-black.png" alt="Velvet Noise" className="h-9 w-auto" />
          <p className="mt-4 max-w-[22ch] text-sm leading-relaxed text-velvet-ash">
            Ruido por fuera. Terciopelo por dentro.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-label text-velvet-black">Tienda</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-velvet-ash">
            <li><Link to="/shop" className="transition hover:text-velvet-black">Catálogo</Link></li>
            <li><Link to="/shop?onSale=true" className="transition hover:text-velvet-black">Ofertas</Link></li>
            <li><Link to="/contacto" className="transition hover:text-velvet-black">Contacto</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-label text-velvet-black">Políticas</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-velvet-ash">
            <li><Link to="/politicas/terminos" className="transition hover:text-velvet-black">Términos y condiciones</Link></li>
            <li><Link to="/politicas/privacidad" className="transition hover:text-velvet-black">Política de privacidad</Link></li>
            <li><Link to="/politicas/envios" className="transition hover:text-velvet-black">Información de envíos</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-label text-velvet-black">Pago</h4>
          <p className="mt-4 text-sm text-velvet-ash">PSE · Tarjetas de crédito y débito · Nequi (vía Wompi)</p>
        </div>
      </div>
      <div className="border-t border-velvet-black/10 py-5 text-center text-[11px] uppercase tracking-label text-velvet-ash">
        © {new Date().getFullYear()} Velvet Noise · Bogotá
      </div>
    </footer>
  );
}
