import sanitizeHtml from "sanitize-html";
import { z } from "zod";

/**
 * Elimina TODO markup de un texto libre (reseñas, descripciones, notas de
 * pedido, direcciones) antes de guardarlo. React ya escapa por defecto al
 * renderizar (no hay ningún `dangerouslySetInnerHTML` en el frontend, ver
 * docs/01-arquitectura.md §7), y las plantillas de correo (Fase 13) también
 * escapan cada valor dinámico — pero sanitizar en el punto de ESCRITURA es
 * la capa adicional real que el diseño original de seguridad exige (no
 * dejarlo solo en manos de cada consumidor futuro de estos datos, sea el
 * propio frontend, un cliente móvil, u otra integración). `allowedTags: []`
 * quita cualquier etiqueta por completo (no solo `<script>`) — este es
 * texto plano, nunca contenido HTML enriquecido.
 */
export function stripHtml(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}

/** Envoltorio para usar directamente en un schema de Zod sobre un campo de texto libre. */
export function sanitizedText(schema: z.ZodString): z.ZodEffects<z.ZodString, string, string> {
  return schema.transform(stripHtml);
}
