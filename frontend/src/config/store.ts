/**
 * Datos de contacto de la tienda que se muestran en el sitio público.
 * Se configuran con variables de entorno (frontend/.env y en Render) para
 * no tener que tocar código cuando cambian.
 */
export const STORE_CONTACT = {
  // Solo dígitos con indicativo de país, sin "+" ni espacios: 573001234567.
  // Vacío = el botón de WhatsApp no aparece en ninguna parte.
  whatsapp: (import.meta.env.VITE_WHATSAPP_NUMBER ?? "").replace(/\D/g, ""),
  email: import.meta.env.VITE_CONTACT_EMAIL ?? "",
  hours: "Lunes a viernes, 8:00 a.m. – 6:00 p.m.",
};

export function whatsappLink(message: string): string | null {
  if (!STORE_CONTACT.whatsapp) return null;
  return `https://wa.me/${STORE_CONTACT.whatsapp}?text=${encodeURIComponent(message)}`;
}
