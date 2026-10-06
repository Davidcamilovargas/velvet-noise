import { RefObject, useEffect } from "react";

/**
 * Guarda en `--hdr` (sobre el elemento dado) el alto real del header fijo,
 * para que las barras y secciones "sticky" queden justo debajo de él. El
 * alto cambia con la barra de anuncios y el ancho de pantalla.
 */
export function useHeaderOffset(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    const header = document.querySelector("header");
    if (!el || !header) return;
    const set = () => el.style.setProperty("--hdr", `${header.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(header);
    return () => ro.disconnect();
  }, [ref]);
}
