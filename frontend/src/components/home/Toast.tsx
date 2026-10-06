/** Aviso corto de "agregado al carrito", arriba y centrado (ver hooks/useToast). */
export function Toast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed left-1/2 top-24 z-[80] -translate-x-1/2 bg-black px-5 py-3 text-sm font-semibold text-velvet-silk transition-[opacity,transform] duration-200 ${
        message ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      {message}
    </div>
  );
}
