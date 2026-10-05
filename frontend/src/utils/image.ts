const CLOUDINARY_UPLOAD = "/image/upload/";

/**
 * Pide a Cloudinary la imagen al ancho en que se va a mostrar, en el
 * formato más liviano que soporte el navegador (AVIF/WebP) y con calidad
 * automática. Una foto de producto pasa de ~65 KB a ~15 KB. Las imágenes
 * que no son de Cloudinary (las de /public) se devuelven sin cambios.
 */
export function optimizedImage(url: string, width: number): string {
  if (!url.includes("res.cloudinary.com") || !url.includes(CLOUDINARY_UPLOAD)) return url;
  return url.replace(CLOUDINARY_UPLOAD, `${CLOUDINARY_UPLOAD}f_auto,q_auto,c_limit,w_${width}/`);
}

/** `srcSet` para que el navegador elija el ancho según la pantalla. */
export function optimizedSrcSet(url: string, widths: number[]): string | undefined {
  if (!url.includes("res.cloudinary.com")) return undefined;
  return widths.map((w) => `${optimizedImage(url, w)} ${w}w`).join(", ");
}
