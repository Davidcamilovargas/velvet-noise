import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../../types/api";
import { useAddToCart } from "../../hooks/useAddToCart";
import { formatCurrency } from "../../utils/format";
import { optimizedImage } from "../../utils/image";
import { whatsappLink } from "../../config/store";
import { COLOR_SWATCH, colorsOf, findVariant, sizesOf } from "../../utils/variants";

/**
 * Vista rápida: panel lateral en escritorio, hoja desde abajo en celular.
 * Orden fijo — color, talla y solo después cantidad — y el botón no se
 * activa hasta que hay una variante real con stock.
 */
export function QuickView({
  product,
  onClose,
  onAdded,
}: {
  product: Product | null;
  onClose: () => void;
  onAdded: (message: string) => void;
}) {
  const open = !!product;
  const addToCart = useAddToCart();
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState<Product | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Se conserva el último producto mientras el panel se cierra, para que la
  // animación de salida no muestre un panel vacío.
  useEffect(() => {
    if (!product) return;
    returnFocus.current = document.activeElement as HTMLElement;
    setShown(product);
    const colors = colorsOf(product);
    const firstColor = colors.find((c) => sizesOf(product, c).some((s) => s.inStock)) ?? colors[0] ?? null;
    setColor(firstColor);
    const sizes = sizesOf(product, firstColor);
    setSize(sizes.length === 1 && sizes[0].inStock ? sizes[0].size : null);
    setQty(1);
    setError(null);
    requestAnimationFrame(() => closeRef.current?.focus());
  }, [product]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      returnFocus.current?.focus();
    };
  }, [open, onClose]);

  const p = shown;
  const colors = useMemo(() => (p ? colorsOf(p) : []), [p]);
  const sizes = useMemo(() => (p ? sizesOf(p, color) : []), [p, color]);
  const needsSize = sizes.length > 0;
  const variant = p ? findVariant(p, color, needsSize ? size : null) : undefined;
  const stock = variant?.stock ?? 0;
  const canAdd = !!variant && stock > 0;
  const price = variant?.priceOverride ?? p?.price ?? "0";

  async function handleAdd() {
    if (!p || !canAdd) return;
    setSaving(true);
    const result = await addToCart(p, variant, qty);
    setSaving(false);
    if (result.ok) {
      onAdded(`${p.name}${size ? ` · talla ${size}` : ""} — en tu carrito`);
      onClose();
    } else setError(result.message);
  }

  const wa = p ? whatsappLink(`Hola, tengo una pregunta sobre ${p.name}${size ? ` talla ${size}` : ""}.`) : null;
  let step = 0;

  return (
    <div className={`vn-qv${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="vn-scrim" onClick={onClose} />
      <div className="vn-sheet" role="dialog" aria-modal="true" aria-labelledby="vn-qv-name">
        <div className="vn-grab" />
        <div className="flex justify-end">
          <button ref={closeRef} onClick={onClose} className="min-h-[44px] px-2 text-sm font-semibold">
            Cerrar
          </button>
        </div>
        {p && (
          <>
            <div className="vn-gal">
              {p.images
                .filter((i) => i.mediaType !== "VIDEO")
                .map((img) => (
                  <img key={img.id} src={optimizedImage(img.url, 900)} alt={img.altText ?? p.name} />
                ))}
            </div>
            <h3 id="vn-qv-name" className="vn-wide mt-4 text-[clamp(28px,4vw,40px)]">{p.name}</h3>
            <p className="mt-2 text-lg font-semibold">
              {formatCurrency(price)}
              {p.compareAtPrice && <s className="ml-2 text-sm font-normal text-velvet-ash">{formatCurrency(p.compareAtPrice)}</s>}
            </p>
            <p className="mt-2 text-sm text-velvet-ash">{p.description}</p>

            {colors.length > 0 && (
              <div className="vn-step">
                <span className="vn-tag">{++step} · Color</span>
                <div className="vn-opts" role="group" aria-label="Color">
                  {colors.map((c) => (
                    <button
                      key={c}
                      aria-pressed={c === color}
                      onClick={() => {
                        setColor(c);
                        setSize(null);
                        setQty(1);
                      }}
                    >
                      <span className="vn-sw" style={{ background: COLOR_SWATCH[c] ?? "#B9B4AE" }} />
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {needsSize && (
              <div className="vn-step">
                <span className="vn-tag">{++step} · Talla</span>
                <div className="vn-opts" role="group" aria-label="Talla">
                  {sizes.map((s) => (
                    <button
                      key={s.size}
                      aria-pressed={s.size === size}
                      disabled={!s.inStock}
                      aria-label={s.inStock ? s.size : `${s.size}, agotada`}
                      onClick={() => {
                        setSize(s.size);
                        setQty(1);
                      }}
                    >
                      {s.size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="vn-step">
              <span className="vn-tag">{++step} · Cantidad</span>
              <div className="vn-qty">
                <button aria-label="Menos" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <output aria-live="polite">{qty}</output>
                <button aria-label="Más" onClick={() => setQty((q) => Math.min(Math.max(1, stock), q + 1))}>+</button>
              </div>
              {canAdd && stock <= 3 && <p className="mt-2 text-xs text-velvet-ash">Quedan {stock}.</p>}
            </div>

            {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
            <button className="vn-cta" disabled={!canAdd || saving} onClick={handleAdd}>
              {saving ? "Agregando…" : !canAdd && needsSize && !size ? "Elige una talla" : !canAdd ? "Agotado" : "Agregar al carrito"}
            </button>

            <div className="mt-4 grid gap-2 text-sm">
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  ¿Dudas con la talla? Escríbenos por WhatsApp
                </a>
              )}
              <Link to={`/product/${p.slug}`} onClick={onClose} className="underline underline-offset-4">
                Ver ficha completa
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
