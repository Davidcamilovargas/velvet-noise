import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // Code splitting por defecto de Vite (import() dinámico) se usa en el
    // router (ver router/index.tsx) para separar el panel admin del bundle
    // público. Fase 16: además, react/react-dom/react-router-dom (que
    // cambian mucho menos que el código propio) van a un chunk "vendor"
    // aparte del chunk principal — antes vivían mezclados con todo el
    // código de la app en un solo `index-*.js` de ~313 kB, así que
    // cualquier cambio en el código de la app invalidaba también la caché
    // del navegador para React entero. Separados, el navegador reutiliza el
    // chunk de vendor entre despliegues mientras React no cambie de versión.
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
