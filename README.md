# Velvet Noise

Tienda online de la marca de ropa Velvet Noise — catálogo, carrito, checkout,
pagos con Wompi (Colombia) y un panel administrativo completo — construido
con React + Vite + TypeScript en el frontend, Node.js + Express + TypeScript
en el backend, y PostgreSQL (Drizzle ORM). Sin simulaciones: cada
funcionalidad descrita corre contra una base de datos real y fue verificada
en ejecución, no solo escrita.

> Nota de nombre: este repositorio y su historial de fases se crearon bajo el
> nombre de trabajo "Tienda Virtual" (motor de e-commerce genérico); a partir
> de la identidad de marca definida en `frontend/src/styles/brand.md`, el
> producto se presenta como **Velvet Noise**. La arquitectura, rutas internas
> y nombre de la base de datos de desarrollo conservan el identificador
> original por continuidad técnica — no afecta lo que ve el usuario final.

Ver `docs/01-arquitectura.md` para el diseño completo, `docs/02-modelo-datos.md`
para el esquema de base de datos, `docs/03-api.md` para la referencia de la
API y el detalle fase por fase de lo construido, y `docs/04-despliegue.md`
para llevar esto a producción.

## Contenido

- [Arranque rápido (desarrollo)](#arranque-rápido-desarrollo)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Pruebas automatizadas](#pruebas-automatizadas)
- [Datos de demostración (seeder)](#datos-de-demostración-seeder)
- [Despliegue](#despliegue)
- [Estado actual](#estado-actual)

## Arranque rápido (desarrollo)

Requisitos: Node.js 20+ y Docker (para Postgres local) — o un Postgres 16
propio si prefieres no usar Docker.

```bash
# 1. Base de datos (Postgres 16 + Adminer para inspeccionarla, en localhost)
cd database && docker compose up -d && cd ..

# 2. Backend
cd backend
cp ../.env.example .env   # completa como mínimo JWT_ACCESS_SECRET y
                           # JWT_REFRESH_SECRET (openssl rand -base64 48)
npm install
npm run db:migrate        # aplica el esquema a la base de datos
npm run seed               # opcional: datos de demostración reales (ver abajo)
npm run dev                # http://localhost:4000
cd ..

# 3. Frontend (en otra terminal)
cd frontend
cp .env.example .env      # así el frontend sabe que el backend está en localhost:4000
npm install
npm run dev                # http://localhost:5173
```

Si te saltas el `cp .env.example .env` de este paso, la app igual carga (hay un valor por
defecto para desarrollo en `src/services/api.ts`), pero mejor no depender de eso.

Con el seeder corrido, puedes entrar de inmediato con:
`admin@velvetnoise.example.com` / `Passw0rd1` (rol ADMIN) o
`cliente1@velvetnoise.example.com` / `Passw0rd1` (rol CUSTOMER).

## Estructura del proyecto

```
tiendavirtual/
├── backend/            # API REST (Express + TypeScript + Drizzle ORM)
│   ├── src/
│   │   ├── controllers/   # un archivo por recurso
│   │   ├── routes/        # montadas en routes/index.ts
│   │   ├── services/      # lógica de negocio real (nunca en el controller)
│   │   ├── middlewares/   # auth, roles, validación, rate limiting, CORS, caché
│   │   ├── db/             # schema.ts (Drizzle), migrations/, seed.ts
│   │   ├── utils/          # jwt, hash, logger, slugify, envInt...
│   │   ├── config/         # env.ts (valida variables de entorno con Zod)
│   │   └── app.ts, server.ts
│   ├── tests/              # Vitest + Supertest, contra Postgres real
│   └── Dockerfile
├── frontend/            # SPA (React + Vite + TypeScript + Tailwind)
│   ├── src/
│   │   ├── pages/, components/, layouts/
│   │   ├── context/, store/  # AuthContext, cart.store (Zustand)
│   │   ├── services/         # cliente HTTP por recurso (axios)
│   │   ├── hooks/             # useDebounce, useSEO...
│   │   └── router/
│   ├── e2e/                 # Playwright, navegador real de punta a punta
│   └── Dockerfile
├── database/
│   └── docker-compose.yml   # Postgres + Adminer para desarrollo local
├── docs/                  # arquitectura, modelo de datos, API, despliegue
├── .github/workflows/     # CI: lint + tests + build (backend, frontend, E2E)
├── docker-compose.yml     # pila completa (Postgres + backend + frontend)
└── .env.example
```

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example), con un
comentario explicando cada una y dónde conseguir las llaves externas (Wompi,
Resend, Cloudinary). Cópialo a `backend/.env` para desarrollo local, o a
`.env` en la raíz si vas a usar el `docker-compose.yml` de la raíz.

Solo tres son estrictamente obligatorias para que el backend arranque
(`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — el proceso
valida todo con Zod al iniciar y se detiene con un mensaje claro si falta
alguna); el resto tiene valores por defecto razonables para desarrollo. El
detalle de cuáles revisar antes de un despliegue real está en
`docs/04-despliegue.md`.

## Scripts disponibles

**Backend** (`cd backend`):

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga automática (`ts-node-dev`) |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Corre el build compilado (`dist/server.js`) |
| `npm run lint` | ESLint sobre `src/` |
| `npm test` | Suite de integración (Vitest + Supertest, contra Postgres real) |
| `npm run db:generate` | Genera una migración nueva a partir de cambios en `src/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:studio` | Abre Drizzle Studio para inspeccionar la base de datos |
| `npm run seed` | Siembra datos de demostración reales, de forma idempotente |

**Frontend** (`cd frontend`):

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | Type-check + build de producción a `dist/` |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run lint` | ESLint sobre `src/` |
| `npm test` | Tests unitarios/de componentes (Vitest + Testing Library) |
| `npm run test:e2e` | Suite E2E con Playwright (requiere backend y frontend corriendo — ver `docs/03-api.md`, Fase 15) |

## Pruebas automatizadas

Tres capas reales, ninguna simulada (ver `docs/03-api.md`, sección Fase 15,
para el detalle completo):

- **Backend** — 77 tests (Vitest + Supertest) contra un Postgres real, sin
  mocks: auth, carrito/cupones, checkout, pagos y webhooks de Wompi,
  catálogo, dashboard, panel administrativo, emails, seguridad.
- **Frontend** — 44 tests (Vitest + Testing Library) sobre utilidades,
  hooks, servicios, el store del carrito, `AuthContext` y componentes.
- **E2E** — 9 tests (Playwright, Chromium real) contra el navegador,
  frontend y backend reales de punta a punta: autenticación, panel de
  administración, y el recorrido completo de una compra.

Todo corre también en CI en cada push/PR (`.github/workflows/ci.yml`).

## Datos de demostración (seeder)

`backend/src/db/seed.ts` (`npm run seed`, desde `backend/`) reutiliza los
mismos servicios que usa la API real — así que los datos de ejemplo pasan
por exactamente las mismas reglas de negocio que un admin real (slugs/SKUs
únicos, variante por defecto, fila de inventario por variante). Siembra 3
usuarios (1 admin, 2 clientes), 4 categorías con productos (algunos con
variantes de color/talla), y 2 cupones. Es idempotente de verdad: correrlo
varias veces nunca duplica nada, cada entidad se busca primero por su clave
única.

## Despliegue

`docs/04-despliegue.md` cubre dos caminos completos: Docker Compose en un
servidor propio (con los `Dockerfile` de `backend/` y `frontend/` y el
`docker-compose.yml` de la raíz, listos para usar) o plataformas gestionadas
(Railway/Render/Fly.io para el backend, Vercel/Netlify/Cloudflare Pages para
el frontend, Neon/Supabase/Railway Postgres para la base de datos) — además
de la checklist a revisar antes de abrir la tienda al público.

¿Solo quieres un link público para mostrar el proyecto (por ejemplo a
socios o clientes), sin abrirlo al público todavía? `docs/06-guia-despliegue-online.md`
es el camino corto: Neon + Render con el `render.yaml` que ya trae el
repo, todo en capa gratuita permanente, ~20 minutos.

## Estado actual

- ✅ Fase 1: Arquitectura
- ✅ Fase 2: Estructura del proyecto
- ✅ Fase 3: Base de datos y modelos (Drizzle ORM — ver `docs/02-modelo-datos.md` para el cambio respecto a Prisma)
- ✅ Fase 4: Infraestructura transversal del backend (validación, rate limiting, respuestas, tests)
- ✅ Fase 5: Frontend base (router con code-splitting, layouts, cart store, api client)
- ✅ Fase 6: Autenticación y roles (JWT + refresh rotativo, registro/login/logout/recuperación de contraseña, verificado end-to-end — ver `docs/03-api.md`)
- ✅ Fase 7: Catálogo y productos (Home, Shop con filtros/búsqueda/orden/paginación, detalle de producto con variantes — verificado con navegador real)
- ✅ Fase 8: Carrito (invitado 100% local, autenticado sincronizado con el backend en tiempo real, cupones — verificado end-to-end con navegador real, ver `docs/03-api.md`)
- ✅ Fase 9: Checkout (direcciones, métodos de envío, creación real de pedidos con revalidación de stock en vivo, historial de pedidos — verificado end-to-end con navegador real, ver `docs/03-api.md`)
- ✅ Fase 10: Pagos con Wompi + webhooks idempotentes (firma de integridad real, verificación de firma de webhooks, inventario descontado de forma atómica con bloqueo de fila — verificado que nunca sobrevende bajo concurrencia real; pendiente de credenciales reales de Wompi para la apertura del widget en vivo, ver `docs/03-api.md`)
- ✅ Fase 11: Panel administrativo — dashboard (ingresos, pedidos por estado, ventas de 14 días, productos más vendidos, alertas de stock bajo, pedidos recientes — todo calculado con SQL real sobre datos reales, protegido con `requireRole("ADMIN")` — verificado end-to-end con navegador real, ver `docs/03-api.md`)
- ✅ Fase 12: Panel administrativo completo — gestión de pedidos (cambio de estado con máquina de estados, reposición automática de inventario al cancelar un pedido pagado, envíos con transportadora/guía), inventario (ajustes con bloqueo de fila, historial de movimientos), categorías, clientes (detalle, activar/desactivar cuenta), cupones (edición), reseñas (moderación con recálculo real de rating), auditoría de acciones administrativas. Incluye una corrección real de seguridad de sesión (rotación de refresh tokens en carrera entre pestañas/llamadas concurrentes, con ventana de gracia en el backend) descubierta durante la verificación de esta fase — verificado end-to-end con navegador real, ver `docs/03-api.md`
- ✅ Fase 13: Emails y notificaciones — correos transaccionales reales (Resend) conectados a cada evento de negocio: bienvenida, recuperación de contraseña, confirmación de pedido, pago aprobado/rechazado, pedido enviado/entregado/cancelado/reembolsado, reseña aprobada, cuenta desactivada. Incluye una corrección real encontrada en esta fase: la verificación de "compra verificada" para reseñas, exigida desde el diseño original, se había implementado a medias en la Fase 12 (dependía de un dato que el frontend nunca enviaba) — se corrigió para que el backend la verifique por su cuenta, ver `docs/03-api.md`
- ✅ Fase 14: Seguridad — dependencias con vulnerabilidades conocidas actualizadas (`qs` vía `overrides` en el backend, `react-router-dom` v7 en el frontend, 0 vulnerabilidades en `npm audit --omit=dev` para ambos), escape de HTML en todas las plantillas de correo transaccional, sanitización real de todo campo de texto libre (descripciones, comentarios de reseñas, direcciones, notas de pedido, ajustes de inventario) con `sanitize-html` conectado a los validadores, defensa adicional Origin/Referer contra CSRF en `/api/auth/refresh` (con corrección de un bug real de CORS que devolvía 500 en vez de 403), y rate limiting por cuenta (IP + correo) en login además de un límite nuevo en `/auth/refresh` que no tenía ninguno. Verificado con 8 pruebas automatizadas nuevas más la suite completa (77/77), `tsc`/`eslint` limpios en ambos paquetes, y una prueba manual en vivo tras el upgrade mayor de react-router-dom — ver `docs/03-api.md`
- ✅ Fase 15: Pruebas automatizadas — cobertura real en tres capas. Backend: 77 tests (Vitest + Supertest contra Postgres real, sin cambios de fondo en esta fase). Frontend: 44 tests nuevos (Vitest + Testing Library) cubriendo utilidades, hooks, servicios (incluida la coalescencia de refresh concurrente), el store del carrito y `AuthContext` completo (login, logout, fusión de carrito de invitado, sesión restaurada tras recargar). E2E real nueva (`frontend/e2e/`, Playwright + Chromium): 9 tests contra el navegador, frontend y backend reales — auth completo, panel de administración con datos reales creados por la propia suite, y el recorrido de compra completo (buscar → carrito → registro → checkout → pedido real creado en Postgres). Al escribir la suite E2E se encontró que el propio rate limiting de la Fase 14 bloqueaba a la suite corriendo varias veces seguidas desde una sola IP — se corrigió haciendo esos límites configurables por variable de entorno sin cambiar los valores por defecto de producción, ver `docs/03-api.md`
- ✅ Fase 16: Optimización, SEO y seeders — SEO real (hook `useSEO` con title/meta/OG/canonical/JSON-LD en 13 páginas y el panel admin, `robots.txt`, `GET /sitemap.xml` generado dinámicamente desde Postgres, sin archivos estáticos desactualizables), rendimiento (bundle de vendor de React separado del código de la app y verificado con números reales de build, corrección de una consulta N+1 en la verificación de stock del checkout sin afectar el bloqueo atómico real de inventario, nuevo índice compuesto para el catálogo filtrado, `Cache-Control` público en catálogo/categorías cuidando de no cachear nunca una respuesta de admin) y un seeder de datos de demostración (`npm run seed`, backend) que reutiliza los mismos servicios que la API real y es idempotente de verdad — verificado corriendo dos veces seguidas contra la base de datos real. Regresión completa verificada tras el cambio: backend 77/77, frontend 44/44, E2E 9/9, ver `docs/03-api.md`
- ✅ Fase 17: Documentación y despliegue — `Dockerfile` multi-etapa para backend (compila TS, corre migraciones al arrancar, usuario sin privilegios) y frontend (build de Vite servido con Nginx configurado para SPA routing), `docker-compose.yml` en la raíz para levantar la pila completa con un comando, CI en GitHub Actions (`.github/workflows/ci.yml`: lint + type-check + tests + build para backend y frontend, más la suite E2E completa contra la app real), `docs/04-despliegue.md` con dos caminos de despliegue documentados (Docker Compose propio y plataformas gestionadas) y una checklist previa a producción, y este README completado con instalación, variables de entorno, scripts y estructura del proyecto — ver `docs/04-despliegue.md`
- ✅ Verificación final — suite automatizada completa corrida de nuevo al cierre (backend 77/77, frontend 44/44, E2E 9/9, `npm audit` sin vulnerabilidades en ambos paquetes), más una verificación manual en vivo con navegador real de SEO/sitemap/rutas protegidas y de la configuración de despliegue (`docker compose config`) — con las limitaciones conocidas documentadas honestamente en `docs/05-verificacion-final.md` (Wompi y Resend requieren credenciales reales de terceros para probarse en vivo; el build real de las imágenes Docker queda para el primer despliegue con salida a internet)
