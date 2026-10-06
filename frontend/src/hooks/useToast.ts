import { useCallback, useEffect, useRef, useState } from "react";

/** Aviso corto de "agregado al carrito", arriba y centrado. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number>();
  const show = useCallback((m: string) => {
    setMessage(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2400);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { message, show };
}
