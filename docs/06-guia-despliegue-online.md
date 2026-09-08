# 06 — Guía rápida: publicar la tienda con un link permanente

Pensada para mostrarle el proyecto a socios o clientes desde un link real,
sin depender de que tu computador o esta sesión estén encendidos. Usa solo
servicios con capa gratuita **permanente** (no de prueba por 30 días), así
que el link sigue funcionando indefinidamente sin que tengas que pagar nada
para una demo.

Si en el futuro quieres abrir la tienda al público de verdad (pagos reales,
dominio propio, etc.), usa `docs/04-despliegue.md` como referencia completa
— esta guía es el camino corto solo para tener un link que mostrar.

## El plan (3 cuentas gratis, ~20 minutos)

| Pieza | Dónde | Por qué |
|---|---|---|
| Base de datos | [Neon](https://neon.com) | Postgres gratis que **no vence** (el de Render sí, a los 30 días). |
| Backend + Frontend | [Render](https://render.com) | Un solo panel, despliega los dos servicios de un clic con el archivo `render.yaml` que ya viene en el proyecto. |
| Código fuente | [GitHub](https://github.com) | Render despliega leyendo un repositorio de Git. |

Al terminar vas a tener dos direcciones públicas, por ejemplo:

- `https://velvetnoise-frontend.onrender.com` → **este es el link que le
  compartes a tus socios.**
- `https://velvetnoise-backend.onrender.com` → la API que usa la tienda por
  detrás; no hace falta compartirlo.

(Si esos nombres exactos ya están tomados por otra persona en Render, a ti
te va a asignar unos con un sufijo — se explica cómo corregirlo en el Paso 4.)

## Paso 1 — Sube el proyecto a GitHub

1. Crea una cuenta gratis en [github.com](https://github.com) si no tienes.
2. Crea un repositorio nuevo y vacío (botón "New") — por ejemplo
   `velvet-noise`. Puede ser privado, Render igual puede leerlo una vez lo
   autorices.
3. Descomprime el zip del proyecto en tu computador si aún no lo hiciste, y
   desde una terminal, parado dentro de esa carpeta:

   ```bash
   git init
   git add -A
   git commit -m "Versión inicial"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/velvet-noise.git
   git push -u origin main
   ```

   (El zip trae los archivos pero no el historial de git, así que `git init`
   arranca uno nuevo — no pasa nada, no lo necesitas para desplegar.)

## Paso 2 — Crea la base de datos en Neon

1. Entra a [neon.com](https://neon.com) y crea una cuenta gratis.
2. "New Project" → nómbralo como quieras (por ejemplo `velvet-noise`) →
   elige una región cercana → créalo.
3. Neon te muestra de inmediato una **connection string**, algo así:
   `postgresql://usuario:contraseña@ep-xxxx.neon.tech/neondb?sslmode=require`
   — cópiala completa, la necesitas en el paso siguiente.

## Paso 3 — Despliega en Render

1. Entra a [render.com](https://render.com) y crea una cuenta gratis
   (puedes registrarte directamente con tu cuenta de GitHub, así queda
   conectado de una vez).
2. "New +" → **"Blueprint"**.
3. Conecta tu cuenta de GitHub si te lo pide, y selecciona el repositorio
   `velvet-noise` que subiste en el Paso 1.
4. Render encuentra el archivo `render.yaml` del proyecto y te muestra los
   dos servicios que va a crear: `velvetnoise-backend` y
   `velvetnoise-frontend`.
5. Te pedirá un valor para **`DATABASE_URL`** — pega ahí la connection
   string de Neon del Paso 2. Los demás campos que pida (`WOMPI_*`,
   `EMAIL_API_KEY`, etc.) déjalos en blanco por ahora; son opcionales para
   una demo (ver la nota al final).
6. Clic en **"Apply"** (o "Create New Resources"). Render construye y
   despliega los dos servicios — la primera vez tarda entre 3 y 8 minutos.

## Paso 4 — Verifica y comparte el link

1. Cuando `velvetnoise-backend` quede en estado **"Live"**, entra a
   `<su-url>/api/health` — debe responder algo como
   `{"status":"ok","timestamp":"..."}`.
2. Cuando `velvetnoise-frontend` quede **"Live"**, entra a esa URL: debe
   verse la tienda igual que en las capturas que ya te mostré.
3. **Solo si** alguno de los dos nombres quedó distinto al esperado (Render
   le agrega un sufijo cuando el nombre exacto ya está tomado): abre el
   servicio `velvetnoise-backend` → pestaña "Environment" → corrige
   `FRONTEND_URL`, `API_BASE_URL` y `CORS_ALLOWED_ORIGINS` con la URL real
   del frontend/backend; abre `velvetnoise-frontend` → "Environment" →
   corrige `VITE_API_URL` con `<url-real-del-backend>/api`. Guarda — cada
   servicio se vuelve a desplegar solo al guardar una variable.
4. Comparte el link del frontend con tus socios.

## Cargar productos de ejemplo (para que no se vea vacía)

El proyecto trae un seed con categorías, productos y un usuario
administrador de demostración (`backend/src/db/seed.ts`). Para cargarlo en
la base de datos de Neon, desde tu computador (necesitas Node.js instalado):

```bash
cd backend
DATABASE_URL="pega-aqui-la-connection-string-de-neon" npm run seed
```

El resultado son los mismos datos que ya viste en las capturas: el
catálogo completo y la cuenta `admin@velvetnoise.example.com` (contraseña
`Passw0rd1`) para que tus socios también puedan entrar al panel
administrativo si quieres mostrárselo.

## Cosas a tener en cuenta

- El plan gratis de Render "duerme" el backend después de 15 minutos sin
  visitas — la primera petición después de eso tarda cerca de un minuto en
  responder mientras despierta. Para una demo puntual, entra al link unos
  minutos antes de la reunión con tus socios para que ya esté despierto.
  El frontend (sitio estático) nunca duerme.
- La base de datos gratis de Neon no vence, pero tiene un límite de 0.5 GB
  — de sobra para un catálogo de demostración como este.
- No hay pagos reales ni envío de correos configurados a menos que
  completes las llaves de Wompi/Resend — la tienda queda igual de operativa
  para navegar el catálogo, agregar al carrito y completar un pedido (sin
  cobro real). Ver `docs/04-despliegue.md`, sección 1, si más adelante
  quieres activarlos.
- Si prefieres no depender de estos servicios gratuitos y tienes un
  servidor propio (VPS), el proyecto también trae todo lo necesario para
  desplegar con Docker Compose en un solo comando — ver
  `docs/04-despliegue.md`, sección 2.
