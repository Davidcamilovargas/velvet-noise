/**
 * Cliente de Cloudinary para el almacenamiento de archivos reales de
 * producto (fotos, gifs, videos, frames de 360°).
 *
 * Por qué Cloudinary y no el disco del backend: Render borra el disco del
 * backend en cada redeploy/restart (es un filesystem efímero) — cualquier
 * imagen guardada ahí se perdería la próxima vez que se reinicie el
 * servicio. Cloudinary guarda los archivos de forma permanente y separada
 * del backend.
 *
 * Si CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET están vacíos (todavía no se
 * configuraron), `isCloudinaryConfigured` queda en `false` y los endpoints
 * de subida devuelven un error claro en vez de fallar de forma confusa.
 */
import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";

export const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };
