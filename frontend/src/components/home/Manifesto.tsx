import { useEffect, useRef } from "react";

// Materiales reales del catálogo (descripciones de producto): lo de afuera
// y lo de adentro, en las dos voces de la marca.
const OUTSIDE = "Denim rígido, sarga de algodón y nylon ripstop por fuera.";
const INSIDE = "Felpa perchada de 450 g y forro vino por dentro.";

/** Frase grande que se enciende palabra por palabra a medida que sube. */
export function Manifesto() {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const p = ref.current!;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const words = [...p.querySelectorAll<HTMLSpanElement>(".vn-w")];
    let raf = 0;
    const update = () => {
      raf = 0;
      const top = p.getBoundingClientRect().top, vh = innerHeight;
      const q = Math.min(1, Math.max(0, (vh * 0.85 - top) / (vh * 0.75)));
      const lit = Math.round(q * words.length);
      words.forEach((w, i) => w.classList.toggle("is-on", i < lit));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const words = (text: string) =>
    text.split(" ").map((w, i) => (
      <span key={i}>
        <span className="vn-w">{w}</span>{" "}
      </span>
    ));

  return (
    <section className="vn-manifesto" aria-label="Materiales">
      <p ref={ref} className="vn-wide-text">
        {words(OUTSIDE)}
        <span className="vn-velvet">{words(INSIDE)}</span>
      </p>
    </section>
  );
}
