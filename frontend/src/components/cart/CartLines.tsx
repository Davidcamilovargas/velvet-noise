import { Link } from "react-router-dom";
import type { CartViewLine } from "../../hooks/useCart";
import { formatCurrency } from "../../utils/format";
import { optimizedImage } from "../../utils/image";

export function QtyStepper({ value, max, onChange, label }: { value: number; max: number; onChange: (q: number) => void; label: string }) {
  return (
    <div className="vn-qty !h-10" role="group" aria-label={`Cantidad de ${label}`}>
      <button className="!h-10 !w-10" aria-label="Menos" disabled={value <= 1} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{value}</output>
      <button className="!h-10 !w-10" aria-label="Más" disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

/** Líneas del carrito: foto, nombre, variante, cantidad, quitar y subtotal. */
export function CartLines({
  lines,
  onQuantity,
  onRemove,
  onNavigate,
  large = false,
}: {
  lines: CartViewLine[];
  onQuantity: (line: CartViewLine, q: number) => void;
  onRemove: (line: CartViewLine) => void;
  onNavigate?: () => void;
  large?: boolean;
}) {
  return (
    <ul className="divide-y divide-black/15">
      {lines.map((l) => (
        <li key={l.key} className="flex gap-4 py-4">
          <Link to={`/product/${l.slug}`} onClick={onNavigate} className={`shrink-0 overflow-hidden bg-[#e3dfd8] ${large ? "h-36 w-28" : "h-28 w-[88px]"}`}>
            {l.imageUrl && <img src={optimizedImage(l.imageUrl, 240)} alt={l.name} loading="lazy" className="h-full w-full object-cover" />}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/product/${l.slug}`} onClick={onNavigate} className="font-bold [font-stretch:110%] hover:underline">
                  {l.name}
                </Link>
                {l.variantLabel && <p className="text-sm text-velvet-ash">{l.variantLabel}</p>}
              </div>
              <span className="shrink-0 font-semibold">{formatCurrency(l.unitPrice * l.quantity)}</span>
            </div>
            {l.quantity > 1 && <p className="text-xs text-velvet-ash">{formatCurrency(l.unitPrice)} c/u</p>}
            {l.exceedsStock && <p className="mt-1 text-sm text-red-700">Solo quedan {l.max}. Ajusta la cantidad.</p>}
            <div className="mt-auto flex items-center justify-between pt-3">
              <QtyStepper value={l.quantity} max={l.max} label={l.name} onChange={(q) => onQuantity(l, q)} />
              <button onClick={() => onRemove(l)} className="min-h-[44px] px-1 text-sm underline underline-offset-4 hover:text-velvet-burgundy">
                Quitar
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Lo que se sabe del envío antes de pagar (precios reales, sin inventar umbrales). */
export function ShippingNote() {
  return (
    <p className="text-sm text-velvet-ash">
      Envío desde $12.000 o <b className="font-semibold text-black">recoge gratis en Bogotá</b>. Lo eliges al pagar.
    </p>
  );
}
