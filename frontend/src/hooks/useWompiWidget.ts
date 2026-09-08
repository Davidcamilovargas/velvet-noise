import { useCallback, useRef } from "react";

// Script real del widget de Wompi (verificado contra la documentación
// oficial: https://docs.wompi.co/en/docs/colombia/widget-checkout-web/).
// Nunca se construye un formulario de tarjeta propio: el widget se abre en
// un iframe alojado por Wompi — el número de tarjeta y el CVV jamás pasan
// por nuestro frontend ni backend (regla de seguridad §14 del proyecto).
const WOMPI_WIDGET_SRC = "https://checkout.wompi.co/widget.js";

interface WompiTransaction {
  id: string;
  status: string;
}

interface WompiWidgetConfig {
  currency: string;
  amountInCents: number;
  reference: string;
  publicKey: string;
  signature: { integrity: string };
  redirectUrl?: string;
  customerData?: { email?: string };
}

declare global {
  interface Window {
    WidgetCheckout?: new (config: WompiWidgetConfig) => { open: (callback: (result: { transaction: WompiTransaction }) => void) => void };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadWompiScript(): Promise<void> {
  if (window.WidgetCheckout) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = WOMPI_WIDGET_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("No se pudo cargar el widget de pago de Wompi."));
      document.body.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

export function useWompiWidget() {
  const isOpeningRef = useRef(false);

  const openCheckout = useCallback(
    async (config: {
      publicKey: string;
      reference: string;
      amountInCents: number;
      currency: string;
      signature: string;
      redirectUrl: string;
      customerEmail: string;
    }): Promise<WompiTransaction> => {
      if (isOpeningRef.current) throw new Error("Ya hay un checkout de Wompi abierto.");
      isOpeningRef.current = true;
      try {
        await loadWompiScript();
        if (!window.WidgetCheckout) throw new Error("El widget de Wompi no se cargó correctamente.");

        return await new Promise<WompiTransaction>((resolve, reject) => {
          try {
            const checkout = new window.WidgetCheckout!({
              currency: config.currency,
              amountInCents: config.amountInCents,
              reference: config.reference,
              publicKey: config.publicKey,
              signature: { integrity: config.signature },
              redirectUrl: config.redirectUrl,
              customerData: { email: config.customerEmail },
            });
            checkout.open((result) => resolve(result.transaction));
          } catch (err) {
            reject(err instanceof Error ? err : new Error("No se pudo abrir el widget de Wompi."));
          }
        });
      } finally {
        isOpeningRef.current = false;
      }
    },
    []
  );

  return { openCheckout };
}
