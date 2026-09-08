# Velvet Noise — resumen de marca para desarrollo

Extraído de `Manual_de_Marca_VELVET_NOISE.pdf` (edición 01). Fuente de verdad
para cualquier cambio visual — si algo no está aquí, hay que revisar el
manual original antes de inventar una regla nueva.

## La marca

Velvet Noise nace del choque de dos texturas: lo urbano de la calle (Noise)
y la elegancia del terciopelo (Velvet). No es streetwear con detalles finos
ni sastrería con estética urbana — las dos cosas ocurren en la misma prenda.

Frase eje (solo en campaña, nunca dentro del logotipo): **"Ruido por fuera.
Terciopelo por dentro."**

## Colores (usar siempre las clases `velvet-*` de Tailwind, nunca hex sueltos)

| Token Tailwind | Nombre | HEX | Uso |
|---|---|---|---|
| `velvet-black` | Negro Absoluto | `#000000` | Fondo por defecto — 60% de la superficie |
| `velvet-silk` | Blanco Seda | `#EDEAE4` | Blanco cálido, sustituye al blanco puro — 22% |
| `velvet-wine` | Vino Terciopelo | `#431424` | Forros, cajas, fondos — 10% |
| `velvet-midnight` | Azul Medianoche | `#131C33` | Denim, exterior, fondos nocturnos — 5% |
| `velvet-burgundy` | Borgoña Señal | `#8E2440` | **Solo acento**: subrayados, estado activo, sellos — máx. 3-5% de la pieza, nunca un fondo grande |
| `velvet-indigo` | Índigo Humo | `#26355C` | Variante clara del azul — gráficos, estados secundarios |
| `velvet-ash` | Gris Ceniza | `#6E6A68` | Texto secundario, notas técnicas — nunca en titulares |

Permitido: blanco sobre negro, vino o azul · negro sobre blanco · borgoña
como acento sobre negro.
Prohibido: vino junto a azul en igual proporción · texto vino sobre azul ·
ceniza sobre vino · efectos metalizados de color.

## Tipografía

- **Bodoni Moda** (serif) — titulares, nombre de marca, portadas, citas.
  Nunca en texto largo ni bajo 15px. Clase: `font-display`.
- **Archivo** (sans) — texto corrido, fichas técnicas, UI, etiquetas.
  Clase: `font-body` (es la que hereda `body` por defecto).
- Etiquetas (talla, lote, sello): Archivo 600, tracking `0.2em`
  (`tracking-label`), **única mayúscula permitida** en toda la marca.

## Voz — cómo se escribe el copy

Serena, nunca eufórica. Precisa: nombra materiales, cortes, procesos.
Humor seco sin chiste fácil. Segura sin superioridad. Frases cortas, en
presente, sin adjetivos de exceso.

Ejemplos reales del manual:
- "Algodón peinado de 380 g. Cae recto y no se deforma. Bordado al pecho,
  hilo vino sobre negro."
- "Nueva entrega. Tres piezas. Se repone cuando se acaba."

Prohibido: urgencia comercial ("¡Últimas unidades!"), superlativos ("el
mejor", "único", "exclusivo"), cuenta regresiva, mayúsculas gritadas fuera
de una etiqueta, explicar el logotipo en la comunicación.

## Logo

Monograma "VN" cruzado por una órbita elíptica y un destello de cuatro
puntas. Monocromático siempre — su hogar natural es blanco sobre negro.
Tres activos en `public/brand/`:
- `logo-principal.png` — logotipo completo. Etiqueta colgante, portada,
  bolsa, avatar, estampado grande. No usar bajo 18mm impreso / 64px pantalla.
- `logo-isotipo.png` — trazo vertical con órbita. Bordado al pecho,
  etiqueta de cuello, formatos verticales estrechos.
- `logo-simbolo.png` — solo órbita y destello, sin letra. Sello, favicon,
  botón, patrón repetido. Es la base de `public/favicon.png`.

Nunca: deformar, recolorear, reencuadrar (cortar la órbita), sombrear,
reconstruir con otra tipografía, rotar, degradar la resolución.

## Elementos gráficos derivados (usar de a uno por pieza, no combinados)

- **Grano**: ruido fino 4-8% de opacidad sobre fondos planos.
- **Órbita**: la elipse aislada como marco/encuadre.
- **Destello**: estrella de 4 puntas — separa bloques, remata una línea.
  Máximo 3 por pieza.
- **Trama de terciopelo**: degradado radial sutil vino/azul sobre negro,
  solo como fondo (`bg-velvet-wine` / `bg-velvet-midnight` en Tailwind).

## Adaptación para la tienda online (UI tipo retail deportivo)

El manual (impreso/campaña) es monocromático sobre negro. Por pedido
explícito del cliente, la interfaz de la tienda (no el manual) adopta el
patrón visual de un e-commerce de moda deportiva premium tipo adidas.com:
**chrome blanco, tipografía y fotografía como protagonistas**, con el negro
y el borgoña reservados para momentos de campaña (hero de Home, franjas de
promoción) en vez de ser el fondo por defecto de toda la app. Mismos
tokens `velvet-*`, roles invertidos para la UI de producto/navegación:

| Rol | Antes (fondo oscuro) | Ahora (UI retail clara) |
|---|---|---|
| Fondo de página | `bg-velvet-black` | `bg-white` |
| Texto principal | `text-velvet-silk` | `text-velvet-black` |
| Texto secundario | `text-velvet-ash` | `text-velvet-ash` (sin cambio, funciona en ambos) |
| Bordes / separadores | `border-velvet-silk/10` | `border-velvet-black/10` |
| Fondo de imagen de producto | `bg-velvet-silk/[0.04]` | `bg-velvet-silk` (blanco cálido como lienzo, como el gris claro de adidas.com) |
| Botón primario | fondo seda, texto negro | fondo negro, texto blanco (invertido) |
| Acento | borgoña sobre negro | borgoña sobre blanco (mismo uso: <5%, nunca de fondo) |
| Header / nav | negro | blanco, con la barra de anuncio (envíos, ofertas) en negro arriba — igual que adidas.com |

Los "momentos de campaña" (hero de Home, banners de colección) SÍ conservan
el fondo negro/vino con grano, como una pieza de campaña insertada dentro de
una tienda blanca — no una regla que se rompe, sino el mismo patrón que usa
adidas.com (chrome blanco, bloques de campaña de color).
