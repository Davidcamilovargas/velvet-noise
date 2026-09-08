# 05 — Verificación final del proyecto

Cierre de las 17 fases (`docs/01-arquitectura.md`, sección 10). Este
documento resume lo que se verificó en ejecución real al terminar la
última fase — no es una re-descripción de las features (eso ya está en
`docs/03-api.md`, fase por fase), sino la comprobación de que, todas
juntas, siguen funcionando de punta a punta.

## Qué se verificó y cómo

**Suite automatizada completa, corrida de nuevo al cierre del proyecto:**

```
✅ Backend:  77/77 tests (Vitest + Supertest, contra Postgres real)
✅ Frontend: 44/44 tests (Vitest + Testing Library)
✅ E2E:       9/9  tests (Playwright + Chromium real, navegador + frontend +
              backend + Postgres reales, sin mocks en ninguna capa)
✅ npm audit --omit=dev: 0 vulnerabilidades (backend y frontend)
✅ tsc -b --noEmit y eslint: limpios en ambos paquetes (solo warnings
   preexistentes ya documentados: 3 `any` en relaciones de Drizzle,
   1 de react-refresh en AuthContext — ninguno es un error)
✅ vite build: exitoso, con el chunk de vendor separado (Fase 16)
```

**Verificación manual en vivo, con navegador real (Playwright, fuera de la
suite automatizada — para confirmar visualmente lo que las aserciones de
los tests ya cubren de forma más estrecha), contra el backend y frontend de
desarrollo corriendo con datos reales del seeder de la Fase 16:**

- `GET /sitemap.xml`: XML válido generado en vivo desde los productos y
  categorías activos reales de Postgres.
- `frontend/public/robots.txt`: servido tal cual, con las reglas
  `Disallow` esperadas y la línea `Sitemap:`.
- Página de catálogo (`/shop`): lista productos reales sembrados por
  `npm run seed`.
- Página de detalle de producto (`/product/:slug`): `<title>` con el
  patrón `Nombre | Velvet Noise`, `og:image` con la imagen real del
  producto, y JSON-LD `Product` completo con nombre, descripción, imagen,
  SKU, precio y disponibilidad reales — no valores de relleno.
- `/checkout` sin sesión: redirige a `/login` (ruta protegida
  funcionando).
- `/admin` sin sesión: redirige a `/login` (panel administrativo
  protegido).

**Configuración de despliegue (Fase 17):**

- `docker compose config` (con un `.env` de prueba copiado de
  `.env.example`) valida sin errores: los tres servicios
  (`postgres`/`backend`/`frontend`) resuelven correctamente, y
  `DATABASE_URL` del backend queda sobreescrito para apuntar al servicio
  `postgres` de la red interna de Docker en vez de `localhost` — la
  variable de entorno más fácil de dejar mal en un compose de varios
  servicios.
- Los `Dockerfile` de `backend/` y `frontend/` se revisaron línea por línea
  (multi-stage, usuario sin privilegios, healthcheck, orden de capas para
  aprovechar la caché de Docker). **Limitación honesta:** el entorno de
  desarrollo donde se construyó este proyecto no tiene salida de red hacia
  Docker Hub, así que no fue posible ejecutar `docker build` realmente
  aquí — la validación de la sintaxis del compose sí se pudo hacer, pero
  no un build real de las imágenes. El workflow de CI
  (`.github/workflows/ci.yml`) no incluye tampoco un paso de
  `docker build` (ver la justificación en `docs/04-despliegue.md`, sección
  4) — la primera vez que las imágenes se construyan de verdad será en la
  plataforma de despliegue elegida (sección 2 o 3 de esa misma guía). Se
  recomienda, como parte de la puesta en producción, correr
  `docker compose up -d --build` una vez en un entorno con acceso a
  internet normal y confirmar que los tres contenedores llegan a estado
  `healthy` antes de considerar el despliegue completo.

## Limitaciones conocidas (documentadas, no ocultas)

- **Wompi**: la integración (firma de integridad, verificación de firma de
  webhooks, descuento atómico de inventario) está completa y probada con
  las herramientas de prueba de Wompi (Fase 10, `backend/tests/payment.test.ts`),
  pero la apertura real del widget de pago en el navegador contra
  credenciales de producción no se pudo probar en este entorno por no
  tener una cuenta de comercio real de Wompi — queda para la primera
  prueba con credenciales reales en un entorno con salida a internet hacia
  `checkout.wompi.co`.
- **Emails**: los correos transaccionales están conectados a cada evento de
  negocio (Fase 13) y se probaron contra la API de Resend, pero sin una
  cuenta de Resend con dominio verificado en este entorno, no se confirmó
  la entrega real a una bandeja de entrada — solo que la llamada a la API
  se hace correctamente y con el contenido correcto.
- **Datos de prueba acumulados en la base de datos de desarrollo**: a lo
  largo de las 17 fases, distintas verificaciones manuales dejaron algunos
  registros de prueba sueltos en la base de datos de este entorno de
  desarrollo (categorías/cupones con nombres como "Cat X-<timestamp>",
  visibles por ejemplo en la salida de `GET /sitemap.xml`). No afecta al
  código ni a un despliegue nuevo con una base de datos limpia — es cruft
  de este entorno de desarrollo puntual, no del producto. Si se sigue
  usando esta misma base de datos como entorno de demo, vale la pena
  limpiarla antes de mostrarla.

## Conclusión

Las 17 fases están implementadas con código real y ejecutable, verificadas
en ejecución (no solo revisadas por lectura), sin `TODO`s pendientes en
funcionalidad crítica ni datos simulados en lugar de la base de datos real
— consistente con el requisito que guio todo el proyecto desde la Fase 1.
Lo que queda pendiente de verificar son, específicamente, las dos
integraciones externas que requieren credenciales reales de terceros
(Wompi en producción, un dominio verificado en Resend) y un build de
Docker real en un entorno con salida a internet — ambas cosas quedan
documentadas arriba y en `docs/04-despliegue.md` como parte de la
checklist de puesta en producción, no como trabajo sin terminar del lado
del código.
