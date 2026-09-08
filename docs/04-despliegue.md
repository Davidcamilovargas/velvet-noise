# 04 — Despliegue (Fase 17)

Esta guía cubre cómo llevar Velvet Noise de "corriendo en mi máquina" a un
entorno real: variables de entorno, dos caminos de despliegue (Docker
Compose en un servidor propio, o plataformas gestionadas), migraciones,
seeders, CI y una checklist previa a abrir la tienda al público.

## 1. Antes de desplegar — variables de entorno

Todas las variables están documentadas con su propósito en
[`.env.example`](../.env.example) (en la raíz del repo). Cópialo a `.env` y
complétalo — nunca subas el `.env` real a git (ya está en `.gitignore`).

Las que son estrictamente obligatorias para que el backend arranque (ver
`backend/src/config/env.ts`, que valida con Zod y **no arranca** si faltan):

| Variable | Por qué es obligatoria |
|---|---|
| `DATABASE_URL` | Conexión a Postgres. |
| `JWT_ACCESS_SECRET` | Firma los access tokens. Mínimo 16 caracteres — genera uno real con `openssl rand -base64 48`, nunca un valor de ejemplo. |
| `JWT_REFRESH_SECRET` | Firma los refresh tokens (cookie httpOnly). Debe ser **distinto** de `JWT_ACCESS_SECRET`. |

Las demás tienen valores por defecto razonables para desarrollo, pero en
producción hay que revisar en concreto:

- `WOMPI_*`: sin llaves reales de Wompi (modo producción, no sandbox), los
  pagos no funcionan — la tienda queda operativa para todo lo demás (catálogo,
  carrito, checkout con pago contra entrega si lo agregas como método) pero
  sin pagos en línea reales. Ver Wompi Comercios → Producción.
- `EMAIL_API_KEY` (Resend) o los `SMTP_*`: sin uno de los dos configurado,
  los correos transaccionales (confirmación de pedido, recuperación de
  contraseña, etc.) no se envían — el pedido igual se crea, solo no llega el
  correo. Revisa los logs del backend si un usuario reporta no haber
  recibido un correo esperado.
- `CORS_ALLOWED_ORIGINS`: debe ser el dominio real del frontend en
  producción (por ejemplo `https://tienda.midominio.com`), separado por coma
  si hay más de uno. Dejarlo en `http://localhost:5173` en producción
  bloquea al frontend real de hacer peticiones al backend.
- `FRONTEND_URL` y `API_BASE_URL`: se usan para construir enlaces absolutos
  en los correos transaccionales y en el `sitemap.xml` (Fase 16) — deben ser
  las URLs públicas reales, con `https://`.
- `COOKIE_SECRET`: cámbialo del valor de ejemplo en producción.
- Las variables de rate limiting (`AUTH_RATE_LIMIT_MAX`, etc.) casi nunca
  hace falta tocarlas en producción — están para el caso puntual de pruebas
  automatizadas repetidas desde una sola IP (ver `docs/03-api.md`, Fase 15).

El frontend, además, necesita sus propias `VITE_*` (se "hornean" en el
bundle en tiempo de build, no se leen en tiempo de ejecución — ver más abajo
según el camino de despliegue que elijas):

- `VITE_API_URL`: URL pública del backend + `/api` (por ejemplo
  `https://api.midominio.com/api`).
- `VITE_WOMPI_PUBLIC_KEY`: la llave pública de Wompi (no la privada — esta sí
  es segura de exponer en el navegador, es su propósito).

## 2. Camino A — Docker Compose (servidor propio / VPS)

El repo trae todo lo necesario para levantar la pila completa (Postgres +
backend + frontend) con un solo comando: `Dockerfile` en `backend/` y
`frontend/`, y `docker-compose.yml` en la raíz.

```bash
git clone <tu-fork-o-repo> tiendavirtual
cd tiendavirtual
cp .env.example .env
# edita .env: como mínimo JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
# CORS_ALLOWED_ORIGINS, FRONTEND_URL, API_BASE_URL con los dominios reales,
# y las llaves de Wompi/Resend si ya las tienes.

docker compose up -d --build
```

Qué hace cada pieza:

- **`postgres`**: Postgres 16, con un volumen nombrado (`pgdata`) para que
  los datos sobrevivan a un `docker compose down` (no a un `down -v`).
- **`backend`**: build multi-etapa (`backend/Dockerfile`) — compila
  TypeScript a `dist/`, instala solo dependencias de producción en la imagen
  final, corre como usuario sin privilegios, expone `4000`, y al arrancar
  **aplica las migraciones pendientes automáticamente** antes de levantar el
  servidor (`node dist/db/migrate.js && node dist/server.js` — nunca
  sincronización implícita del schema, siempre migraciones versionadas).
- **`frontend`**: build multi-etapa (`frontend/Dockerfile`) — compila los
  estáticos con Vite (las `VITE_*` se pasan como build args, tomadas del
  mismo `.env` de la raíz) y los sirve con Nginx (`frontend/nginx.conf`,
  configurado para SPA routing: cualquier ruta que no sea un archivo real
  cae en `index.html`, para que `/shop/producto-x` funcione al recargar).
  Expuesto en el puerto `8081` del host por defecto.

En producción real, pon un reverse proxy (Nginx, Caddy o Traefik) delante de
los puertos `4000` y `8081` para servir `https://` con un certificado real
(por ejemplo con Let's Encrypt) y mapear los dominios — este
`docker-compose.yml` no incluye TLS a propósito, porque la forma de
manejarlo varía mucho según el servidor (un solo dominio, subdominios para
API y frontend, etc.).

Para actualizar tras un cambio de código:

```bash
git pull
docker compose up -d --build
```

Las migraciones nuevas se aplican solas al reiniciar el contenedor del
backend (mismo mecanismo de arranque descrito arriba).

### Seed de datos de demostración (opcional)

`backend/src/db/seed.ts` (Fase 16) reutiliza los mismos servicios que la API
real y es idempotente — sirve para tener una tienda con catálogo real desde
el primer arranque, en una demo o en staging (**no lo corras en producción
con clientes reales**, a menos que quieras usuarios de prueba con contraseña
conocida en la base de datos):

```bash
docker compose exec backend node dist/db/seed.js
```

## 3. Camino B — Plataformas gestionadas

Alternativa sin administrar servidores propios: cada pieza va a un servicio
distinto, todos con capa gratuita o de bajo costo suficiente para empezar.

| Pieza | Opciones | Notas |
|---|---|---|
| Base de datos | Neon, Supabase, Railway Postgres, Render Postgres | Cualquiera que dé un `DATABASE_URL` de Postgres 16+ sirve. Neon/Supabase tienen capa gratuita generosa. |
| Backend (API Express) | Railway, Render, Fly.io | Todas soportan "detectar Dockerfile y desplegar" — apunta el servicio a `backend/Dockerfile`. Configura ahí las variables de entorno de la sección 1. El comando de arranque ya corre las migraciones automáticamente (ver Dockerfile), no hace falta un paso de release aparte. |
| Frontend (estáticos) | Vercel, Netlify, Cloudflare Pages | Build command: `npm run build` (desde `frontend/`), output: `frontend/dist`. Configura `VITE_API_URL` y `VITE_WOMPI_PUBLIC_KEY` como variables de entorno del proyecto en la plataforma — se leen en build time, así que un cambio requiere un nuevo deploy, no solo reiniciar. Como es una SPA con rutas de cliente, activa el "rewrite a index.html" que casi todas estas plataformas ofrecen (equivalente al `try_files ... /index.html` de `frontend/nginx.conf`). |

Pasos generales:

1. Crea la base de datos gestionada, copia su `DATABASE_URL`.
2. Despliega el backend apuntando a `backend/Dockerfile`, con las variables
   de entorno de la sección 1 (incluyendo esa `DATABASE_URL`). El primer
   despliegue aplica las migraciones automáticamente al arrancar.
3. Despliega el frontend apuntando a `frontend/`, con `VITE_API_URL`
   apuntando al dominio público que te dio el paso anterior.
4. Actualiza `CORS_ALLOWED_ORIGINS` en el backend con el dominio real del
   frontend ya desplegado, y `FRONTEND_URL`/`API_BASE_URL` con las URLs
   finales — un cambio de variable de entorno normalmente solo requiere
   reiniciar el servicio, no reconstruir la imagen.

## 4. CI (GitHub Actions)

`.github/workflows/ci.yml` corre en cada push/PR a `main`:

- **`backend`**: lint, `tsc --noEmit`, migraciones + suite de integración
  completa (Vitest + Supertest) contra un Postgres real levantado como
  service container del propio job — no contra mocks, mismo criterio que el
  resto del proyecto —, y build.
- **`frontend`**: lint, `tsc --noEmit`, tests (Vitest + Testing Library), y
  `vite build`.
- **`e2e`**: levanta Postgres, aplica migraciones, arranca backend y
  frontend reales, espera a que ambos respondan, y corre la suite Playwright
  completa (Fase 15) contra la app real de punta a punta. Sube el reporte de
  Playwright como artefacto si algo falla, para poder inspeccionar la traza.

No incluye un paso de `docker build`/publicación de imágenes a un registry a
propósito — cada plataforma de despliegue (sección 2 y 3) ya construye la
imagen a partir del mismo `Dockerfile` en su propio pipeline, así que
duplicar el build aquí solo agregaría tiempo de CI sin verificar nada nuevo.
Si en el futuro se agrega un registry de imágenes propio, ese paso se puede
añadir como un job adicional que dependa de que `backend`/`frontend` pasen.

## 5. Checklist antes de abrir al público

```
[ ] JWT_ACCESS_SECRET y JWT_REFRESH_SECRET son valores generados (openssl
    rand -base64 48), distintos entre sí, y distintos de cualquier valor
    usado en desarrollo/CI.
[ ] COOKIE_SECRET también fue cambiado del valor de ejemplo.
[ ] CORS_ALLOWED_ORIGINS, FRONTEND_URL y API_BASE_URL apuntan a los
    dominios reales con https://.
[ ] WOMPI_* son las llaves de PRODUCCIÓN de Wompi (no las de sandbox) y
    WOMPI_API_URL apunta a la URL de producción de Wompi, no a
    sandbox.wompi.co.
[ ] El webhook de Wompi está configurado en el panel de Wompi apuntando a
    https://<tu-api>/api/payments/webhook (ver docs/03-api.md, sección
    PAYMENTS) y WOMPI_EVENTS_SECRET coincide con el secreto de eventos real.
[ ] EMAIL_API_KEY (o SMTP_*) configurado y probado con un correo real
    (registro de una cuenta de prueba y verificar que llega el correo de
    bienvenida).
[ ] Backend y frontend sirven por https:// (certificado real, no
    autofirmado) — el reverse proxy delante de Docker Compose, o la
    plataforma gestionada, se encarga de esto.
[ ] Backup automático de Postgres configurado (la mayoría de proveedores
    gestionados lo ofrecen activado por defecto o con un clic; en un VPS
    propio con Docker Compose, programar pg_dump periódico del volumen
    pgdata).
[ ] Si se corrió `npm run seed` en este entorno para tener datos de
    ejemplo, decidir si esos usuarios/productos de demostración deben
    borrarse antes de abrir al público real (tienen contraseña conocida:
    ver backend/src/db/seed.ts).
[ ] CI (.github/workflows/ci.yml) en verde en el commit que se va a
    desplegar.
```

## 6. Troubleshooting rápido

- **El backend no arranca / se cierra inmediatamente**: revisa los logs —
  `backend/src/config/env.ts` valida las variables de entorno con Zod al
  arrancar y termina el proceso con un mensaje claro si falta alguna
  obligatoria (sección 1), en vez de arrancar con configuración incompleta.
- **CORS bloqueado en el navegador**: `CORS_ALLOWED_ORIGINS` en el backend
  no incluye el dominio exacto (protocolo + host + puerto) desde el que
  sirves el frontend.
- **Los pagos no completan / el webhook nunca llega**: confirma que
  `WOMPI_EVENTS_SECRET` coincide con el configurado en el panel de Wompi
  para ese webhook, y que la URL del webhook es alcanzable públicamente
  (Wompi no puede llamar a `localhost`).
- **Las migraciones no se aplicaron**: en Docker Compose se aplican solas al
  arrancar el contenedor del backend (revisa sus logs); en una plataforma
  gestionada, confirma que el comando de arranque del servicio es el `CMD`
  del `Dockerfile` y no fue sobreescrito por la plataforma.
