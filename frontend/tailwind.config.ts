import type { Config } from "tailwindcss";

/**
 * Paleta y tipografía de Velvet Noise — tomadas literalmente del manual de
 * marca (Manual_de_Marca_VELVET_NOISE.pdf, capítulos 08 y 09), no
 * inventadas. Los valores HEX, la proporción de uso (60/22/10/5/3) y las
 * reglas de combinación permitidas/prohibidas están documentadas en
 * frontend/src/styles/brand.md para quien edite esto después.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        velvet: {
          // Colores base (manual, cap. 08 "Color · base y temperatura")
          black: "#000000", // Negro Absoluto — fondo por defecto
          silk: "#EDEAE4", // Blanco Seda — blanco cálido, sustituye al blanco puro
          wine: "#431424", // Vino Terciopelo — el lado velvet: forros, cajas, fondos, hilo
          midnight: "#131C33", // Azul Medianoche — el lado frío: denim, exterior, fondos nocturnos
          // Colores de apoyo (manual, "Color · apoyo y proporción")
          burgundy: "#8E2440", // Borgoña Señal — SOLO acento (subrayados, estado activo). Máx. 5% de la pieza.
          indigo: "#26355C", // Índigo Humo — variante clara del azul, gráficos y estados secundarios
          ash: "#6E6A68", // Gris Ceniza — texto secundario y notas técnicas. Nunca en titulares.
        },
      },
      fontFamily: {
        // "Dos familias, una por cada mitad del nombre. Bodoni Moda pone el
        // terciopelo; Archivo pone el ruido." (manual, cap. 09)
        display: ['"Bodoni Moda"', '"Playfair Display"', "Georgia", "serif"],
        body: ['"Archivo"', '"Helvetica Neue"', "Arial", "sans-serif"],
      },
      letterSpacing: {
        label: "0.2em", // tracking de etiquetas (talla, lote, sello) — única mayúscula permitida
      },
      backgroundImage: {
        // "Trama de terciopelo": degradado radial sutil, solo como fondo,
        // nunca detrás de texto pequeño (manual, cap. 10).
        "velvet-wine": "radial-gradient(ellipse at 30% 20%, #5a1c30 0%, #000000 70%)",
        "velvet-midnight": "radial-gradient(ellipse at 70% 20%, #1c2a4a 0%, #000000 70%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
