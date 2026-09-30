import { useRef, useState } from "react";
import type { ProductView360Frame } from "../../types/api";

/**
 * Visor 360° interactivo: el cliente arrastra (mouse o dedo) sobre la foto
 * para "girar" el producto, avanzando/retrocediendo entre los frames que
 * el admin subió desde el panel (ver Admin/Products.tsx). Es un carrusel de
 * imágenes de toda la vida por debajo — no hay 3D real ni WebGL — pero al
 * arrastrar se siente como girar el producto porque los frames son fotos
 * reales tomadas girándolo.
 */
export function Product360Viewer({ frames }: { frames: ProductView360Frame[] }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const dragState = useRef<{ startX: number; startFrame: number } | null>(null);

  if (frames.length === 0) return null;
  const sorted = [...frames].sort((a, b) => a.frameIndex - b.frameIndex);

  // Cuántos píxeles de arrastre corresponden a "un frame" — más chico =
  // gira más rápido. Se ajusta sobre el ancho de pantalla para que se
  // sienta igual de sensible en celular y en escritorio.
  function pixelsPerFrame(): number {
    return Math.max(4, Math.round(window.innerWidth / 60));
  }

  function stepFrame(deltaX: number, startFrame: number): void {
    const steps = Math.round(-deltaX / pixelsPerFrame());
    let next = (startFrame + steps) % sorted.length;
    if (next < 0) next += sorted.length;
    setFrameIndex(next);
  }

  function handlePointerDown(clientX: number): void {
    dragState.current = { startX: clientX, startFrame: frameIndex };
  }

  function handlePointerMove(clientX: number): void {
    if (!dragState.current) return;
    stepFrame(clientX - dragState.current.startX, dragState.current.startFrame);
  }

  function handlePointerUp(): void {
    dragState.current = null;
  }

  return (
    <div className="relative aspect-[4/5] overflow-hidden bg-velvet-silk">
      <img
        src={sorted[frameIndex].url}
        alt="Vista 360° del producto"
        draggable={false}
        className="h-full w-full select-none object-cover"
        onMouseDown={(e) => handlePointerDown(e.clientX)}
        onMouseMove={(e) => handlePointerMove(e.clientX)}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={(e) => handlePointerDown(e.touches[0].clientX)}
        onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
        onTouchEnd={handlePointerUp}
      />
      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 border border-white/40 bg-velvet-black/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-label text-white">
        Arrastra para girar · 360°
      </span>
    </div>
  );
}
