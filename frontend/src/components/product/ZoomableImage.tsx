import { useRef, useState } from "react";

/**
 * AGREGADO: acercamiento al pasar el mouse — al mover el cursor sobre la
 * foto, la imagen se agranda un poco y "sigue" la posición del cursor
 * (el punto bajo el mouse queda ampliado), como en las tiendas de ropa que
 * el admin pidió tomar de referencia (ej. undergoldapparel.com). No se
 * copió código ni diseño de ningún sitio — es el patrón estándar de zoom
 * por cursor que usan casi todas las tiendas de ropa, hecho desde cero con
 * CSS transform + transform-origin.
 *
 * Solo aplica a fotos fijas (no a videos ni al visor 360°, que tienen su
 * propia interacción). En celular no hay "hover" real, así que ahí la
 * imagen se queda estática — no estorba el scroll con gestos de zoom
 * accidentales. Al hacer CLIC (que sí funciona igual en celular) se abre
 * la pantalla grande con scroll (ver ImageLightbox.tsx) — eso es lo que
 * de verdad sirve en celular, donde no hay "hover".
 */
export function ZoomableImage({
  src,
  alt,
  className,
  onClick,
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  }

  return (
    <div
      ref={containerRef}
      className={`group relative cursor-zoom-in overflow-hidden ${className ?? ""}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-300 ease-out"
        style={{
          transform: hovering ? "scale(1.65)" : "scale(1)",
          transformOrigin: `${origin.x}% ${origin.y}%`,
        }}
      />
      <span className="pointer-events-none absolute right-3 top-3 border border-white/40 bg-velvet-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-label text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        Zoom
      </span>
    </div>
  );
}