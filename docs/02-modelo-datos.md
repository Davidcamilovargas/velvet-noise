# Modelo de datos

Implementado en `backend/src/db/schema.ts` (Drizzle ORM) y materializado en `backend/src/db/migrations/0000_bouncy_shocker.sql`. 22 tablas, verificadas contra una instancia real de PostgreSQL 16 (inserciones, relaciones anidadas y cascadas probadas en la Fase 3).

## Cambio de herramienta respecto a la Fase 1: Prisma → Drizzle ORM

La Fase 1 eligió Prisma. Al implementar esta fase, `prisma generate` y `prisma migrate` fallaron porque este entorno de desarrollo bloquea por política de red la descarga de los binarios nativos de Prisma (`binaries.prisma.sh` no está en la lista blanca de dominios permitidos; sí lo están `registry.npmjs.org`, `pypi.org`, etc.). Sin esos binarios, Prisma no genera cliente ni corre migraciones — es decir, no se podía **verificar** que la capa de datos funcionara, lo cual viola la regla de "no simulación" del proyecto.

Se optó por **Drizzle ORM**, que es 100% TypeScript (sin binarios nativos), usa el driver `pg` (node-postgres, puro JS) y da soporte igual de completo a lo que este proyecto necesita: transacciones, `SELECT ... FOR UPDATE` para el control de concurrencia de inventario (crítico en la Fase 10), tipado fuerte generado desde el propio schema TypeScript, y un query builder relacional (`db.query.products.findFirst({ with: {...} })`) equivalente al `include` de Prisma.

Esto **no cambia el modelo de datos** definido en `docs/01-arquitectura.md` — mismas 22 tablas, mismas relaciones, mismos índices. Es un cambio de herramienta de acceso a datos, verificado de punta a punta en esta misma fase:

```
✅ npm install (drizzle-orm, drizzle-kit, pg) — sin descargas bloqueadas
✅ npx drizzle-kit generate — migración SQL generada desde schema.ts
✅ Postgres 16 real levantado y migración aplicada (22 tablas creadas)
✅ Insert + query relacional anidado (producto → categoría → variante → inventario) verificado
✅ Cascada de borrado (ON DELETE CASCADE) verificada
```

Nota para el despliegue: en una máquina de desarrollo normal o en CI/CD con acceso completo a internet, Prisma también habría funcionado — el bloqueo es específico de este sandbox. Se eligió Drizzle de todas formas porque permite verificar cada fase en este mismo entorno en lugar de "confiar" en que funcionará en otro lado, y porque el resultado (tipado fuerte, sin binarios nativos, despliegues más simples y rápidos en plataformas serverless) es una mejora real y no solo un workaround.

## Tablas y su propósito

| Tabla | Propósito | Notas clave |
|---|---|---|
| `users` | Cuentas (clientes y administradores) | `role` enum `CUSTOMER`/`ADMIN`; `password_hash` con bcrypt, nunca texto plano |
| `refresh_tokens` | Sesiones activas, revocables | Solo se guarda el **hash** del token, nunca el token en claro; permite logout real |
| `password_reset_tokens` | Recuperación de contraseña | Token de un solo uso (`used_at`), expira (`expires_at`) |
| `addresses` | Libreta de direcciones del usuario | Un pedido no referencia esta tabla en vivo — guarda un snapshot (ver `orders.address_snapshot`) |
| `categories` | Categorías del catálogo | `slug` único para URLs amigables |
| `products` | Productos | `price`/`compare_at_price` como `numeric(12,2)` (nunca float); `sku` único |
| `product_images` | Galería de imágenes por producto | `position` para orden, `is_primary` para la miniatura |
| `product_variants` | Combinaciones vendibles (color/talla) | Todo producto tiene ≥1 variante, incluso si no expone color/talla al usuario (`is_default = true`) |
| `inventory` | Stock por variante | `variant_id` único — una fila de inventario por variante, nunca ambigüedad |
| `inventory_movements` | Historial de entradas/salidas/ajustes | Trazabilidad completa exigida por la Fase 12 |
| `carts` / `cart_items` | Carrito de compra | `user_id` único (1 carrito activo por usuario) o `guest_token` para invitados |
| `orders` | Pedidos | Guarda snapshot de cliente y dirección; `payment_status` y `status` desacoplados (un pedido puede estar `PAID` pero `PROCESSING` en logística) |
| `order_items` | Líneas de un pedido | Guarda snapshot de nombre/SKU/precio — el histórico no cambia si el producto se edita después |
| `payments` | Intentos de pago (puede haber varios por pedido si el primero fue rechazado) | `provider_transaction_id` es el id que da Wompi |
| `webhook_events` | Registro de eventos de pasarela ya procesados | `(provider, event_id)` único → idempotencia real, no solo de nombre |
| `coupons` / `coupon_usages` | Cupones y su consumo | `coupon_usages.order_id` único: un cupón se consume una sola vez por pedido |
| `reviews` | Reseñas de producto | `(product_id, user_id)` único; moderación vía `is_approved` |
| `shipments` | Envío asociado a un pedido | Estados independientes del estado del pedido |
| `store_settings` | Configuración global de la tienda | Fila única (`id = 1`) — evita "valores en múltiples archivos" |
| `audit_logs` | Auditoría de acciones administrativas | `resource` + `resource_id` indexados para poder consultar "todo lo que pasó con el producto X" |

## Decisión de diseño: stock por variante, siempre

Para no bifurcar el código de checkout/inventario en "productos con variantes" vs. "productos simples", **todo producto recibe al menos una variante por defecto** (`is_default = true`, sin color/talla visibles) al crearse. El inventario siempre cuelga de `product_variants.id`, nunca directamente de `products.id` en el flujo de compra — esto simplifica enormemente la lógica de descuento de stock bajo concurrencia (Fase 10), que solo necesita conocer un `variantId`.

## Próximos pasos que dependen de este modelo

- Fase 4 (backend): los `services/` usarán `db` (`backend/src/db/client.ts`) exclusivamente — ningún controller debe hacer queries SQL directas.
- Fase 10 (pagos): el descuento de stock usa `UPDATE inventory SET stock = stock - $qty WHERE id = $id AND stock >= $qty` dentro de una transacción Drizzle (`db.transaction`), verificando `rowCount`.
- Fase 16 (seeders): `backend/src/db/seed.ts` poblará estas tablas con datos de prueba realistas.
