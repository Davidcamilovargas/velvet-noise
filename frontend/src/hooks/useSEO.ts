import { useEffect } from "react";

const SITE_NAME = "Velvet Noise";
const DEFAULT_DESCRIPTION = "Velvet Noise — ropa con carácter, envíos a todo Colombia.";

export interface SEOOptions {
  /** Título de la página (sin el sufijo " | Velvet Noise", se agrega solo). */
  title?: string;
  description?: string;
  /** URL absoluta o relativa de una imagen representativa (og:image). */
  image?: string;
  /** og:type — "product" en detalle de producto, "website" en el resto. */
  type?: "website" | "product";
  /** No indexar esta página (panel admin, checkout, cuenta). */
  noindex?: boolean;
  /** JSON-LD (schema.org) a inyectar como <script type="application/ld+json">, si aplica. */
  structuredData?: Record<string, unknown>;
}

function setMetaByName(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaByProperty(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function removeMetaByProperty(property: string) {
  document.querySelector(`meta[property="${property}"]`)?.remove();
}

/**
 * SEO real por página: título, meta description, Open Graph, canonical y
 * (opcional) datos estructurados JSON-LD — todo generado a partir de datos
 * reales del producto/página que lo llama, nunca texto genérico repetido
 * (antes de la Fase 16, `index.html` tenía un único <title> y una única
 * meta description estáticos para TODA la app, incluidas las páginas de
 * producto). No se usa una librería externa (react-helmet) porque el caso
 * de uso es simple: manipular directamente las etiquetas del <head> y
 * revertirlas al desmontar es suficiente y no agrega una dependencia más.
 */
export function useSEO({ title, description, image, type = "website", noindex, structuredData }: SEOOptions): void {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Compra en línea`;
    const desc = description ?? DEFAULT_DESCRIPTION;

    document.title = fullTitle;
    setMetaByName("description", desc);
    setMetaByName("robots", noindex ? "noindex, nofollow" : "index, follow");
    setMetaByProperty("og:site_name", SITE_NAME);
    setMetaByProperty("og:title", fullTitle);
    setMetaByProperty("og:description", desc);
    setMetaByProperty("og:type", type);
    setMetaByProperty("og:url", window.location.href);
    // Solo se publica og:image cuando hay una imagen real de la página (ej.
    // la foto del producto) — no existe todavía una imagen de marca genérica
    // en frontend/public/ para usar de respaldo, y una URL de og:image rota
    // es peor para las vistas previas en redes sociales que no tener ninguna.
    if (image) {
      setMetaByProperty("og:image", image.startsWith("http") ? image : `${window.location.origin}${image}`);
    } else {
      removeMetaByProperty("og:image");
    }
    setCanonical(window.location.origin + window.location.pathname);

    let script: HTMLScriptElement | null = null;
    if (structuredData) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    return () => {
      if (script) document.head.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, image, type, noindex, JSON.stringify(structuredData)]);
}
