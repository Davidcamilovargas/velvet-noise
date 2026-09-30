import { useEffect } from "react";

interface LightboxImage {
  url: string;
  alt: string;
}

/**
 * AGREGADO: al hacer clic en una foto de la galería, se abre esta pantalla
 * grande con la imagen a su tamaño real (no achicada para que quepa en la
 * pantalla) — si la foto es más grande que la ventana, aparece scroll para
 * recorrerla/"correrla" con el mouse, el trackpad o el dedo, tal como lo
 * pidió el admin. Con varias fotos, las flechas (o las teclas ←/→) pasan a
 * la siguiente/anterior sin cerrar la pantalla.
 */
export function ImageLightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate((index + 1) % images.length);
      if (e.key === "ArrowLeft") onNavigate((index - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", handleKeyDown);
    // Bloquea el scroll de la página de fondo mientras la pantalla grande
    // está abierta, para que el scroll del mouse mueva la foto, no la
    // página detrás.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, images.length, onClose, onNavigate]);

  const current = images[index];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-velvet-black/95 p-4" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 border border-white/40 px-3 py-2 text-xs font-semibold uppercase tracking-label text-white hover:bg-white/10"
      >
        Cerrar ✕
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((index - 1 + images.length) % images.length);
            }}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 border border-white/40 px-3 py-4 text-lg text-white hover:bg-white/10 sm:left-4"
            aria-label="Foto anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((index + 1) % images.length);
            }}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 border border-white/40 px-3 py-4 text-lg text-white hover:bg-white/10 sm:right-4"
            aria-label="Siguiente foto"
          >
            ›
          </button>
        </>
      )}

      {/* La imagen se pinta a tamaño natural (sin achicarla con CSS) dentro
          de un contenedor con scroll — si es más grande que la pantalla,
          aparecen barras de desplazamiento / se puede arrastrar con el
          dedo para recorrerla, en vez de verla toda achicada de una vez. */}
      <div
        className="max-h-[90vh] max-w-[92vw] overflow-auto border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={current.url} alt={current.alt} className="max-w-none" />
      </div>

      {images.length > 1 && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs uppercase tracking-label text-white/70">
          {index + 1} / {images.length}
        </span>
      )}
    </div>
  );
}