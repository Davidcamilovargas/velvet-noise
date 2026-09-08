# Arquitectura del proyecto — Velvet Noise

**Estado:** Fase 1 completada. Este documento es la fuente de verdad de decisiones técnicas. Cualquier cambio de arquitectura en fases posteriores debe reflejarse aquí.

---

## 1. Análisis de requisitos

El proyecto exige una plataforma de e-commerce **real**, no un prototipo: cliente (catálogo, carrito, checkout, pagos, pedidos) + panel administrativo (productos, inventario, pedidos, clientes, cupones, reseñas, envíos, configuración, auditoría) + seguridad de producción (auth con roles, rate limiting, protección contra inyección/XSS/CSRF, manejo de secretos) + operaciones (emails transaccionales, webhooks idempotentes, control de concurrencia de stock) + calidad (pruebas automatizadas, seeders, documentación, despliegue).

Restricciones duras identificadas:

- **No simulación**: cada funcionalidad listada debe ejecutar lógica real contra una base de datos real. Está prohibido dejar `TODO: implementar` en rutas críticas.
- **No se debe tocar información de tarjetas**: el número de tarjeta y CVV nunca pasan por nuestro backend; los recibe directamente la pasarela (Wompi widget/checkout redirect o tokenización client-side).
- **Idempotencia de pagos**: un mismo evento de webhook no puede aplicarse dos veces (doble descuento de stock, doble pedido pagado).
- **Concurrencia de inventario**: dos compras simultáneas del último ítem no pueden generar overselling.
- **Sin claves en el código**: todo secreto vive en variables de entorno, con `.env.example` documentado y `.env` real ignorado por git.

Alcance funcional confirmado: 40 secciones del brief, agrupadas en 17 fases (ver §10).

---

## 2. Arquitectura propuesta

### 2.1 Vista general

```
                         ┌─────────────────────────┐
                         │        Cliente           │
                         │  React 18 + Vite + TS    │
                         │  (SPA, React Router)     │
                         └────────────┬─────────────┘
                                      │ HTTPS / REST (JSON)
                                      │ Cookie httpOnly (refresh) + Bearer JWT (access)
                         ┌────────────▼─────────────┐
                         │      API REST (Express)   │
                         │  controllers/services/    │
                         │  middlewares/routes        │
                         └──┬───────────┬────────────┘
                            │           │
              ┌─────────────▼──┐   ┌────▼──────────────┐
              │  PostgreSQL     │   │  Servicios externos │
              │  (Prisma ORM)   │   │  - Wompi (pagos)     │
              │  transacciones  │   │  - Resend (emails)   │
              │  con locking    │   │  - Cloudinary (imgs) │
              └─────────────────┘   └──────────────────────┘
```

### 2.2 Por qué esta arquitectura (justificación técnica)

- **Monorepo con `frontend/` y `backend/` separados, cada uno desplegable de forma independiente.** Un monolito Express + React sobre el mismo proceso complica el escalado horizontal del backend (stateless, puede tener N réplicas) vs. el frontend (estático, se sirve por CDN). Separarlos desde el día uno evita una migración dolorosa más adelante.
- **REST sobre GraphQL**: el equipo objetivo (según el brief) es de tamaño pequeño/mediano, el dominio es CRUD-heavy con pocas relaciones anidadas complejas en el cliente, y REST es más simple de asegurar (rate limiting, cacheo HTTP, CORS) y de documentar (OpenAPI) sin la sobrecarga operativa de un servidor GraphQL.
- **PostgreSQL (no Firestore)**: el dominio tiene invariantes relacionales fuertes (stock no puede ser negativo, un pedido referencia productos y precios congelados al momento de compra, cupones con límites de uso por usuario, reportes agregados de ventas). Esto requiere transacciones ACID reales y `SELECT ... FOR UPDATE` para controlar concurrencia en el descuento de inventario — Firestore no ofrece bloqueo pesimista ni joins nativos, y las transacciones optimistas de Firestore reintentarían agresivamente bajo alta contención (ej. un "flash sale"). Postgres es la opción correcta para "preparado para producción y escalar" en un dominio transaccional como este.
- **Drizzle ORM** *(actualizado en Fase 3, reemplaza la elección original de Prisma)*: genera tipos desde el propio schema TypeScript (coherente con TypeScript en todo el stack), maneja migraciones SQL versionadas (`drizzle-kit generate`), y previene SQL injection por diseño (queries parametrizadas vía el driver `pg`). Se usa `db.transaction` con `SELECT ... FOR UPDATE` para el descuento de stock. El cambio respecto a Prisma se explica y verifica en detalle en `docs/02-modelo-datos.md` — en resumen: este entorno de desarrollo bloquea la descarga de los binarios nativos de Prisma, lo que impedía generar el cliente o correr migraciones aquí; Drizzle es JS/TS puro y no tiene esa dependencia.
- **JWT de acceso de vida corta (15 min) + refresh token opaco almacenado en cookie `httpOnly`, `Secure`, `SameSite=Strict`, persistido hasteado en BD** (tabla `refresh_tokens`, fuera del listado mínimo del brief pero necesaria para poder revocar sesiones — logout real, no solo "olvidar el token en el cliente"). Esto da protección contra XSS (el refresh no es alcanzable por JS) y permite revocación (cosa que un JWT-only stateless no permite).
- **Wompi como pasarela principal** (elegida por el usuario): API REST directa, sandbox público, soporta PSE/tarjetas/Nequi, y su modelo de "eventos" vía webhook con firma HMAC (`checksum`) es directo de verificar e idempotencia natural apoyándose en el `id` del evento.
- **Zustand sobre Context API para estado global del carrito**: el carrito cambia con alta frecuencia (cantidad, agregar, quitar) y Context API re-renderiza todo el árbol de consumidores en cada cambio; Zustand permite selectores granulares sin ese costo, con una API mínima. Context API sí se usa para el estado de autenticación (cambia con poca frecuencia).
- **Docker Compose para desarrollo local de Postgres** (elegido por el usuario): reproducible, no depende de instalar Postgres en el host, y el mismo `docker-compose.yml` documenta la versión exacta de Postgres usada en producción.

### 2.3 Diagrama de flujo pago → pedido (crítico, con idempotencia)

```
Cliente          Backend                    Wompi                 BD
  │  POST /checkout │                          │                    │
  │─────────────────▶ crea Order (PENDING)     │                    │
  │                 │ crea PaymentIntent local  │                    │
  │                 │──────────────────────────▶ crea transacción    │
  │                 ◀────────────────────────── redirect/widget URL  │
  │◀─────────────────                          │                    │
  │  (usuario paga en Wompi)                    │                    │
  │                 │        Webhook (evento firmado) ───────────────▶│
  │                 │◀─────────────────────────                      │
  │                 │ 1. valida checksum HMAC                        │
  │                 │ 2. busca WebhookEvent por event_id (UNIQUE)     │
  │                 │    si ya existe → responde 200 y NO reprocesa   │
  │                 │ 3. transacción DB:                              │
  │                 │    - actualiza Payment.status                   │
  │                 │    - actualiza Order.status                     │
  │                 │    - si APPROVED: por cada item,                │
  │                 │      UPDATE inventory SET stock = stock - qty   │
  │                 │      WHERE stock >= qty  (bloqueo de fila)      │
  │                 │      si alguna fila no afecta ⇒ rollback total  │
  │                 │    - inserta WebhookEvent (marca procesado)     │
  │                 │ 4. encola email de confirmación                 │
```

---

## 3. Stack tecnológico final

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | SPA |
| Estilos | Tailwind CSS | + componentes propios en `components/ui` |
| Routing | React Router v6 | rutas protegidas por rol |
| Estado global | Zustand (carrito, UI) + Context (auth) | |
| Data fetching | fetch + capa `services/` con Axios | interceptor para refresh de token |
| Backend | Node.js 20 + Express + TypeScript | |
| ORM / BD | Drizzle ORM + PostgreSQL 16 *(cambiado desde Prisma en Fase 3 — ver `docs/02-modelo-datos.md`)* | migraciones SQL versionadas, sin binarios nativos |
| Auth | JWT (access) + refresh token en BD/cookie httpOnly | bcrypt para hash |
| Pagos | Wompi (sandbox → producción vía env) | patrón adapter para poder añadir Mercado Pago después |
| Emails | Resend (API key) con fallback Nodemailer/SMTP | plantillas HTML propias |
| Almacenamiento de imágenes | Cloudinary | signed upload desde backend |
| Validación | Zod (frontend y backend, esquemas compartidos en `packages/shared` si aplica) | |
| Rate limiting | `express-rate-limit` + `rate-limit-redis` (memoria en dev) | |
| Testing | Vitest + Supertest (backend), Vitest + React Testing Library (frontend) | |
| Contenedores dev | Docker Compose (Postgres, backend, frontend opcional) | |
| CI | GitHub Actions (lint + test + build) | definido en Fase 17 |

---

## 4. Estructura de carpetas

```
tiendavirtual/
├── frontend/
│   ├── src/
│   │   ├── components/       # UI reutilizable (Button, ProductCard, Rating...)
│   │   │   ├── ui/
│   │   │   ├── layout/       # Header, Footer, AdminLayout
│   │   │   └── product/, cart/, checkout/, admin/...
│   │   ├── pages/            # una carpeta por ruta (Home, Shop, ProductDetail, Cart, Checkout, Admin/*)
│   │   ├── layouts/          # StoreLayout, AdminLayout, AuthLayout
│   │   ├── hooks/            # useCart, useAuth, useProducts, useDebounce...
│   │   ├── services/         # api.ts (axios instance), auth.service.ts, product.service.ts...
│   │   ├── context/          # AuthContext
│   │   ├── store/            # cart.store.ts (zustand)
│   │   ├── utils/            # formatCurrency, validators...
│   │   ├── types/            # tipos TS compartidos con el backend (contratos de API)
│   │   ├── assets/
│   │   ├── router/           # definición de rutas + ProtectedRoute
│   │   └── App.tsx, main.tsx
│   ├── public/                # robots.txt, sitemap.xml (generado), favicon
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── controllers/      # auth, product, category, cart, order, payment, coupon, review, user, admin...
│   │   ├── routes/           # un archivo por recurso, montados en routes/index.ts
│   │   ├── services/         # lógica de negocio (product.service, inventory.service, payment.service...)
│   │   ├── middlewares/      # auth.middleware, role.middleware, error.middleware, validate.middleware, rateLimit
│   │   ├── models/           # tipos/DTOs (Prisma ya genera los modelos de BD)
│   │   ├── utils/            # jwt.ts, hash.ts, logger.ts, asyncHandler.ts
│   │   ├── config/           # env.ts (validación de variables de entorno con Zod), prisma.ts, cors.ts
│   │   ├── jobs/             # envío de emails asíncrono (cola simple)
│   │   ├── webhooks/         # wompi.webhook.ts
│   │   └── app.ts, server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── tests/
│   └── package.json
│
├── database/
│   └── docker-compose.yml     # Postgres local para desarrollo
│
├── docs/
│   ├── 01-arquitectura.md     # este archivo
│   ├── 02-modelo-datos.md
│   ├── 03-api.md
│   └── ...
│
├── .env.example
├── .gitignore
└── README.md
```

---

## 5. Modelo de datos (resumen — detalle completo en `docs/02-modelo-datos.md` y `schema.prisma`)

Entidades mínimas requeridas por el brief, todas incluidas: `users`, `roles` (enum embebido, no tabla separada — ver justificación abajo), `products`, `categories`, `product_images`, `product_variants`, `inventory`, `carts`, `cart_items`, `orders`, `order_items`, `payments`, `addresses`, `coupons`, `coupon_usages`, `reviews`, `shipments`, `audit_logs`.

Tablas adicionales necesarias para que el sistema sea *realmente* funcional (no estaban listadas explícitamente pero se derivan de los requisitos):

- `refresh_tokens`: necesarias para logout real y revocación de sesiones (requisito §17 "sesiones seguras").
- `password_reset_tokens`: necesaria para "recuperación de contraseña" (§17) sin almacenar el token en texto plano.
- `webhook_events`: necesaria para idempotencia de webhooks (§19, punto 8: "evitar procesar dos veces el mismo evento").
- `store_settings`: necesaria para el panel de configuración (§29) — evita "valores escritos en múltiples archivos".

**Nota sobre `roles`**: se implementa como `enum Role { CUSTOMER ADMIN }` en el propio modelo `User` en lugar de una tabla `roles` con relación N:N, porque el brief define un conjunto cerrado y mínimo de 2 roles. Se documenta la ruta de migración a tabla `roles` (RBAC completo) para cuando se necesiten roles adicionales (ej. `STAFF`, `WAREHOUSE`) — ver §11 "Extensibilidad futura".

Relaciones clave:

- `User 1—N Order`, `User 1—N Address`, `User 1—1 Cart` (carrito activo), `User 1—N Review`.
- `Product N—1 Category`, `Product 1—N ProductImage`, `Product 1—N ProductVariant`, `Product 1—1 Inventory` (o 1—N si el stock se lleva por variante — se lleva **por variante** cuando existen variantes, y a nivel de producto cuando no).
- `Order 1—N OrderItem`, `Order 1—1 Payment` (relación 1—1 porque un pedido se paga con una transacción; reintentos de pago generan nuevos `Payment` vinculados al mismo `Order`, por eso en la práctica es `Order 1—N Payment` con un flag de "pago exitoso" único).
- `Coupon 1—N CouponUsage`, `CouponUsage N—1 User`, `CouponUsage N—1 Order`.
- `Order 1—N Shipment` (normalmente 1, pero se modela 1—N por si se despachan pedidos parciales).

Índices planeados: `products(slug)` único, `products(category_id)`, `products(is_active, is_featured)`, `orders(user_id, created_at)`, `orders(status)`, `inventory(product_id, variant_id)` único compuesto, `coupons(code)` único, `webhook_events(provider, event_id)` único compuesto, `reviews(product_id)`.

---

## 6. Listado de API (resumen — contrato detallado en `docs/03-api.md`)

Sigue la convención `/api/<recurso>` propuesta en el brief, con adiciones necesarias para funcionalidad real (recuperación de contraseña con token, refresh de sesión, endpoints de admin separados donde el permiso lo exige, endpoints de inventario y auditoría explícitos):

```
AUTH
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/me

PRODUCTS
GET    /api/products                 (query: search, category, minPrice, maxPrice, sort, page, inStock, onSale)
GET    /api/products/:idOrSlug
POST   /api/products                 [ADMIN]
PUT    /api/products/:id             [ADMIN]
DELETE /api/products/:id             [ADMIN]
PATCH  /api/products/:id/status      [ADMIN]  (activar/desactivar)

CATEGORIES
GET    /api/categories
POST   /api/categories               [ADMIN]
PUT    /api/categories/:id           [ADMIN]
DELETE /api/categories/:id           [ADMIN]

CART
GET    /api/cart
POST   /api/cart/items
PUT    /api/cart/items/:itemId
DELETE /api/cart/items/:itemId
POST   /api/cart/coupon
DELETE /api/cart/coupon

ORDERS
POST   /api/orders                   (crea orden desde el carrito -> checkout)
GET    /api/orders                   (propias del usuario, o todas si ADMIN)
GET    /api/orders/:id
PUT    /api/orders/:id/status        [ADMIN]

PAYMENTS
POST   /api/payments/create
POST   /api/payments/webhook/wompi   (público, verificado por firma)

USERS
GET    /api/users                    [ADMIN]
GET    /api/users/:id                [ADMIN o self]
PUT    /api/users/:id                [self o ADMIN]
GET    /api/users/:id/orders

ADDRESSES
GET    /api/addresses
POST   /api/addresses
PUT    /api/addresses/:id
DELETE /api/addresses/:id

COUPONS
POST   /api/coupons/validate
GET    /api/coupons                  [ADMIN]
POST   /api/coupons                  [ADMIN]
PUT    /api/coupons/:id              [ADMIN]
DELETE /api/coupons/:id              [ADMIN]

REVIEWS
GET    /api/products/:id/reviews
POST   /api/products/:id/reviews     (solo compradores verificados)
PUT    /api/reviews/:id/moderate     [ADMIN]

INVENTORY
GET    /api/inventory                [ADMIN]
POST   /api/inventory/adjust         [ADMIN]

SHIPMENTS
GET    /api/orders/:id/shipment
PUT    /api/orders/:id/shipment      [ADMIN]

ADMIN DASHBOARD
GET    /api/admin/dashboard/summary
GET    /api/admin/dashboard/sales-chart

SETTINGS
GET    /api/settings
PUT    /api/settings                 [ADMIN]

AUDIT
GET    /api/admin/audit-logs         [ADMIN]
```

---

## 7. Riesgos de seguridad identificados y mitigación

| Riesgo | Mitigación |
|---|---|
| Overselling por condición de carrera en compras simultáneas | Transacción SQL con `UPDATE inventory SET stock = stock - qty WHERE stock >= qty`, verificando `rowCount` afectado; si es 0, se aborta el pedido antes de marcarlo pagado. |
| Reprocesamiento de webhooks (pagos duplicados, doble descuento) | Tabla `webhook_events` con constraint único `(provider, event_id)`; el handler responde 200 idempotente si el evento ya fue visto. |
| Falsificación de webhook (alguien llama al endpoint directamente) | Verificación de firma HMAC (`checksum`) provista por Wompi contra el secreto `WOMPI_EVENTS_SECRET`, antes de procesar cualquier dato del payload. |
| Robo de tokens vía XSS | Access token JWT de vida corta en memoria (no localStorage); refresh token en cookie `httpOnly` + `Secure` + `SameSite`. |
| Inyección SQL | Prisma con queries parametrizadas; sin SQL crudo salvo casos puntuales documentados y siempre parametrizados. |
| XSS almacenado (ej. reseñas, descripciones) | Sanitización de entrada (biblioteca `sanitize-html` en campos de texto libre) + Content-Security-Policy vía `helmet`. |
| CSRF | API stateless con Bearer token para mutaciones; la única cookie (refresh) se usa solo en `/api/auth/refresh` con `SameSite=Strict`, lo que reduce la superficie; se añade doble verificación de origen (`Origin`/`Referer`) en ese endpoint. |
| Escalado de privilegios (usuario intenta acceder a `/admin`) | Middleware `requireRole('ADMIN')` en backend en cada ruta administrativa (nunca solo en frontend); frontend oculta la UI pero el backend es la autoridad real. |
| Fuerza bruta en login / reset de contraseña | Rate limiting específico por IP+email en `/api/auth/login`, `/api/auth/forgot-password`. |
| Exposición de datos sensibles en errores | Middleware de errores global: en producción nunca se devuelve stack trace ni mensaje interno crudo; se loguea internamente con un id de correlación que sí se muestra al usuario para soporte. |
| Datos de tarjeta en nuestros sistemas | Nunca se reciben en backend ni se persisten; el flujo de pago tokeniza/redirige directamente a Wompi. |
| Precio manipulado desde el cliente | El precio y el stock se leen siempre desde la BD al crear la orden; el frontend nunca envía precios que el backend confíe ciegamente. |
| Cupón inválido aceptado solo por el frontend | Validación de cupón repetida en backend al crear la orden (fecha, uso máximo, uso por usuario, compra mínima), independientemente de la validación previa en `/api/coupons/validate`. |

---

## 8. Dependencias externas y qué se necesita del usuario

| Servicio | Para qué | Variable de entorno | Dónde obtenerla |
|---|---|---|---|
| PostgreSQL | Base de datos | `DATABASE_URL` | Local: Docker Compose (incluido). Producción: Railway/Render/Neon/Supabase. |
| Wompi | Procesar pagos (PSE, tarjetas, Nequi) | `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET` | Panel de comercio Wompi (sandbox: `https://comercios.wompi.co`, modo pruebas) |
| Resend (o SMTP) | Emails transaccionales | `EMAIL_API_KEY`, `EMAIL_FROM` | resend.com, o credenciales SMTP propias |
| Cloudinary | Almacenamiento de imágenes de productos | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | cloudinary.com |
| JWT | Firmar tokens de sesión | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Generados localmente (`openssl rand -base64 48`), documentado en README |

**Importante**: mientras no tengas las claves reales de Wompi/Cloudinary/Resend, el sistema se construye completo y funcional contra esos proveedores, usando el modo *sandbox* de cada uno (Wompi tiene llaves públicas de sandbox documentadas y gratuitas para pruebas: `pub_test_...`). El código nunca "simula" estas integraciones con datos falsos — llama a las APIs reales en modo prueba. Te indicaré exactamente en qué archivo `.env` pegar cada clave cuando lleguemos a la Fase 10.

---

## 9. Decisiones pendientes de bajo riesgo (asumidas, ajustables después)

Para no bloquear el avance, se asumen estos valores por defecto — todos configurables luego desde `/admin/settings` o variables de entorno:

- Moneda: COP.
- Impuesto: IVA 19% aplicado a nivel de producto (configurable, se puede desactivar por producto).
- Métodos de envío iniciales: Estándar, Express, Recogida en tienda (con costos configurables en `store_settings`).
- Idioma: español (es-CO).

---

## 10. Plan de fases (confirmado)

1. ✅ Análisis y arquitectura (este documento)
2. Estructura del proyecto
3. Base de datos y modelos (Prisma)
4. Backend y API REST
5. Frontend base
6. Autenticación y roles
7. Catálogo y productos
8. Carrito
9. Checkout
10. Integración de pagos (Wompi) + webhooks idempotentes
11. Panel administrativo (dashboard)
12. Inventario, pedidos, categorías, clientes, cupones, reseñas, envíos (admin)
13. Emails y notificaciones
14. Seguridad
15. Pruebas automatizadas
16. Optimización, SEO y seeders
17. Documentación y despliegue

Cada fase se entrega con código real y ejecutable (no mockups), y se autorevisa antes de avanzar a la siguiente.

---

## 11. Extensibilidad futura (ya contemplada en el diseño)

- **App móvil**: la API REST ya es agnóstica de cliente; solo requeriría CORS adicional y quizá refresh vía header en lugar de cookie para apps nativas.
- **Multivendedor / marketplace**: `Product` ya referencia un dueño potencial (`sellerId` nullable reservado); migrar a marketplace implica añadir tabla `sellers` y filtrar por vendedor en pedidos.
- **Roles adicionales / RBAC granular**: migrar el enum `Role` a tabla `roles` + `permissions` sin romper el middleware actual (misma interfaz `requireRole`).
- **Facturación electrónica**: `Order` ya almacena todos los totales desglosados (subtotal, descuento, envío, impuestos) necesarios para generar el XML/UBL de la DIAN.
- **WhatsApp / notificaciones**: el módulo `jobs/` de envío de emails se diseña como cola desacoplada; añadir un canal de WhatsApp es otro "worker" que consume los mismos eventos de dominio (`order.created`, `order.shipped`...).
- **Recomendaciones / IA**: `reviews`, `order_items` e historial de navegación (a futuro) ya dan la base de datos de interacciones necesaria para un motor de recomendación posterior.

---

## Autorevisión de la Fase 1

Qué corregiría o vigilaría antes de considerar esto "definitivo":

- La relación `Order—Payment` la describo como 1—1 "conceptual" pero 1—N en la práctica (reintentos). En el schema real (Fase 3) modelaré explícitamente `Order 1—N Payment` con un campo `orders.paid_payment_id` opcional para evitar ambigüedad — lo dejo anotado aquí para no perderlo.
- El manejo de sesión con cookie `httpOnly` para el refresh token funciona bien para el frontend web propio, pero si más adelante se prioriza "app móvil" antes de tiempo, habrá que soportar también refresh vía body/header — no es un problema ahora, pero lo documento como decisión revisable.
- Elegí llevar el stock a nivel de variante cuando existan variantes; esto significa que un producto "simple" sin variantes necesita igualmente una fila de inventario "implícita" — lo resolveré en el modelo de datos creando siempre al menos una variante por defecto, para no tener dos caminos de código distintos (con/sin variantes) en el descuento de stock.
- El punto más riesgoso de todo el proyecto es la Fase 10 (pagos + concurrencia de inventario). Ahí pondré pruebas automatizadas específicas de condición de carrera, no solo pruebas felices.
