# Contrato de la API

Se documenta cada grupo de endpoints en el momento en que se implementa (evita que el documento describa algo que el código todavía no hace). Formato de respuesta consistente en todo el backend:

- Éxito: `{ "data": ... }` (y `"pagination": {...}` en listados paginados).
- Error: `{ "error": { "message": "...", "code": "...", "correlationId": "..." } }` — ver `backend/src/middlewares/error.middleware.ts`.

## AUTH (`/api/auth`) — implementado en la Fase 6

| Método | Ruta | Auth | Rate limit | Descripción |
|---|---|---|---|---|
| POST | `/api/auth/register` | No | 10/15min por IP | Crea una cuenta `CUSTOMER`. Devuelve `{ user, accessToken }` y setea cookie `refreshToken` (httpOnly). |
| POST | `/api/auth/login` | No | 10/15min por IP | Verifica credenciales. Mismo formato de respuesta que register. |
| POST | `/api/auth/refresh` | Cookie `refreshToken` | — | Rota el refresh token (revoca el usado, emite uno nuevo) y devuelve un access token nuevo. |
| POST | `/api/auth/logout` | Cookie `refreshToken` | — | Revoca el refresh token actual y limpia la cookie. |
| POST | `/api/auth/forgot-password` | No | 5/hora por IP | Genera un token de recuperación (1h de validez) y lo envía por correo. Responde el mismo mensaje exista o no el correo (anti-enumeración). |
| POST | `/api/auth/reset-password` | No | 5/hora por IP | Cambia la contraseña con un token válido y no usado. Revoca todas las sesiones activas del usuario. |
| GET | `/api/auth/me` | Bearer access token | — | Devuelve el usuario autenticado. |

### Detalles de seguridad verificados en esta fase

- Contraseñas: `bcrypt` con 12 rounds (`backend/src/utils/hash.ts`). Nunca se registra ni se devuelve el hash al cliente.
- Contraseña mínima: 8 caracteres, mayúscula, minúscula y número (`backend/src/validators/auth.validators.ts`), validado en backend independientemente de cualquier validación en el frontend.
- Access token: JWT firmado (`JWT_ACCESS_SECRET`), vida corta (15 min por defecto), viaja en memoria en el frontend (nunca en `localStorage`).
- Refresh token: opaco (no JWT), se persiste solo su hash SHA-256 en `refresh_tokens`, viaja en cookie `httpOnly` + `SameSite=Strict`, con rotación en cada uso (revoca el anterior, emite uno nuevo) — limita el daño de un token filtrado.
- Recuperación de contraseña: mismo patrón (token opaco, solo se guarda el hash, expira en 1 hora, un solo uso). Al completarse, se revocan todas las sesiones activas del usuario.
- Mensajes de error genéricos donde aplica ("correo o contraseña incorrectos", nunca "el correo no existe") para no facilitar enumeración de cuentas.
- `requireAuth`/`requireRole` (`backend/src/middlewares/`) son la única autoridad real de acceso — probado con tests que confirman 401 sin token y 401 con token inválido.

### Verificado end-to-end en esta fase (backend)

```
✅ Registro → login → /me con token
✅ Registro duplicado → 409 EMAIL_TAKEN
✅ Login con contraseña incorrecta → 401
✅ Refresh rota el token y el token viejo deja de servir tras logout
✅ Logout revoca la sesión (refresh posterior → 401)
✅ Forgot-password genera token real, reset-password lo consume y cambia la contraseña
✅ Login con la contraseña vieja tras el reset → 401; con la nueva → 200
✅ 10/10 tests automatizados (Vitest + Supertest) pasando contra Postgres real
```

### Frontend (Fase 6)

- `AuthContext` (`frontend/src/context/AuthContext.tsx`): intenta renovar la sesión al montar la app (usa la cookie de refresh si existe), expone `login`, `register`, `logout`.
- Interceptor Axios (`frontend/src/services/api.ts`): ante un 401 en cualquier petición autenticada, intenta renovar el access token una vez y reintenta la petición original; si falla, limpia el estado de sesión.
- `ProtectedRoute` (`frontend/src/router/ProtectedRoute.tsx`): protege `/checkout`, `/orders`, `/profile` (requiere sesión) y `/admin` (requiere rol `ADMIN`) — mejora de UX, nunca la única barrera real (esa es el backend).
- Páginas reales conectadas al backend: Login, Register, ForgotPassword, ResetPassword, Profile (no son maquetas — cada una llama a su endpoint real y maneja estados de carga/error).

## CATEGORIES (`/api/categories`) — implementado en la Fase 7

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/categories` | No (opcional) | Lista categorías activas. Con `?all=true` y sesión `ADMIN`, incluye inactivas. |
| POST | `/api/categories` | ADMIN | Crea una categoría (genera `slug` único automáticamente). |
| PUT | `/api/categories/:id` | ADMIN | Actualiza una categoría. |
| DELETE | `/api/categories/:id` | ADMIN | Elimina una categoría. Si tiene productos asociados, responde 409 (`CATEGORY_HAS_PRODUCTS`) sugiriendo desactivarla en su lugar. |

## PRODUCTS (`/api/products`) — implementado en la Fase 7

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/products` | No (opcional) | Lista paginada con filtros: `search`, `category` (slug), `minPrice`, `maxPrice`, `sort` (`price_asc`\|`price_desc`\|`newest`\|`popularity`), `inStock`, `onSale`, `featured`, `page`, `pageSize`. Con `?all=true` y sesión `ADMIN`, incluye productos inactivos. |
| GET | `/api/products/:idOrSlug` | No (opcional) | Detalle completo: imágenes, variantes con su stock, categoría y hasta 4 productos relacionados (misma categoría). |
| POST | `/api/products` | ADMIN | Crea un producto. Genera `slug`/`sku` únicos si no se envían. Si no se envían `variants`, crea una variante `default` con el `stock` indicado — todo producto tiene siempre al menos una variante (ver `docs/02-modelo-datos.md`). |
| PUT | `/api/products/:id` | ADMIN | Actualiza campos del producto (nombre, precio, categoría, estado, dimensiones). La edición de imágenes/variantes/stock individuales se construye en la Fase 12 junto al resto del panel administrativo. |
| PATCH | `/api/products/:id/status` | ADMIN | Activa/desactiva un producto (`{ "isActive": boolean }`). |
| DELETE | `/api/products/:id` | ADMIN | Elimina un producto. Si tiene pedidos asociados, responde 409 (`PRODUCT_HAS_ORDERS`) sugiriendo desactivarlo en su lugar. |

### Notas de implementación

- Búsqueda insensible a tildes y mayúsculas (`unaccent` + `ILIKE` de PostgreSQL) — "audifonos" encuentra "Audífonos". La extensión se habilita automáticamente en `npm run db:migrate`.
- El stock de un producto es la suma del stock de todas sus variantes (`inventory.stock` agregado). El filtro `inStock` y el ordenamiento se resuelven trayendo un conjunto acotado (≤500) desde SQL y filtrando/paginando en memoria — una simplificación razonable para el tamaño de catálogo de este proyecto, revisable en la Fase 24 (rendimiento) si el catálogo crece mucho.
- Todas las mutaciones (crear/editar/eliminar) están protegidas con `requireAuth` + `requireRole("ADMIN")` en el backend — verificado con tests que confirman 403 para clientes sin ese rol.

### Verificado end-to-end en esta fase

```
✅ CRUD de categorías y productos (con variantes reales: color/talla, stock por variante)
✅ Producto sin variantes → crea automáticamente una variante "default"
✅ Búsqueda, filtro por categoría, por precio, por disponibilidad, por oferta
✅ Orden por precio asc/desc, novedades, popularidad
✅ Paginación
✅ 404 en producto inexistente o inactivo; 403 para mutaciones sin rol ADMIN; 422 en precio inválido
✅ 18/18 tests automatizados (Vitest + Supertest) pasando contra Postgres real
✅ Frontend verificado con navegador real (Playwright/Chromium): Home, Shop (con búsqueda),
   detalle de producto (selección de variante, agregar al carrito actualiza el contador del header)
```

## CART (`/api/cart`) — implementado en la Fase 8

Todas las rutas requieren sesión (`requireAuth`). El carrito de **invitados** es intencionalmente
100% local (Zustand + localStorage en el frontend) y nunca toca el backend — solo al iniciar
sesión se sincroniza (ver "Sincronización invitado → autenticado" más abajo). Esto evita crear
carritos huérfanos en la base de datos para visitantes que nunca se registran.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/cart` | Devuelve el carrito del usuario con precios **recalculados en vivo** (no congelados): subtotal, descuento (si hay cupón aplicado), impuestos (`store_settings.taxPercentage`, 19% por defecto), y total. El envío siempre es `0` aquí — se calcula en el checkout (Fase 9) según el método elegido. Cada línea incluye `exceedsStock` si la cantidad guardada ya no cabe en el stock actual. |
| POST | `/api/cart/items` | Agrega un ítem. Body: `{ productId, variantId?, quantity }`. Si el producto tiene una sola variante, `variantId` es opcional (se resuelve automáticamente). Si ya existe la línea, incrementa la cantidad en vez de duplicarla. Valida contra el stock **en vivo** de `inventory` → 409 (`INSUFFICIENT_STOCK`) si no alcanza. |
| PUT | `/api/cart/items/:itemId` | Cambia la cantidad de una línea. `quantity <= 0` es rechazado (422) — para quitar un ítem se usa DELETE. |
| DELETE | `/api/cart/items/:itemId` | Elimina una línea del carrito. |
| POST | `/api/cart/coupon` | Aplica un cupón por código (case-insensitive). Ejecuta la validación completa: existe → activo → dentro de vigencia → cumple compra mínima → no superó el máximo de usos global ni por usuario. Devuelve 422 (`COUPON_INVALID`) con un motivo legible si falla cualquier chequeo. |
| DELETE | `/api/cart/coupon` | Quita el cupón aplicado al carrito (sin borrar el cupón en sí). |
| POST | `/api/cart/merge` | Fusiona líneas de un carrito de invitado (enviadas desde localStorage) hacia el carrito real del backend tras el login/registro. Une por `productId`/`variantId`; una línea inválida (p. ej. producto descontinuado) se ignora sin abortar el resto del merge. |

### Sincronización invitado → autenticado (frontend)

- `useAddToCart()` (`frontend/src/hooks/useAddToCart.ts`) decide en cada "agregar al carrito" si el usuario está autenticado: si no, escribe en el store local (Zustand); si sí, llama al backend real y actualiza `backendItemCount`.
- Al hacer login/registro, o al restaurar sesión al recargar la página, `AuthContext.syncCartAfterLogin()` envía las líneas locales a `POST /api/cart/merge` (o simplemente trae el carrito existente si no había líneas locales) y vacía el store local — a partir de ahí el backend es la única fuente de verdad para ese usuario en esa sesión.
- El contador del carrito en el header (`Header.tsx`) usa el store local para invitados y `backendItemCount` para usuarios autenticados — nunca se mezclan.
- Si la sincronización falla (backend momentáneamente no disponible), el login no se bloquea: el usuario conserva su carrito local hasta el próximo intento.

## COUPONS (`/api/coupons`) — implementado en la Fase 8

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/coupons` | ADMIN | Lista todos los cupones. |
| POST | `/api/coupons` | ADMIN | Crea un cupón (código único, tipo `PERCENTAGE`\|`FIXED`, vigencia, compra mínima, máximo de usos global/por usuario). |
| PATCH | `/api/coupons/:id/status` | ADMIN | Activa/desactiva un cupón. |
| DELETE | `/api/coupons/:id` | ADMIN | Elimina un cupón. Si algún carrito lo tiene aplicado (pero no consumido — el consumo real se registra en `coupon_usages` solo al crear un pedido), se desvincula automáticamente de esos carritos antes de borrar, en vez de bloquear el borrado con un error de llave foránea. |

La aplicación de un cupón a un carrito (`POST /api/cart/coupon`) vive bajo `CART` arriba, no aquí,
porque semánticamente pertenece al carrito del usuario.

### Notas de implementación

- El precio del carrito **nunca se calcula ni se confía en el frontend** — `GET /api/cart` siempre recalcula desde la base de datos (precio actual del producto/variante, stock actual, cupón vigente), así que un precio desactualizado en caché nunca puede usarse para pagar de menos.
- Bug corregido durante el desarrollo: el lookup del cupón en `cart.service.ts` comparaba `carts.couponId` contra sí mismo en vez de contra `coupons.id` — detectado y corregido antes de que llegara a producción.
- Bug corregido durante el desarrollo: borrar un cupón que un carrito tenía "aplicado" (no "usado") violaba una restricción de llave foránea — corregido desvinculando el cupón de esos carritos antes de eliminarlo (ver tabla de arriba).

### Verificado end-to-end en esta fase

```
✅ Acceso sin sesión → 401 en todas las rutas de /api/cart
✅ Carrito vacío para usuario nuevo
✅ Agregar ítem, exceder stock → 409 (INSUFFICIENT_STOCK)
✅ Cambiar cantidad, eliminar línea
✅ Aplicar cupón fijo (código normalizado sin distinguir mayúsculas/minúsculas)
✅ Cupón inexistente → 400 (COUPON_NOT_FOUND) con motivo legible
✅ 8/8 tests automatizados (Vitest + Supertest) pasando contra Postgres real
✅ Frontend: `tsc --noEmit` limpio, `vite build` exitoso (code-splitting del chunk de Carrito intacto), lint limpio
✅ Flujo E2E con navegador real (Playwright/Chromium), sin datos simulados:
   invitado agrega un producto real → contador del header sube a 1 (carrito local) →
   inicia sesión con un usuario real → el carrito se fusiona con el backend →
   el ítem aparece en la vista de carrito autenticado → el contador refleja el backend →
   persiste tras recargar la página → al cerrar sesión el contador vuelve a desaparecer
   (9/9 verificaciones pasadas)
```

## ADDRESSES (`/api/addresses`) — implementado en la Fase 9

Todas las rutas requieren sesión (`requireAuth`). Cada usuario solo puede ver/editar/borrar sus propias direcciones.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/addresses` | Lista las direcciones guardadas del usuario (la predeterminada primero). |
| POST | `/api/addresses` | Crea una dirección. La primera dirección de un usuario se marca predeterminada automáticamente aunque no se pida explícitamente. |
| PUT | `/api/addresses/:id` | Actualiza una dirección propia. Si se marca `isDefault: true`, desmarca cualquier otra. |
| DELETE | `/api/addresses/:id` | Elimina una dirección propia. Si era la predeterminada y quedan otras, promueve automáticamente la más reciente. |

## SHIPPING-METHODS (`/api/shipping-methods`) — implementado en la Fase 9

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/shipping-methods` | No | Lista los métodos de envío disponibles (`STANDARD`\|`EXPRESS`\|`PICKUP`) con su etiqueta, precio y tiempo estimado. Público porque el checkout necesita mostrar precios antes de que el usuario confirme el pedido. |

Las tarifas salen de `store_settings.shipping_methods` (JSON); si el admin todavía no las configuró (la UI de configuración es de la Fase 12), se usan valores por defecto razonables (`STANDARD` $12.000, `EXPRESS` $25.000, `PICKUP` gratis) — mismo patrón que `getTaxPercentage()` en `cart.service.ts`.

## ORDERS (`/api/orders`) — implementado en la Fase 9

Todas las rutas requieren sesión (`requireAuth`) — no existe checkout de invitado (el carrito de invitado tampoco toca el backend, ver Fase 8, así que un invitado siempre pasa por login antes de llegar aquí).

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/orders` | Crea un pedido real a partir del carrito actual del usuario. Body: `{ shippingMethod, addressId? \| newAddress?, customerPhone, notes? }` (`addressId`/`newAddress` no se exigen si `shippingMethod` es `PICKUP`). Revalida el carrito completo contra la base de datos (nunca confía en subtotales calculados previamente), calcula el envío según el método elegido, aplica el cupón vigente si el carrito tenía uno, y vacía el carrito. |
| GET | `/api/orders` | Lista los pedidos del usuario autenticado (o todos, si es `ADMIN`), más recientes primero. |
| GET | `/api/orders/:id` | Detalle de un pedido. Un `CUSTOMER` que pide el pedido de otro usuario recibe 404 (no 403 — no se confirma que el pedido exista). |

`PUT /api/orders/:id/status` (cambiar el estado de un pedido) es funcionalidad de gestión administrativa y se agrega en la Fase 12 junto al resto del panel admin — no existe todavía.

### Notas de implementación

- **El inventario NO se descuenta al crear el pedido.** Es una decisión de diseño explícita, no una omisión: descontar stock en el checkout reservaría inventario indefinidamente para pedidos que nunca llegan a pagarse. El pedido queda `status: PENDING` / `paymentStatus: PENDING`; el descuento atómico de stock (con bloqueo de fila para evitar sobreventa entre compradores concurrentes) se implementa en la **Fase 10**, en el momento en que el pago se confirma vía webhook. Lo que sí se valida en el checkout, dos veces (una en `getCart()` y otra dentro de la transacción de creación del pedido, para cerrar la ventana de carrera entre ambas), es que el stock **actual** alcance para lo pedido — si cambió (otro comprador se lo llevó, el admin lo ajustó), la creación del pedido falla con 409 (`CART_STOCK_CHANGED`) en vez de aceptar un pedido incumplible.
- El cupón, en cambio, sí se considera "usado" (`coupon_usages`) al **crear** el pedido, no al pagarlo — así un mismo cupón de un solo uso no se puede aplicar a dos pedidos simultáneos del mismo usuario, aunque ninguno se haya pagado todavía.
- Cada línea del pedido (`order_items`) es una **fotografía** (nombre, SKU, precio unitario) del producto en el momento de la compra — si el producto cambia de precio o se renombra después, los pedidos ya creados no se alteran.
- `addressSnapshot` (JSON) guarda una copia de la dirección usada (o `{ pickup: true, storeAddress }` si el método es recoger en tienda) — independiente de si esa dirección se conserva, se edita o se borra después en `/api/addresses`.
- La primera dirección de un usuario se guarda como predeterminada automáticamente; el checkout la preselecciona.

### Verificado end-to-end en esta fase

```
✅ CRUD de direcciones, con manejo correcto de "predeterminada" (una sola a la vez, se promueve otra al borrar la actual)
✅ Métodos de envío públicos con tarifas configurables (valores por defecto documentados)
✅ Rechaza pedido con carrito vacío (400) y envío STANDARD/EXPRESS sin dirección (422)
✅ Crea pedido real: dirección guardada, cálculo correcto de envío/impuestos/total, vacía el carrito
✅ Pedido PICKUP sin necesitar dirección, envío $0
✅ Rechaza un pedido cuyo stock cambió desde que se agregó al carrito (409 CART_STOCK_CHANGED) — revalidación en vivo, no confía en el carrito calculado antes
✅ Aplica cupón al pedido, registra su uso; un cupón de un solo uso ya no se puede reaplicar después (COUPON_MAX_USES_PER_USER)
✅ Lista pedidos propios; el detalle de un pedido ajeno devuelve 404 (no revela su existencia)
✅ 14/14 tests automatizados (Vitest + Supertest) pasando contra Postgres real — 40/40 en la suite completa del backend
✅ Frontend: `tsc --noEmit` limpio, `vite build` exitoso (chunks de Checkout/Orders/OrderDetail con code-splitting), lint limpio
✅ Flujo E2E con navegador real (Playwright/Chromium), sin datos simulados, dos veces (dirección guardada y PICKUP):
   login → agrega producto real al carrito → checkout con dirección nueva (se guarda automáticamente) →
   confirma pedido → página de confirmación con el pedido real (número, producto, "Pendiente de pago") →
   el carrito queda vacío → el pedido aparece en "Mis pedidos" → la dirección aparece guardada en el perfil;
   y por separado: al elegir "Recoger en tienda" la sección de dirección desaparece y el pedido se crea sin ella
   (11/11 + 2/2 verificaciones pasadas)
```

## PAYMENTS (`/api/payments`) — implementado en la Fase 10

Integración real con **Wompi** (pasarela de pago principal para Colombia, elegida en la Fase 1). El mecanismo elegido es el **Widget Checkout** de Wompi: el navegador del cliente abre un widget alojado por Wompi (`https://checkout.wompi.co/widget.js`) donde se ingresa la tarjeta — nuestro backend calcula una firma de integridad para autorizar esa apertura, pero nunca ve ni recibe un número de tarjeta o CVV (regla de seguridad §14 del proyecto). La API real de Wompi (`POST /v1/transactions`) tampoco se llama desde nuestro backend: todo el procesamiento del pago ocurre en la infraestructura de Wompi.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/payments/create` | Requerida | Prepara un nuevo intento de pago para un pedido propio: genera una `reference` única, calcula la firma de integridad SHA256 (`reference + amountInCents + currency + integritySecret`) y registra el intento (`payments`, `status: PENDING`). Responde 409 si el pedido ya fue pagado, 503 (`WOMPI_NOT_CONFIGURED`) si el comercio no tiene las llaves de Wompi configuradas todavía. |
| POST | `/api/payments/webhook/wompi` | Pública, verificada por firma | Recibe las notificaciones de Wompi sobre cambios de estado de una transacción (`transaction.updated`). Nunca requiere sesión — la autenticidad se garantiza verificando `signature.checksum` contra el `WOMPI_EVENTS_SECRET`, no con JWT. |

### El mecanismo de firma (verificado contra la documentación oficial de Wompi, no memorizado)

- **Firma de integridad** (para abrir el widget): `SHA256(reference + amountInCents + currency + WOMPI_INTEGRITY_SECRET)`.
- **Firma de eventos** (para verificar un webhook): se toman los valores de `signature.properties` (una lista que el propio evento indica — Wompi advierte que puede cambiar, así que nunca se asume fija), se concatenan en ese orden, se les agrega el `timestamp` del evento y el `WOMPI_EVENTS_SECRET`, y se calcula SHA256; el resultado debe coincidir (comparación en tiempo constante) con `signature.checksum`.
- Ver `backend/src/services/wompi.service.ts` para la implementación exacta y las fuentes citadas en los comentarios del archivo.

### Webhooks idempotentes (nunca se procesa el mismo evento dos veces)

Cada notificación de Wompi se registra en `webhook_events` con un `eventId` sintético = `` `${transactionId}:${status}` `` (combina la transacción Y su estado, porque una misma transacción pasa por varios estados —p. ej. `PENDING` → `APPROVED`— y cada transición sí debe procesarse; lo que nunca debe repetirse es la *misma* transición). El índice único `(provider, event_id)` hace que un segundo intento de insertar el mismo evento falle con una violación de restricción, que se interpreta como "ya procesado" y se responde 200 sin repetir ningún efecto — así, si Wompi reintenta la entrega (lo hace hasta 3 veces si no recibe 2xx), nunca se descuenta el inventario dos veces por el mismo pago.

### El punto más riesgoso del proyecto: inventario sin sobreventa

Como se documentó en la Fase 9, el inventario **no** se descuenta al crear el pedido — se descuenta aquí, de forma atómica, cuando el pago se **aprueba**:

1. Dentro de una transacción de base de datos, se bloquean con `SELECT ... FOR UPDATE` las filas de `inventory` de cada variante del pedido, en orden, **antes** de escribir nada.
2. Se verifica que el stock (ya bloqueado, por lo tanto no puede cambiar por otra transacción concurrente) alcance para cada línea.
3. Si alcanza: se descuenta todo el pedido, se registra un movimiento `SALE` por línea (`inventory_movements`, auditable) y el pedido pasa a `status: PAID`.
4. Si NO alcanza (dos compradores pagaron casi simultáneamente por las últimas unidades — la ventana que el checkout de la Fase 9 deja abierta a propósito, ver más arriba): no se descuenta nada, el pedido pasa a `status: CANCELLED` con `paymentStatus: APPROVED` — el dinero sí lo capturó Wompi, pero el pedido no se puede cumplir. **Limitación documentada de esta fase**: no se ejecuta un reembolso automático contra la API de Wompi (requeriría probarlo contra transacciones reales aprobadas, que no son alcanzables sin credenciales reales de Wompi en este entorno) — queda señalado para que un administrador lo procese manualmente desde el dashboard de Wompi; la Fase 12 (panel admin) es donde este caso se hace visible en la interfaz.

### Configuración pendiente (esperando llaves reales)

Este proyecto sigue la regla del proyecto de nunca simular una integración: todo el código de este archivo llama a mecanismos reales (criptografía real, y en producción, la API real de Wompi) — pero para que el widget realmente abra un checkout de Wompi y para que los webhooks reales lleguen, hacen falta credenciales reales de un comercio Wompi (sandbox o producción), que este entorno de desarrollo no tiene. Mientras tanto, `backend/.env` usa valores de marcador de posición (`pub_test_placeholder_...`) que permiten desarrollar y probar toda la lógica de firma/webhooks/concurrencia (ver más abajo), pero que Wompi rechazará si alguien intenta abrir el widget de verdad con ellos. Para completar la integración:

1. Crea una cuenta de comercio en Wompi (`https://comercios.wompi.co`) y activa el modo Sandbox.
2. Copia `Llave pública`, `Llave privada`, `Secreto de integridad` y `Secreto de eventos` (sección "Desarrolladores") a `backend/.env` (`WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`) y a `frontend/.env` (`VITE_WOMPI_PUBLIC_KEY`, si se usa en el frontend).
3. Configura la URL del webhook en el dashboard de Wompi apuntando a `https://<tu-backend-desplegado>/api/payments/webhook/wompi` (debe ser HTTPS y públicamente accesible — en desarrollo local se puede usar una herramienta de túnel).
4. Con eso, el flujo completo (abrir el widget, pagar con una tarjeta de prueba de sandbox, recibir el webhook real) queda operativo sin cambiar una sola línea de código.

### Verificado end-to-end en esta fase

```
✅ La firma de integridad calculada es un SHA256 verificable de forma independiente (recalculada y comparada en las pruebas)
✅ Un webhook con firma inválida se rechaza (401) y no cambia ningún estado
✅ Un pago aprobado real (webhook correctamente firmado con el events secret configurado) descuenta
   inventario, crea el movimiento SALE, y marca el pedido como PAID
✅ Un webhook duplicado (misma transacción, mismo estado — reentrega) es idempotente: NO descuenta stock dos veces
✅ Un pago rechazado (DECLINED) no toca el inventario
✅ No se puede volver a pagar un pedido ya aprobado (409 ORDER_ALREADY_PAID)
✅ CONCURRENCIA (la prueba más importante de todo el proyecto): dos pagos aprobados que llegan
   PRÁCTICAMENTE al mismo tiempo por el último único stock disponible — con Promise.all() disparando
   ambos webhooks a la vez — nunca sobrevenden: exactamente un pedido queda PAID con el stock
   correctamente en 0, el otro queda CANCELLED (aprobado por Wompi pero sin stock para cumplirlo)
✅ 7/7 tests automatizados nuevos (Vitest + Supertest, con firmas reales calculadas con el events/integrity
   secret configurado) — 47/47 en la suite completa del backend
✅ Frontend: `tsc --noEmit` limpio, `vite build` exitoso, lint limpio. Verificado con navegador real
   (Playwright/Chromium): crea un pedido real → el botón "Pagar con Wompi" aparece → al hacer clic,
   llama de verdad a POST /api/payments/create (firma real) y el navegador intenta cargar el script
   real del widget desde checkout.wompi.co (confirmado por la petición de red observada) → como este
   entorno de pruebas en la nube bloquea el acceso saliente a checkout.wompi.co (misma restricción de
   red que ya afectaba a picsum.photos en fases anteriores — no es un problema del código), la carga
   falla ahí, y la página lo maneja con un mensaje claro en vez de romperse. Abrir el widget de verdad
   contra Wompi y completar un pago de sandbox requiere las credenciales reales descritas arriba.
```

## ADMIN / DASHBOARD (`/api/admin`) — implementado en la Fase 11

Primera ruta del panel administrativo. `adminRouter` aplica `requireAuth` + `requireRole("ADMIN")` a **todas** las rutas montadas bajo `/api/admin` de una sola vez (en `admin.routes.ts`), así que cada endpoint nuevo que se agregue en la Fase 12 (inventario, pedidos, categorías, clientes, cupones, reseñas, envíos) queda protegido automáticamente sin tener que recordar añadir el middleware ruta por ruta.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/admin/dashboard` | ADMIN | Resumen agregado del negocio, calculado con SQL real sobre las tablas de pedidos/inventario (nunca datos de ejemplo). |

### Qué calcula `getDashboardSummary()` (todo con agregaciones SQL reales, no en memoria)

- **Ingresos totales, pedidos pagados, pedidos pendientes de pago, ticket promedio**: se consideran "pagados" los pedidos en estado `PAID`, `PROCESSING`, `SHIPPED` o `DELIVERED` (un pedido `CANCELLED` con `paymentStatus: APPROVED` — el caso de sobreventa de la Fase 10 — no cuenta como ingreso real).
- **Pedidos por estado**: conteo agrupado por `status`.
- **Ventas de los últimos 14 días**: agrupado por día (`to_char(created_at, 'YYYY-MM-DD')`), con los días sin ventas rellenados en 0 explícitamente (para que el gráfico siempre muestre 14 barras, no solo los días con datos).
- **Productos más vendidos**: `order_items` unido a `orders` (solo estados pagados), agrupado por producto, top 5 por unidades vendidas.
- **Alertas de stock bajo**: variantes activas donde `inventory.stock <= inventory.min_stock`, hasta 10.
- **Pedidos recientes**: los últimos 10 pedidos con datos del cliente, para la tabla del dashboard.

### Notas de implementación

- No se usa ninguna librería de gráficos: el gráfico de barras de 14 días es un componente SVG propio (`frontend/src/components/admin/SalesChart.tsx`), para no agregar peso al bundle del admin por un gráfico tan simple.
- `adminRouter` es intencionalmente el único lugar donde se aplica `requireRole("ADMIN")` para todo el panel — la Fase 12 solo necesita agregar rutas hijas, no repetir la protección.

### Verificado end-to-end en esta fase

```
✅ Un cliente autenticado (rol CUSTOMER) recibe 403 al llamar GET /api/admin/dashboard
✅ Una petición sin sesión recibe 401
✅ Con datos reales (2 pedidos pagados + 1 sin pagar, creados en la prueba): el ingreso total,
   el conteo de pedidos pagados, el producto más vendido y el pedido reciente reflejan exactamente
   los deltas esperados (incluyendo el 19% de impuesto aplicado en el carrito) — no hay datos de ejemplo
✅ 3/3 tests automatizados nuevos (Vitest + Supertest) — 50/50 en la suite completa del backend
✅ Frontend: `tsc --noEmit` limpio, `vite build` exitoso, lint limpio. Verificado con navegador real
   (Playwright/Chromium) con un flujo completo: un cliente normal intenta entrar a /admin y es
   redirigido fuera → se genera una venta real (pedido + pago aprobado por webhook, igual que en la
   Fase 10) → se inicia sesión como admin y el dashboard, al cargar, muestra esa venta real en
   "Pedidos recientes" y el gráfico de 14 días se renderiza con datos reales
```

## Gestión de pedidos y envíos (`PUT /api/orders/:id/status`) — implementado en la Fase 12

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| PUT | `/api/orders/:id/status` | ADMIN | Cambia el estado de un pedido. Body: `{ status, trackingNumber?, carrier? }` (`trackingNumber`/`carrier` solo tienen efecto cuando `status` es `SHIPPED`, y crean o actualizan el registro en `shipments`). |

### Notas de implementación

- **Máquina de estados explícita** (`ALLOWED_TRANSITIONS` en `order.service.ts`): `PENDING → PAID/CANCELLED`, `PAID → PROCESSING/SHIPPED/CANCELLED/REFUNDED`, `PROCESSING → SHIPPED/CANCELLED/REFUNDED`, `SHIPPED → DELIVERED/REFUNDED`, `DELIVERED → REFUNDED`; `CANCELLED` y `REFUNDED` son finales. `PAID`/`PROCESSING` pueden saltar directo a `REFUNDED` (por ejemplo, un reembolso decidido antes de que el pedido llegue a entregarse) sin pasar obligatoriamente por cada estado intermedio. Una transición fuera de esta tabla responde 400 (`ORDER_STATUS_TRANSITION_INVALID`), nunca se acepta silenciosamente; repetir el mismo estado responde 400 (`ORDER_STATUS_UNCHANGED`).
- **Cancelar un pedido ya pagado repone el inventario**: si el pedido tenía `paymentStatus: APPROVED` (por lo tanto ya se había descontado stock en la Fase 10), cancelarlo desde aquí ejecuta el mismo mecanismo de bloqueo de fila (`SELECT ... FOR UPDATE`) que el descuento, pero en reversa — cada línea repone su cantidad y queda un movimiento `RESTOCK` auditable en `inventory_movements`. Cancelar un pedido que nunca llegó a pagarse no toca inventario (nunca se descontó).
- Pasar a `SHIPPED` con `trackingNumber`/`carrier` hace un upsert sobre `shipments` (uno por pedido) y setea `shippedAt`; llegar a `DELIVERED` setea `deliveredAt`.
- Cada cambio de estado queda en la auditoría (`ORDER_STATUS_UPDATED`, ver más abajo) con el estado anterior y el nuevo.
- `GET /api/orders` (Fase 9) ahora acepta filtros de admin por querystring: `?status=` y `?search=` (número de pedido, nombre o correo del cliente).

## INVENTORY (`/api/admin/inventory`) — implementado en la Fase 12

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/admin/inventory` | ADMIN | Lista el inventario por variante, con nombre/SKU de producto. Filtros: `?search=`, `?lowStock=true` (`stock <= minStock`). |
| GET | `/api/admin/inventory/:id/movements` | ADMIN | Historial de movimientos (`SALE`, `RESTOCK`, `ADJUSTMENT`) de una variante, más recientes primero. |
| PATCH | `/api/admin/inventory/:id/adjust` | ADMIN | Ajusta el stock de una variante en `±cantidad` con un `reason` obligatorio. Bloquea la fila (`SELECT ... FOR UPDATE`) igual que el descuento por venta de la Fase 10, para que un ajuste manual nunca pise una venta concurrente ni deje el stock en negativo; registra un movimiento `ADJUSTMENT` auditable. |

## CUSTOMERS (`/api/admin/customers`) — implementado en la Fase 12

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/admin/customers` | ADMIN | Lista clientes (rol `CUSTOMER`) con resumen de pedidos/gasto total. Filtro: `?search=` (nombre o correo). |
| GET | `/api/admin/customers/:id` | ADMIN | Detalle de un cliente: datos de perfil, direcciones y su historial de pedidos. |
| PATCH | `/api/admin/customers/:id/status` | ADMIN | Activa/desactiva la cuenta (`{ isActive }`). Una cuenta desactivada no puede iniciar sesión (`login()` en `auth.service.ts` ya rechazaba usuarios `isActive: false` desde la Fase 6 — aquí se le da al admin el botón real para ponerla en ese estado) ni renovar sesiones existentes en el próximo refresh.|

## COUPONS — edición añadida en la Fase 12

`PUT /api/coupons/:id` (ADMIN) se suma a los endpoints de cupones de la Fase 8 (crear, activar/desactivar, borrar, validar): permite editar descuento, vigencia, límites de uso y compra mínima de un cupón existente sin cambiar su código. Igual que en la creación, `maxUses`/`minPurchase` aceptan `null` explícito para "sin límite"/"sin mínimo".

## REVIEWS (`/api/reviews`, `/api/admin/reviews`) — implementado en la Fase 12, compra verificada corregida en la Fase 13

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/reviews?productId=` | Pública | Lista las reseñas **aprobadas** de un producto — una reseña recién creada no aparece aquí hasta que un admin la aprueba. |
| POST | `/api/reviews` | Requerida | Crea una reseña (`{ productId, rating, comment }`), pendiente de aprobación (`isApproved: false`). Un usuario solo puede reseñar cada producto una vez (`REVIEW_ALREADY_EXISTS` si repite), y solo si tiene al menos un pedido propio pagado (`PAID`/`PROCESSING`/`SHIPPED`/`DELIVERED`) que contenga ese producto (`VERIFIED_PURCHASE_REQUIRED` si no). |
| GET | `/api/admin/reviews` | ADMIN | Lista todas las reseñas para moderación, con filtro `?status=pending\|approved\|all` (por defecto `pending`). |
| PATCH | `/api/admin/reviews/:id/status` | ADMIN | Aprueba o rechaza: `{ isApproved: boolean }`. |
| DELETE | `/api/admin/reviews/:id` | ADMIN | Elimina una reseña. |

### Notas de implementación

- `products.ratingAverage`/`products.ratingCount` se **recalculan** (no se acumulan con `+1`/promedio incremental) cada vez que una reseña se aprueba, rechaza o borra — se recorre el conjunto real de reseñas con `isApproved: true` del producto, así que nunca hay drift entre el contador mostrado y las reseñas que realmente están públicas.
- **Corrección de la Fase 13**: la verificación de "compra verificada" se implementó en la Fase 12 solo a medias — el campo `orderId` era opcional en el body y, si el cliente no lo enviaba (que es justo lo que hacía el frontend, que nunca lo mandó), la reseña se creaba sin ninguna verificación real. Se corrigió para que el backend **siempre** busque por su cuenta un pedido pagado del propio usuario que contenga ese producto, sin depender de que el cliente lo indique — así no hay forma de omitir la verificación desde el frontend ni de falsearla enviando un `orderId` ajeno. Esto coincide con el requisito original documentado en `docs/01-arquitectura.md` §7 ("solo compradores verificados"), que había quedado sin cumplirse del todo en la Fase 12.

## SETTINGS (`/api/admin/settings`) — implementado en la Fase 12

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/admin/settings` | ADMIN | Configuración actual de la tienda (nombre, correo/teléfono de contacto, dirección, redes sociales, textos legales). |
| PUT | `/api/admin/settings` | ADMIN | Actualiza la configuración (upsert sobre una única fila `id=1` — no existe una fila sembrada por defecto; el primer `GET`/`PUT` la crea con valores vacíos/por defecto). |

## AUDIT-LOGS (`/api/admin/audit-logs`) — implementado en la Fase 12

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/admin/audit-logs` | ADMIN | Lista el registro de auditoría, más reciente primero. Filtro: `?resource=` (`order`, `product`, `category`, `coupon`, `customer`, `inventory`, `review`, `store_settings`). |

### Notas de implementación

- `writeAuditLog()` (`backend/src/utils/auditLog.ts`) se invoca desde cada controller de escritura administrativa (crear/editar/borrar producto, categoría, cupón; cambiar estado de pedido; ajustar inventario; moderar reseña; activar/desactivar cliente; cambiar configuración) — no hay una capa genérica de middleware que lo haga automáticamente, a propósito: así cada acción registra el `resourceId` y los datos relevantes de **ese** recurso en vez de un payload genérico poco útil para auditar.
- `writeAuditLog()` nunca lanza: un fallo al escribir el log (por ejemplo, un problema transitorio de conexión) no debe romper la acción administrativa real que sí tuvo éxito; el error se registra con `logger.error` y la respuesta al admin sigue siendo la del cambio que sí se aplicó.
- Cada entrada queda asociada al `userId` del admin que la realizó (con `ON DELETE` sin cascada — un registro de auditoría nunca desaparece porque se borre la cuenta que lo generó) y a la IP de la petición.

## Corrección de seguridad de esta fase: reutilización de refresh tokens en carrera

Durante la verificación end-to-end de esta fase se encontró y corrigió un bug real de sesión (no cosmético): con la rotación de un solo uso implementada en la Fase 6, dos llamadas a `/api/auth/refresh` con la **misma** cookie que llegan casi al mismo tiempo (dos pestañas recargando a la vez, o — dentro de una misma pestaña — una carrera entre el efecto de montaje de `AuthContext` y el interceptor de axios) hacían que la primera rotara el token con éxito y la segunda recibiera 401, cerrando una sesión que en realidad seguía siendo válida.

Se corrigió en dos niveles:

1. **Frontend** (`frontend/src/services/auth.service.ts`, `frontend/src/services/api.ts`): las llamadas concurrentes a refresh **dentro de una misma pestaña** se coalescen en una sola petición de red real compartiendo una promesa en curso (`inFlightRefresh`/`refreshPromise`) — esto no puede resolver una carrera entre dos pestañas distintas, porque son dos heaps de JavaScript separados que no comparten esa promesa.
2. **Backend** (`backend/src/services/auth.service.ts`, `refreshSession()`): se agregó una ventana de gracia de 10 segundos (`REFRESH_REUSE_GRACE_MS`) — reutilizar un refresh token que ya fue rotado, **dentro** de esa ventana, no se trata como robo y simplemente emite una sesión nueva más; fuera de la ventana, se sigue rechazando exactamente igual que antes. Es el mismo patrón ("reuse interval") que usan Auth0/Okta para el mismo problema — un trade-off de seguridad deliberado y documentado, no un debilitamiento accidental.

Cubierto por 5 pruebas automatizadas nuevas en `backend/tests/auth.test.ts` (rotación normal, reutilización dentro de la ventana de gracia, reutilización fuera de la ventana, y que el token rotado sigue sirviendo para rotaciones futuras) y verificado con un navegador real: recargas duras repetidas, recarga concurrente en dos pestañas del mismo contexto de navegador, y navegación concurrente en una segunda pestaña con la misma cookie — todas mantienen la sesión.

### Verificado end-to-end en esta fase (Fase 12, panel admin completo)

```
✅ Categoría creada desde la UI real del panel admin
✅ Producto creado desde la UI (con stock inicial) y editado (marcado como destacado)
✅ Ajuste de inventario aplicado desde la UI (verificado leyendo la celda de stock, no un substring de toda la fila)
✅ Cupón creado y editado desde la UI (porcentaje 15% -> 25%)
✅ Configuración de la tienda persistida tras recargar la página
✅ Ciclo completo de reseña real: un cliente real la escribe desde la ficha de producto → NO es pública
   mientras está pendiente → un admin la aprueba desde el panel → SÍ es pública en la ficha del producto,
   y el rating/contador del producto se recalculan sobre reseñas reales aprobadas
✅ Detalle de cliente real (con su historial de pedidos) accesible desde el panel
✅ Pedido real pagado (webhook de Wompi firmado y procesado, igual que en la Fase 10) para tener un
   pedido con paymentStatus: APPROVED sobre el cual probar la gestión de estados
✅ Pedido cambiado de estado desde la UI: PAID -> PROCESSING -> SHIPPED, con transportadora y número
   de guía reales guardados en `shipments`
✅ El registro de auditoría refleja las acciones administrativas reales realizadas arriba (ORDER_STATUS_UPDATED
   visible tras el cambio de estado)
✅ El pedido real aparece en el listado admin de pedidos
✅ 62/62 tests automatizados del backend (Vitest + Supertest contra Postgres real), incluyendo 5 nuevos
   de rotación de refresh tokens y 7 nuevos de gestión administrativa
✅ Frontend: `tsc --noEmit` limpio, `vite build` exitoso (10 páginas admin nuevas con code-splitting), lint limpio
```

## EMAILS Y NOTIFICACIONES — implementado en la Fase 13

Esta fase no agrega endpoints nuevos: conecta el envío de correos transaccionales real (`backend/src/jobs/email.service.ts`, con Resend, implementado desde la Fase 6) a cada evento de negocio relevante, con plantillas HTML propias (`backend/src/jobs/emailTemplates.ts`).

| Evento | Correo enviado | Disparado desde |
|---|---|---|
| Registro de una cuenta | Bienvenida | `auth.service.ts` → `register()` |
| Solicitud de recuperación de contraseña | Enlace de recuperación (válido 1 hora) | `auth.service.ts` → `forgotPassword()` |
| Se crea un pedido | Confirmación del pedido (`PENDING`), con el detalle de productos y totales | `order.service.ts` → `createOrderFromCart()` |
| El webhook de Wompi aprueba el pago | Pago aprobado | `payment.service.ts` → `approveOrderPayment()` |
| El webhook de Wompi rechaza el pago | Pago rechazado, invita a reintentar | `payment.service.ts` → `handleWompiWebhook()` |
| Pago aprobado pero el stock ya no alcanzaba (caso de sobreventa evitada, Fase 10) | El pedido no se pudo completar — reembolso en camino | `payment.service.ts` → `approveOrderPayment()` |
| Un admin cambia el estado a `SHIPPED` | Pedido enviado, con transportadora y número de guía si se indicaron | `order.service.ts` → `updateOrderStatus()` |
| Un admin cambia el estado a `DELIVERED` | Pedido entregado | `order.service.ts` → `updateOrderStatus()` |
| Un admin cambia el estado a `CANCELLED`/`REFUNDED` | Pedido cancelado/reembolsado, con aviso de reembolso si aplica | `order.service.ts` → `updateOrderStatus()` |
| Un admin aprueba una reseña (transición pendiente → aprobada, no en aprobaciones repetidas) | Tu reseña ya es pública | `review.service.ts` → `setReviewStatus()` |
| Un admin desactiva la cuenta de un cliente | Cuenta desactivada | `customer.service.ts` → `setCustomerStatus()` |

### Notas de implementación

- Cada plantilla usa el **nombre real de la tienda** (`store_settings.storeName`, Fase 12 — con su valor por defecto si nadie lo ha configurado todavía) en vez de un nombre fijo en el código.
- Los correos se envían **después** de que la transacción de base de datos correspondiente ya confirmó, nunca dentro de ella — un correo no debe mantener una conexión de base de datos abierta esperando una llamada de red a Resend, y un fallo de envío (`sendEmail()` nunca lanza, ver Fase 6) nunca debe revertir ni bloquear una operación de negocio que ya tuvo éxito.
- **Corrección real encontrada en esta fase** (no cosmética): la verificación de "compra verificada" para poder dejar una reseña, declarada en el diseño original (`docs/01-arquitectura.md` §7), se había implementado a medias en la Fase 12 — dependía de un `orderId` opcional que el frontend nunca enviaba, así que en la práctica cualquier usuario autenticado podía reseñar cualquier producto sin haberlo comprado. Se corrigió para que el backend verifique la compra por su cuenta; ver la sección REVIEWS más arriba.
- Sigue pendiente de credenciales reales (`EMAIL_API_KEY` en `backend/.env`) para el envío real vía Resend — el mismo tipo de límite de este entorno de desarrollo ya documentado para Wompi en la Fase 10. Mientras tanto, cada llamada a `sendEmail()` es código real y ejecuta toda la lógica de negocio que la dispara; solo la entrega final por red queda registrada en el log del servidor en vez de salir de verdad.

### Verificado en esta fase

```
✅ 7 pruebas automatizadas nuevas (Vitest + Supertest, con `sendEmail` aislado mediante `vi.mock` —
   se verifica que cada evento de negocio real dispara el correo correcto al destinatario correcto,
   no la entrega de red, que depende de credenciales que este entorno no tiene)
✅ Ciclo de vida completo de un pedido real disparando sus 4 correos en orden: confirmación al crear →
   pago aprobado vía webhook real de Wompi → enviado (con número de guía real en el HTML) → entregado
✅ Pago rechazado vía webhook real dispara el correo de pago rechazado
✅ Bienvenida al registrarse, recuperación de contraseña con el enlace real embebido
✅ La recuperación de contraseña para un correo no registrado NO envía correo (no revela si existe)
✅ Reseña aprobada dispara el correo solo en la transición real pendiente → aprobada, nunca en una
   aprobación repetida sobre una reseña que ya estaba aprobada
✅ Desactivar la cuenta de un cliente dispara el correo de aviso
✅ 69/69 tests automatizados del backend (Vitest + Supertest contra Postgres real) — suite completa
✅ Backend: `tsc --noEmit` limpio, `eslint` sin problemas nuevos
```

## Seguridad — endurecimiento de la Fase 14

Esta fase no agrega endpoints nuevos: cierra brechas de seguridad reales encontradas al revisar `docs/01-arquitectura.md` §7 contra lo que en verdad estaba implementado, y actualiza dependencias con vulnerabilidades conocidas. Nada de esto es cosmético — cada punto es una brecha real que existía en el código antes de esta fase.

### 1. Dependencias con vulnerabilidades conocidas

- **Backend**: la cadena `express` → `body-parser` → `qs` traía una versión de `qs` con una vulnerabilidad conocida (denegación de servicio por colisión de prototipos en el parseo de query strings anidadas). `body-parser` aún no había actualizado su rango declarado, así que se fuerza la versión parcheada con el campo `overrides` de `package.json` (`"qs": "^6.16.0"`), una técnica estándar de npm para fijar una dependencia transitiva sin esperar a que el paquete intermedio actualice su rango.
- **Frontend**: `react-router-dom` tenía una vulnerabilidad de redirección abierta sin parche disponible en la serie 6.x, así que se actualizó a la v7 (`^7.18.3`). Es un cambio de versión mayor, pero de bajo riesgo real: la aplicación ya usaba la API de router basada en datos (`createBrowserRouter`/`RouterProvider`), compatible desde 6.4 y sin cambios de esa API en la v7. Verificado con `tsc`, `eslint`, `vite build`, la suite de tests, y una prueba manual en vivo (redirecciones de rutas protegidas, flujo de login, bloqueo de rutas de admin).
- **Verificación**: `npm audit --omit=dev` reporta **0 vulnerabilidades** en ambos paquetes tras el cambio.

### 2. Escape de HTML en los correos transaccionales (Fase 13)

Las plantillas de correo (`backend/src/jobs/emailTemplates.ts`) interpolan strings dinámicos (nombre del cliente, nombre de la tienda, número de pedido, nombre de producto, transportadora, número de guía) directamente en HTML crudo — a diferencia del frontend en React, donde JSX escapa automáticamente, aquí no había ninguna protección equivalente. Un nombre de producto o de cliente con `<script>` o con etiquetas HTML se habría insertado sin escapar en el correo real que recibe el destinatario. Se agregó una función `esc()` (escape de `&`, `<`, `>`, `"`, `'`) aplicada a **todo** valor dinámico interpolado en cada plantilla, incluyendo las URLs generadas por `button()`.

### 3. Sanitización de campos de texto libre (`sanitize-html`)

El paquete `sanitize-html` ya estaba declarado como dependencia desde el diseño original pero nunca se había conectado a ningún validador — quedaba sin usar. Se agregó `backend/src/utils/sanitize.ts` con `stripHtml()` (elimina toda etiqueta HTML) y un helper `sanitizedText()` que se encadena a un `z.string()` de Zod para aplicar la limpieza automáticamente en el momento de validar/escribir. Se conectó en **todos** los campos de texto libre que un usuario o admin puede escribir y que se muestran después a otros usuarios:

| Campo | Validador |
|---|---|
| Descripción de producto | `product.validators.ts` |
| Descripción de categoría | `category.validators.ts` |
| Comentario de reseña | `review.validators.ts` |
| Dirección de envío (línea, complemento), notas del pedido | `order.validators.ts` |
| Motivo/transportadora al actualizar estado de un pedido | `order.validators.ts` |
| Dirección guardada del cliente (línea, complemento) | `address.validators.ts` |
| Nombre y dirección de la tienda | `settings.validators.ts` |
| Motivo de un ajuste manual de inventario | `inventory.validators.ts` |

Esto es defensa en profundidad: ningún campo de texto libre queda con HTML crudo almacenado en la base de datos, sin importar por dónde se muestre después (panel admin, frontend público, correos).

### 4. Verificación de compra real para reseñas (corregido, ver también Fase 13)

Documentado en la sección REVIEWS más arriba: el diseño original exigía que solo compradores verificados pudieran reseñar un producto, pero la implementación de la Fase 12 dependía de un `orderId` opcional nunca enviado por el frontend — en la práctica, cualquier usuario autenticado podía reseñar cualquier producto. Se corrigió con detección automática de compra en el propio backend (ver Fase 13 arriba).

### 5. Defensa adicional contra CSRF en `/api/auth/refresh`

`/api/auth/refresh` es el único endpoint mutante de la API que se autentica **solo** con una cookie (`refresh_token`, `httpOnly`), sin requerir el header `Authorization` — todos los demás endpoints mutantes exigen el access token en ese header, que un sitio externo no puede leer ni adivinar entre orígenes. La cookie ya se emite con `SameSite=Strict` (defensa principal, desde la Fase 6), pero como capa extra explícita se agregó `backend/src/middlewares/csrfOriginCheck.middleware.ts`: verifica que el header `Origin` (o, si no viene, el origen parseado de `Referer`) esté en la misma allowlist de CORS. Solo rechaza (403) cuando el navegador sí envía uno de esos headers y no coincide — clientes sin navegador (apps móviles, curl, tests) no siempre los envían, y ese caso ya queda cubierto por `SameSite=Strict`.

Al escribir esta verificación se encontró un bug real en el manejo de errores de CORS (`backend/src/config/cors.ts`): el `callback` del origin-check de `cors` recibía un `Error` genérico, que el middleware global de errores trataba como un error no controlado y respondía con **500** en vez de un **403** claro. Se corrigió usando `AppError.forbidden()`, consistente con el resto de la API.

### 6. Rate limiting reforzado en autenticación

- **`/api/auth/refresh` no tenía ningún límite propio** — quedaba expuesto a abuso/DoS sin restricción (la fuerza bruta contra el valor del token en sí es inviable, es un token opaco aleatorio de 48 bytes, pero el endpoint en sí no tenía ningún freno). Se agregó `refreshLimiter` (60 solicitudes / 15 min).
- **`/api/auth/login`** ya tenía un límite genérico por IP (`authLimiter`, desde la Fase 6), pero eso no evita que alguien distribuya intentos de fuerza bruta contra **una cuenta específica** desde muchas IPs distintas. Se agregó `loginPerAccountLimiter`, con una clave combinada `IP + correo` (10 intentos / 15 min por esa combinación), tal como especificaba `docs/01-arquitectura.md` §7 y que no se había implementado hasta ahora.

> **Nota (Fase 15):** estos límites (y el límite global de `app.ts`, 300 peticiones/IP cada 15 min, existente desde antes de la Fase 14) se volvieron configurables por variable de entorno (`AUTH_RATE_LIMIT_MAX`, `LOGIN_PER_ACCOUNT_RATE_LIMIT_MAX`, `REFRESH_RATE_LIMIT_MAX`, `PASSWORD_RESET_RATE_LIMIT_MAX`, `GLOBAL_RATE_LIMIT_MAX` — ver `backend/src/utils/envInt.ts`), con los mismos valores por defecto que ya tenía el código si la variable no está definida. Esto no cambia el comportamiento de producción: se agregó al escribir la suite E2E real de la Fase 15, que desde una sola IP (localhost) hace bastantes más registros/logins/peticiones seguidas de las que un cliente real haría — sin esto, la propia suite de pruebas terminaba bloqueada por su propio rate limiting. `backend/.env` de este entorno de desarrollo sube esos límites; el valor por defecto en el código (el que se usa en producción) no cambió.

### Verificado en esta fase

```
✅ npm audit --omit=dev: 0 vulnerabilidades (backend y frontend)
✅ 8 pruebas automatizadas nuevas (backend/tests/security.test.ts):
   - stripHtml() elimina cualquier etiqueta, incluyendo <script>
   - La descripción de un producto se guarda sin HTML aunque el admin envíe <script>/<img onerror>
   - El comentario de una reseña (con compra verificada real) se guarda sin HTML
   - /auth/refresh rechaza con 403 un Origin fuera de la allowlist
   - /auth/refresh rechaza con 403 cuando el Referer es de otro sitio y no hay Origin
   - /auth/refresh responde 401 (no 403) cuando no hay Origin ni Referer — SameSite sigue siendo la defensa real
   - /auth/refresh responde 401 (no 403) con el Origin real del frontend — el filtro de origen no bloquea tráfico legítimo
   - /auth/login bloquea con 429 tras superar el límite de intentos contra una cuenta específica
✅ 77/77 tests automatizados del backend (Vitest + Supertest contra Postgres real) — suite completa, sin regresiones
✅ Backend: `tsc -b --noEmit` limpio, `eslint` sin errores (solo 3 warnings preexistentes de tipado `any` en relaciones de Drizzle)
✅ Frontend: `tsc -b --noEmit` limpio, `eslint` sin errores (solo 1 warning preexistente de Fast Refresh), `vite build` exitoso
✅ Prueba manual en vivo con Playwright tras el upgrade de react-router-dom a v7: redirecciones de rutas
   protegidas, flujo de login completo, bloqueo de rutas de admin — todo funcionando igual que antes del upgrade
```

## Pruebas automatizadas — Fase 15

Esta fase no agrega endpoints: consolida y completa la cobertura automatizada de todo el proyecto en tres capas, y corrige dos problemas reales que aparecieron al escribir la capa nueva (E2E).

### 1. Backend — integración real contra Postgres (ya existía, sin cambios de fondo)

Sin cambios de comportamiento: la suite existente desde fases anteriores (Vitest + Supertest, contra una base de datos Postgres real, nunca mocks) queda como estaba — **77 tests en 10 archivos**, cubriendo auth, carrito/cupones, checkout, pagos/webhooks de Wompi, catálogo, dashboard, panel administrativo, emails y seguridad (Fase 14). Se revisó una vez más en esta fase como parte de la regresión completa y sigue en 77/77.

### 2. Frontend — pruebas unitarias y de componentes (nuevo en esta fase)

Antes de esta fase el frontend solo tenía un archivo de test (`cart.store.test.ts`). Se agregó cobertura real con Vitest + Testing Library (jsdom) para la lógica de negocio del cliente que antes no se verificaba de forma automática — **44 tests en 7 archivos**:

| Archivo | Qué cubre |
|---|---|
| `utils/format.test.ts` | Formateo de moneda/fecha, cálculo de porcentaje de descuento (casos límite: sin precio de comparación, comparación menor o igual, cero) |
| `hooks/useDebounce.test.ts` | Temporizador con fake timers: no actualiza antes del delay, sí después, reinicia con cambios seguidos |
| `services/api.ts` (`api.test.ts`) | `getApiErrorMessage()` con los distintos tipos de error reales que puede recibir (respuesta de la API, red caída, error no-axios, valor no-Error); getter/setter del access token en memoria |
| `services/auth.service.ts` (`auth.service.test.ts`) | La coalescencia de `refreshRequest()` (`inFlightRefresh`) — dos llamadas concurrentes disparan una sola petición de red real, ambas reciben el mismo usuario; una llamada nueva tras terminar la anterior sí dispara otra petición; un refresh fallido limpia el token y no lanza |
| `store/cart.store.ts` (ya existía) | Límite de stock, acumulación de cantidades, subtotal, eliminar, actualizar cantidad |
| `context/AuthContext.tsx` (`AuthContext.test.tsx`) | Ciclo de vida completo: `isLoading` inicial, sesión restaurada automáticamente al montar (cookie de refresh), `login()` fusiona el carrito de invitado con el del backend y vacía el local, `logout()` limpia usuario y contador de carrito, un fallo de sincronización del carrito no bloquea el login |
| `components/product/ProductCard.tsx` (`ProductCard.test.tsx`) | Precio formateado, badge de descuento, "Agotado" deshabilita el botón, agregar al carrito local como invitado, productos con más de una variante piden elegir en el detalle en vez de un botón directo |

`vitest.config.ts` ganó un `setupFiles` (`src/test/setup.ts`) con `@testing-library/jest-dom` y limpieza automática (`cleanup()`) tras cada test — antes no existía ninguno de los dos, así que `toBeInTheDocument()` no estaba disponible y los componentes renderizados en un test se quedaban montados para el siguiente.

### 3. E2E — navegador real contra el frontend y el backend reales (nuevo en esta fase)

`frontend/e2e/` (Playwright, Chromium real, **9 tests en 3 archivos**) es la única capa que ejercita la aplicación completa de punta a punta: navegador real → Vite real (`:5173`) → Express real (`:4000`) → Postgres real, sin mockear nada, verificando lo que un usuario real vería en pantalla.

- `auth.spec.ts` (6 tests): una ruta protegida redirige a `/login` sin sesión; `/admin` también, sin llegar nunca a mostrar el panel; registro deja al usuario autenticado de inmediato; la sesión sobrevive a una recarga completa de la página (recupera el access token en memoria vía la cookie httpOnly de refresh, sin pedir login de nuevo); logout cierra la sesión y una ruta protegida vuelve a exigirla; login con contraseña incorrecta muestra el error real del backend sin autenticar.
- `admin.spec.ts` (2 tests): un admin real (creado por `global-setup`, ver abajo) inicia sesión y ve, en su propio panel, el producto real que él mismo publicó; un cliente sin rol admin es redirigido a `/` al intentar entrar a `/admin` (caso distinto de "sin sesión", que redirige a `/login` — `router/ProtectedRoute.tsx`).
- `shopping-checkout.spec.ts` (1 test): el recorrido completo de un cliente — busca un producto real, lo agrega al carrito como invitado, el checkout (ruta protegida) lo manda a `/login`, se registra, el carrito de invitado se fusiona con el del backend al iniciar sesión, completa el checkout con "Recoger en tienda" (sin necesitar credenciales reales de Wompi — el pago en sí ya se prueba con el webhook real de Wompi en `backend/tests/payment.test.ts`), el pedido se crea de verdad en Postgres y aparece en su historial.

**Datos de partida reales, no inventados:** `e2e/global-setup.ts` registra un admin por la API pública real y lo promueve a `ADMIN` directamente en la base de datos (exactamente como haría un operador la primera vez que configura la tienda — la API pública nunca permite crear cuentas admin directamente, por diseño), y con ese admin publica una categoría y un producto reales por la API real. `e2e/global-teardown.ts` limpia todo lo que el run creó (usuarios, carritos, pedidos, movimientos de inventario, auditoría, el producto y la categoría) respetando el orden de llaves foráneas, igual que los `afterAll` del backend.

Se corre con `npm run test:e2e` (`frontend/package.json`) — asume que `frontend` (`npm run dev`) y `backend` (`npm run dev`) ya están corriendo, igual que la suite del backend asume Postgres real disponible.

### Problemas reales encontrados al escribir la suite E2E

- **Rate limiting propio (Fase 14) bloqueando a la propia suite de pruebas**: al correr la suite completa varias veces seguidas desde una sola IP (localhost), tanto el límite específico de auth (`authLimiter`, 10/15min) como el límite global (`app.ts`, 300/15min) terminaban devolviendo 429 a mitad de la suite — el rate limiting estaba funcionando exactamente como se diseñó en la Fase 14, pero un entorno de desarrollo/CI que corre E2E reales genera mucho más tráfico de auth desde una sola IP que un usuario real. Se resolvió haciendo esos límites configurables por variable de entorno (`backend/src/utils/envInt.ts`, ver la nota en la sección de Fase 14 más arriba) con los mismos valores por defecto — la producción no cambia, solo el `.env` de este entorno de desarrollo sube los límites.
- **`?schema=public` en `DATABASE_URL` no es válido para `psql`**: es una convención de Prisma/Drizzle en la URL de conexión de Node que `libpq` (usado por `psql`, la herramienta de línea de comandos de Postgres) no reconoce como parámetro — `frontend/e2e/env.ts` usa la URL sin ese query string solo para las llamadas a `psql` del teardown.
- **Llaves foráneas sin cascada entre `orders`/`order_items`/`inventory_movements`/`reviews` y `products`/`users`**: mismo patrón que ya había aparecido en `backend/tests/*.test.ts` en fases anteriores — el teardown tuvo que borrar en el orden correcto (movimientos de inventario y líneas de pedido antes que los pedidos, reseñas antes que los usuarios, etc.). Al limpiar con el patrón `email LIKE 'e2e-%'`, el teardown también encontró y eliminó datos huérfanos de verificaciones manuales de fases anteriores a la Fase 15 que nunca se habían limpiado.

### Verificado en esta fase

```
✅ Backend: 77/77 tests (sin cambios de fondo, solo confirmación de que la refactorización de
   rate limiting a variables de entorno no rompió nada — mismos valores por defecto)
✅ Frontend: 44/44 tests nuevos/existentes (utils, hooks, servicios, store, contexto, un componente)
✅ E2E: 9/9 tests reales contra navegador+frontend+backend+Postgres reales, corridos varias veces
   seguidas de forma consecutiva para confirmar que no son flaky y que el teardown deja la base de
   datos limpia cada vez (verificado con una consulta SQL directa: 0 filas `e2e-%` después de cada run)
✅ Backend: `tsc -b --noEmit` limpio, `eslint` sin errores
✅ Frontend: `tsc -b --noEmit` limpio, `eslint` sin errores, `vite build` exitoso
✅ E2E: `tsc --noEmit` limpio sobre `playwright.config.ts` y `frontend/e2e/` (tsconfig propio, con
   @types/node — antes no existía, el frontend no tenía ninguna dependencia de tipos de Node)
```

## Optimización, SEO y seeders — Fase 16

Esta fase no agrega endpoints de negocio nuevos (salvo `GET /sitemap.xml`, fuera de `/api`): mejora lo que ya existe en tres frentes — SEO real (no simulado), rendimiento verificado con números concretos, y datos de demostración reales para poder mostrar la tienda funcionando sin partir de una base de datos vacía.

### 1. SEO

- **`frontend/src/hooks/useSEO.ts`** (nuevo): hook que manipula directamente `document.title`, `<meta name="description">`, `<meta name="robots">`, las etiquetas Open Graph (`og:site_name`, `og:title`, `og:description`, `og:type`, `og:url`, `og:image`), `<link rel="canonical">` y, opcionalmente, un `<script type="application/ld+json">` con datos estructurados — todo se limpia al desmontar el componente. No se usó ninguna librería externa (como `react-helmet`): es una app de una sola página y el conjunto de etiquetas a mantener es pequeño y estable, así que un hook propio de ~70 líneas es más simple de auditar que una dependencia nueva.
- Aplicado en **13 páginas y el layout de admin**: `Home`, `Shop`, `ProductDetail`, `Cart`, `Login`, `Register`, `Contact`, `NotFound`, `Checkout`, `Orders`, `Profile`, `OrderDetail`, `AdminLayout`. Las páginas privadas (`Checkout`, `Orders`, `Profile`, `OrderDetail`, todo el panel admin) usan `noindex: true` — no tiene sentido que un buscador indexe el carrito de una sesión ajena. `ProductDetail` incluye JSON-LD real de tipo `Product` (nombre, descripción, imagen, SKU, precio, disponibilidad y, cuando el producto tiene reseñas, `aggregateRating` calculado con los datos reales del producto — no un valor de relleno).
- **`frontend/public/robots.txt`** (nuevo): `Disallow` para `/admin`, `/checkout`, `/cart`, `/orders`, `/profile` (las mismas rutas marcadas `noindex` arriba, por consistencia), y una línea `Sitemap:` apuntando al endpoint dinámico de abajo.
- **`GET /sitemap.xml`** (nuevo, `backend/src/services/sitemap.service.ts` + ruta en `app.ts`, fuera de `/api` porque los rastreadores esperan `sitemap.xml` en la raíz del dominio): genera el XML en cada petición a partir de los productos y categorías **activos** en Postgres — no es un archivo estático, así que nunca queda desactualizado cuando se publica o desactiva un producto. Cacheado 10 minutos (`Cache-Control: public, max-age=600`, aceptable para un sitemap). Verificado en vivo con `curl`: devuelve XML válido con una URL por cada producto/categoría activo real de la base de datos.

### 2. Rendimiento

- **División del bundle de vendor** (`frontend/vite.config.ts`): `react`, `react-dom` y `react-router-dom` (que cambian con mucha menos frecuencia que el código propio) se separan a un chunk `vendor` aparte del chunk principal de la app. Antes vivían mezclados en un único `index-*.js` de ~313 kB, así que cualquier cambio en el código de la app invalidaba también la caché del navegador para React entero. Verificado con `vite build`: el chunk principal bajó a 79.67 kB (29.27 kB gzip) y el nuevo chunk `vendor` quedó en 235.26 kB (76.93 kB gzip) — el navegador ahora puede reutilizar ese segundo chunk entre despliegues mientras no cambie la versión de React.
- **Corrección de una consulta N+1 en el checkout** (`backend/src/services/order.service.ts`, `createOrderFromCart`): la verificación previa de stock de cada línea del carrito hacía un `SELECT` por variante dentro de un `for`. Se reemplazó por un único `SELECT ... WHERE variant_id IN (...)` (con `inArray` de Drizzle) que trae el stock de todas las variantes del carrito de una sola vez y arma un `Map` en memoria para las comparaciones. Se confirmó que esta consulta es solo una **verificación previa no bloqueante** — el descuento atómico real de inventario sigue ocurriendo más adelante en `payment.service.ts` con `SELECT ... FOR UPDATE` (verificado con `grep -rn '.for("update")' src/services/*.ts`: los tres únicos usos de bloqueo pesimista siguen intactos en `inventory.service.ts`, `order.service.ts` y `payment.service.ts`) — el cambio no afecta la seguridad de concurrencia del sistema, solo reduce el número de round-trips a la base de datos. Verificado con la suite de checkout existente (`backend/tests/checkout.test.ts`), que sigue en verde.
- **Nuevo índice compuesto** (`backend/src/db/schema.ts` + migración `0002_rainy_marten_broadcloak.sql`): `products_category_active_idx` sobre `(category_id, is_active)`, la combinación de filtros que usa el catálogo público (`GET /api/products?category=...`, que siempre filtra por `isActive = true`). Aplicada con `npm run db:migrate` y verificada con `psql \d products`.
- **`Cache-Control` público en catálogo y categorías** (`backend/src/middlewares/cacheControl.middleware.ts`, nuevo): `GET /api/products`, `GET /api/products/:idOrSlug` (60s) y `GET /api/categories` (300s) ahora responden `Cache-Control: public` — pero **solo cuando la petición no trae encabezado `Authorization`**. Esto es importante: la misma respuesta de "lista de productos" es distinta para un admin autenticado (incluye productos inactivos) que para un visitante anónimo, así que cachear la respuesta de un admin como pública filtraría datos privados a cualquiera detrás de la misma caché compartida (CDN, proxy). Revisando solo la presencia del header `Authorization` (sin necesidad de validar el token en el middleware) se evita ese riesgo sin duplicar lógica de autenticación.

### 3. Seeder de datos de demostración

- **`backend/src/db/seed.ts`** (nuevo, `npm run seed`): en vez de insertar filas a mano, reutiliza los mismos servicios que usa la API real (`createCategory`, `createProduct`, `createCoupon`), así que los datos de ejemplo pasan por exactamente las mismas reglas de negocio que usaría un admin real desde el panel (generación de slug/SKU únicos, variante por defecto cuando el producto no tiene variantes, fila de inventario por cada variante, etc.) — nada se simula ni se inserta saltándose la capa de servicio.
- Siembra: la configuración de la tienda (`store_settings`), 3 usuarios reales con contraseña hasheada (1 admin, 2 clientes), 4 categorías (Ropa, Tecnología, Hogar, Deportes) con 2 a 4 productos cada una (algunos con variantes de color/talla, algunos con `compareAtPrice` para mostrar el badge de descuento, algunos marcados como destacados, imágenes de placeholder), y 2 cupones (uno porcentual, uno de monto fijo con compra mínima).
- **Idempotente de verdad, no en teoría**: cada entidad se busca primero por su clave única (correo del usuario, slug de la categoría calculado con el mismo `slugify()` que usa `category.service.ts` internamente, nombre del producto, código del cupón) y solo se crea si no existe. Verificado corriendo `npm run seed` dos veces seguidas contra la base de datos real: la primera vez creó todo lo que faltaba (y respetó correctamente datos preexistentes de pruebas manuales de fases anteriores, como una categoría "Ropa" y un cupón "BIENVENIDO10" que ya existían), la segunda vez cada línea reportó "ya existe — sin cambios" sin duplicar nada.

### Verificado en esta fase

```
✅ Backend: tsc -b --noEmit limpio, eslint sin errores (solo 3 warnings preexistentes de tipado
   any en relaciones de Drizzle), 77/77 tests (incluye checkout.test.ts tras el cambio N+1)
✅ Frontend: tsc -b --noEmit limpio, eslint sin errores (solo 1 warning preexistente de Fast
   Refresh), 44/44 tests, vite build exitoso con el nuevo chunk vendor separado
✅ E2E: 9/9 tests reales (navegador + frontend + backend + Postgres) siguen pasando después de
   agregar useSEO/noindex a Checkout, Orders, Profile, OrderDetail y el panel admin — ninguna
   etiqueta nueva rompió los selectores de los specs existentes
✅ GET /sitemap.xml verificado en vivo con curl: XML válido generado desde los productos y
   categorías activos reales de Postgres
✅ Migración 0002 (índice products_category_active_idx) aplicada y verificada con psql \d products
✅ npm run seed corrido dos veces seguidas contra Postgres real: primera vez crea, segunda vez
   0 duplicados — idempotencia confirmada en vivo, no solo revisando el código
```

## Próximos grupos de endpoints

El listado completo planeado está en `docs/01-arquitectura.md` §6. A partir de la Fase 16 se documentan aquí los endpoints de seguridad/optimización que agreguen superficie de API nueva, si los hubiera.
