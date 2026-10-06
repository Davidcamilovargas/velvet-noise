import { DependencyList, RefObject, useEffect } from "react";

/**
 * Agrega `is-in` a cada `.vn-item` dentro del contenedor cuando entra en
 * pantalla (una sola vez), para la aparición escalonada de las tarjetas.
 */
export function useReveal(container: RefObject<HTMLElement>, deps: DependencyList) {
  useEffect(() => {
    const items = [...(container.current?.querySelectorAll<HTMLElement>(".vn-item:not(.is-in)") ?? [])];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
