// Para ver los cambios del diseño en tu computador usando los productos de
// la tienda real, sin configurar una base de datos local:
//   npm run dev:real   →   http://localhost:5173
// Ojo: se conecta a la tienda real. Un pedido hecho aquí es un pedido real.
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

// Vite toma las variables VITE_* del entorno del proceso al arrancar.
process.env.VITE_API_URL = "/api";

export default mergeConfig(
  base,
  defineConfig({
    server: {
      // VN_API_TARGET=http://localhost:4000 para probar contra un backend local.
      proxy: { "/api": { target: process.env.VN_API_TARGET || "https://velvetnoise-backend.onrender.com", changeOrigin: true } },
    },
  })
);
