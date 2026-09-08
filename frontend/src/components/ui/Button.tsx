import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  isLoading?: boolean;
}

// Botones angulares (sin radio), tracking amplio en mayúsculas — el
// vocabulario visual de una casa de moda, no el de un SaaS. Sobre la UI
// clara tipo retail deportivo, el primario se invierte a negro sólido
// (como "Añadir al carrito" en adidas.com); el acento borgoña se usa con
// moderación (manual: "máx. 5% de la pieza"), así que vive solo en estados
// puntuales, nunca como relleno grande.
const VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-velvet-black text-white hover:opacity-85 disabled:bg-velvet-ash disabled:text-white/70 disabled:opacity-100",
  secondary:
    "bg-transparent text-velvet-black border border-velvet-black/30 hover:border-velvet-black disabled:border-velvet-ash disabled:text-velvet-ash",
  ghost: "text-velvet-black/70 hover:text-velvet-black",
};

export function Button({ variant = "primary", isLoading, disabled, className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-label transition disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  );
}
