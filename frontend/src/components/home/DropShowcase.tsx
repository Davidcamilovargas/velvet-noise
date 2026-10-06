import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../../types/api";
import { useAddToCart } from "../../hooks/useAddToCart";
import { formatCurrency } from "../../utils/format";
import { optimizedImage } from "../../utils/image";
import { colorsOf, findVariant, primaryImage, sizesOf } from "../../utils/variants";

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * "Tres piezas.": en escritorio la sección queda fija y, al bajar, las
 * piezas se deslizan de lado con inercia. En celular (o con movimiento
 * reducido) es un carrusel normal que se desliza con el dedo.
 */
export function DropShowcase({ products }: { products: Product[] }) {
  const secRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const total = products.length;

  useEffect(() => {
    const sec = secRef.current, track = trackRef.current, bar = barRef.current;
    if (!sec || !track || !bar || total === 0) return;
    const desktop = matchMedia("(min-width: 900px)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let travel = 0, target = 0, cur = 0, running = false, last = 0, raf = 0;

    const setProgress = (p: number) => {
      bar.style.transform = `scaleX(${(1 + p * (total - 1)) / total})`;
      setActive(Math.min(total - 1, Math.round(p * (total - 1))));
    };
    const measure = () => {
      if (!desktop.matches || reduce) {
        sec.classList.remove("is-pinned");
        track.style.transform = "";
        return;
      }
      sec.classList.add("is-pinned");
      const lastPiece = track.lastElementChild as HTMLElement | null;
      const gutter = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      travel = lastPiece ? Math.max(0, lastPiece.offsetLeft + lastPiece.offsetWidth + gutter - innerWidth) : 0;
      sec.style.setProperty("--travel", `${travel}px`);
    };
    const read = () => {
      const r = sec.getBoundingClientRect();
      target = clamp(-r.top / Math.max(1, r.height - innerHeight));
    };
    const draw = (p: number) => {
      track.style.transform = `translate3d(${-travel * p}px,0,0)`;
      setProgress(p);
    };
    const loop = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      cur += (target - cur) * (1 - Math.pow(1 - 0.14, dt / 16.7));
      if (Math.abs(target - cur) < 0.0005) cur = target;
      draw(cur);
      if (cur !== target) raf = requestAnimationFrame(loop);
      else running = false;
    };
    const kick = () => {
      if (!sec.classList.contains("is-pinned")) return;
      read();
      if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    };
    // Carrusel con el dedo: solo se actualiza el contador.
    const onTrackScroll = () => {
      if (sec.classList.contains("is-pinned")) return;
      const first = track.firstElementChild as HTMLElement | null;
      if (!first) return;
      const i = Math.round(track.scrollLeft / (first.offsetWidth + 16));
      setProgress(total > 1 ? Math.min(1, i / (total - 1)) : 0);
    };
    const onResize = () => { measure(); kick(); };

    measure(); read(); cur = target;
    if (sec.classList.contains("is-pinned")) draw(cur); else setProgress(0);
    addEventListener("scroll", kick, { passive: true });
    addEventListener("resize", onResize);
    track.addEventListener("scroll", onTrackScroll, { passive: true });
    const imgs = [...track.querySelectorAll("img")];
    imgs.forEach((i) => i.addEventListener("load", onResize));
    document.fonts?.ready.then(onResize);
    return () => {
      removeEventListener("scroll", kick);
      removeEventListener("resize", onResize);
      track.removeEventListener("scroll", onTrackScroll);
      imgs.forEach((i) => i.removeEventListener("load", onResize));
      cancelAnimationFrame(raf);
    };
  }, [total]);

  if (total === 0) return null;

  return (
    <section ref={secRef} id="entrega" className="vn-showcase" aria-label={`${total} piezas destacadas`}>
      <div className="vn-sc-pin">
        <div className="vn-sc-head">
          <h2 className="vn-wide">
            {total === 3 ? "Tres piezas." : `${total} piezas.`}
            <span className="vn-velvet">la entrega actual</span>
          </h2>
          <span className="vn-sc-count" aria-live="polite">
            {active + 1} / {total}
          </span>
        </div>
        <div className="vn-sc-progress" aria-hidden>
          <i ref={barRef} />
        </div>
        <div ref={trackRef} className="vn-track">
          {products.map((p, i) => (
            <Piece key={p.id} product={p} index={i} total={total} active={i === active} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Piece({
  product: p,
  index,
  total,
  active,
}: {
  product: Product;
  index: number;
  total: number;
  active: boolean;
}) {
  const addToCart = useAddToCart();
  const colors = colorsOf(p);
  const color = colors.find((c) => sizesOf(p, c).some((s) => s.inStock)) ?? colors[0] ?? null;
  // En la tarjeta grande se muestran las tallas con stock en cualquier color;
  // el color se elige en la ficha o en la vista rápida.
  const sizes = sizesOf(p, null);
  const [size, setSize] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const img = primaryImage(p);

  async function add() {
    const variant =
      findVariant(p, color, size) ?? p.variants.find((v) => v.size === size && v.stock > 0) ?? (sizes.length === 0 ? p.variants[0] : undefined);
    if (!variant || variant.stock <= 0) return setError("Esa talla se agotó.");
    setSaving(true);
    const r = await addToCart(p, variant, 1);
    setSaving(false);
    if (!r.ok) setError(r.message);
  }

  const ready = sizes.length === 0 ? p.stock > 0 : !!size;

  return (
    <article className={`vn-piece${active ? " is-on" : ""}`}>
      <Link to={`/product/${p.slug}`} className="vn-ph" aria-label={p.name}>
        {img && <img src={optimizedImage(img, 1000)} alt={p.name} loading={index === 0 ? "eager" : "lazy"} decoding="async" />}
        <span className="vn-idx">
          {index + 1}/{total}
        </span>
      </Link>
      <div className="vn-info">
        <h3>{p.name}</h3>
        <p className="vn-d">{p.description}</p>
        <p className="vn-pr">
          {formatCurrency(p.price)}
          {p.compareAtPrice && <s>{formatCurrency(p.compareAtPrice)}</s>}
        </p>
        {sizes.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Talla">
            {sizes.map((s) => (
              <button
                key={s.size}
                className="vn-opt-dark"
                aria-pressed={size === s.size}
                disabled={!s.inStock}
                aria-label={s.inStock ? s.size : `${s.size}, agotada`}
                onClick={() => { setSize(s.size); setError(null); }}
              >
                {s.size}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button className="vn-add-light" disabled={!ready || saving} onClick={add}>
          {saving ? "Agregando…" : p.stock <= 0 ? "Agotado" : ready ? `Agregar${size ? ` talla ${size}` : ""}` : "Elige una talla"}
        </button>
      </div>
    </article>
  );
}
