import type { ReactNode } from "react";

// Un "chip" de color sólido (rojo/verde saturado) sería ruido visual — en
// su lugar, un borde izquierdo de acento sobre fondo muy tenue, en línea
// con el uso moderado del color que pide el manual de marca.
const VARIANT_CLASSES: Record<string, string> = {
  error: "border-red-500 bg-red-50 text-red-700",
  success: "border-emerald-500 bg-emerald-50 text-emerald-700",
  info: "border-velvet-black/30 bg-velvet-silk/40 text-velvet-black/80",
};

export function Alert({ variant = "info", children }: { variant?: "error" | "success" | "info"; children: ReactNode }) {
  return <div className={`border-l-2 px-4 py-3 text-sm ${VARIANT_CLASSES[variant]}`}>{children}</div>;
}
