/**
 * Seeder de datos de demostración reales (Fase 16, ver docs/02-modelo-datos.md).
 *
 * Reutiliza los mismos services que usa la API real (`createCategory`,
 * `createProduct`, `createCoupon`) en vez de insertar filas a mano — así
 * los datos de ejemplo pasan por exactamente las mismas reglas de negocio
 * que un admin real usando el panel (slug/sku únicos, variante por
 * defecto, fila de inventario por variante, etc.), nada se simula ni se
 * salta.
 *
 * Idempotente: se puede correr varias veces sobre la misma base de datos
 * sin duplicar nada — cada entidad se busca primero por su clave única
 * (correo, slug de categoría, código de cupón) y solo se crea si no existe.
 *
 * Uso: `npm run seed` (backend/package.json).
 */
import { eq } from "drizzle-orm";
import { db, pool } from "./client";
import { users, storeSettings, categories, products } from "./schema";
import { hashPassword } from "../utils/hash";
import { slugify } from "../utils/slugify";
import { createCategory } from "../services/category.service";
import { createProduct } from "../services/product.service";
import { createCoupon } from "../services/coupon.service";

const DEMO_PASSWORD = "Passw0rd1";

async function seedStoreSettings() {
  const existing = await db.query.storeSettings.findFirst({ where: eq(storeSettings.id, 1) });
  if (existing) {
    console.log("• store_settings ya existe — sin cambios.");
    return;
  }
  await db.insert(storeSettings).values({
    id: 1,
    storeName: "Velvet Noise",
    contactEmail: "hola@velvetnoise.example.com",
    contactPhone: "+57 300 000 0000",
    address: "Bogotá, Colombia",
    currency: "COP",
    taxPercentage: "19",
  });
  console.log("✓ store_settings creado.");
}

async function seedUsers() {
  const demoUsers: { email: string; firstName: string; lastName: string; role: "ADMIN" | "CUSTOMER" }[] = [
    { email: "admin@velvetnoise.example.com", firstName: "Admin", lastName: "Principal", role: "ADMIN" },
    { email: "cliente1@velvetnoise.example.com", firstName: "Laura", lastName: "Gómez", role: "CUSTOMER" },
    { email: "cliente2@velvetnoise.example.com", firstName: "Carlos", lastName: "Ramírez", role: "CUSTOMER" },
  ];

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const u of demoUsers) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, u.email) });
    if (existing) {
      console.log(`• usuario ${u.email} ya existe — sin cambios.`);
      continue;
    }
    await db.insert(users).values({ ...u, passwordHash });
    console.log(`✓ usuario ${u.role === "ADMIN" ? "admin" : "cliente"} creado: ${u.email}`);
  }
}

interface SeedProduct {
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  isFeatured?: boolean;
  stock: number;
  images: string[];
  variants?: { color?: string; size?: string; stock: number }[];
}

interface SeedCategory {
  name: string;
  description: string;
  products: SeedProduct[];
}

// Imágenes: no existe fotografía real de producto para esta marca (no hay
// prendas físicas fotografiadas todavía). En vez de fotos de stock genéricas
// y sin relación real con el producto (lo cual sería engañoso — parecer una
// foto real que no es), cada producto usa un tile de catálogo generado a
// partir de la propia identidad de marca (fondo negro/vino/medianoche con
// grano, símbolo en marca de agua, nombre en tipografía serif) — ver
// `docs/05-verificacion-final.md` para el detalle de esta limitación
// conocida y cómo reemplazarlas por fotografía real cuando exista.
const CATALOG: SeedCategory[] = [
  {
    name: "Camisetas",
    description: "Camisetas y tops. Algodón pesado, cortes rectos, sin adornos de más.",
    products: [
      {
        name: "Camiseta Grano 380",
        description: "Algodón peinado de 380 g. Cae recto y no se deforma. Bordado al pecho, hilo vino sobre negro.",
        price: 99000,
        compareAtPrice: 129000,
        isFeatured: true,
        stock: 0,
        images: ["/products/camiseta-grano-380.jpg"],
        variants: [
          { color: "Negro", size: "S", stock: 14 },
          { color: "Negro", size: "M", stock: 18 },
          { color: "Negro", size: "L", stock: 9 },
          { color: "Blanco Seda", size: "M", stock: 11 },
          { color: "Blanco Seda", size: "L", stock: 6 },
        ],
      },
      {
        name: "Camiseta Destello Oversize",
        description: "Corte oversize, hombro caído. Estampado destello en la espalda, serigrafía mate.",
        price: 109000,
        stock: 0,
        images: ["/products/camiseta-destello-oversize.jpg"],
        variants: [
          { color: "Negro", size: "S", stock: 7 },
          { color: "Negro", size: "M", stock: 10 },
          { color: "Vino", size: "M", stock: 5 },
          { color: "Vino", size: "L", stock: 4 },
        ],
      },
      {
        name: "Top Silk Ribbed",
        description: "Punto canalé ajustado al cuerpo, cuello alto. Corte corto.",
        price: 89000,
        isFeatured: true,
        stock: 0,
        images: ["/products/top-silk-ribbed.jpg"],
        variants: [
          { color: "Blanco Seda", size: "XS", stock: 6 },
          { color: "Blanco Seda", size: "S", stock: 9 },
          { color: "Negro", size: "S", stock: 8 },
          { color: "Negro", size: "M", stock: 5 },
        ],
      },
      {
        name: "Camiseta Órbita Manga Larga",
        description: "Manga larga, puño acanalado. Print órbita en la manga izquierda.",
        price: 119000,
        compareAtPrice: 139000,
        stock: 0,
        images: ["/products/camiseta-orbita-manga-larga.jpg"],
        variants: [
          { color: "Negro", size: "M", stock: 7 },
          { color: "Negro", size: "L", stock: 6 },
          { color: "Índigo Humo", size: "M", stock: 5 },
        ],
      },
    ],
  },
  {
    name: "Sudaderas",
    description: "Sudaderas y hoodies. Interior perchado, siluetas amplias.",
    products: [
      {
        name: "Hoodie Terciopelo 450",
        description: "Felpa perchada de 450 g, capucha forrada. Bordado del isotipo al pecho.",
        price: 219000,
        isFeatured: true,
        stock: 0,
        images: ["/products/hoodie-terciopelo-450.jpg"],
        variants: [
          { color: "Negro", size: "S", stock: 8 },
          { color: "Negro", size: "M", stock: 12 },
          { color: "Negro", size: "L", stock: 9 },
          { color: "Vino", size: "M", stock: 6 },
          { color: "Vino", size: "L", stock: 4 },
        ],
      },
      {
        name: "Crewneck Noise",
        description: "Cuello redondo, puño y cintura acanalados. Destello serigrafiado al frente.",
        price: 179000,
        stock: 0,
        images: ["/products/crewneck-noise.jpg"],
        variants: [
          { color: "Negro", size: "S", stock: 6 },
          { color: "Negro", size: "M", stock: 8 },
          { color: "Azul Medianoche", size: "M", stock: 5 },
        ],
      },
      {
        name: "Hoodie Cropped",
        description: "Corte corto, cordón plano tono sobre tono. Felpa de 380 g.",
        price: 199000,
        compareAtPrice: 239000,
        isFeatured: true,
        stock: 0,
        images: ["/products/hoodie-cropped.jpg"],
        variants: [
          { color: "Vino", size: "XS", stock: 5 },
          { color: "Vino", size: "S", stock: 7 },
          { color: "Negro", size: "S", stock: 6 },
          { color: "Negro", size: "M", stock: 4 },
        ],
      },
    ],
  },
  {
    name: "Chaquetas",
    description: "Exterior. Denim, satín y ripstop para las capas de encima.",
    products: [
      {
        name: "Chaqueta Denim Cruda",
        description: "Denim de 14 oz sin lavar. Cae recto y se ajusta al cuerpo con el uso.",
        price: 259000,
        compareAtPrice: 299000,
        stock: 0,
        images: ["/products/chaqueta-denim-cruda.jpg"],
        variants: [
          { color: "Azul Medianoche", size: "S", stock: 4 },
          { color: "Azul Medianoche", size: "M", stock: 6 },
          { color: "Azul Medianoche", size: "L", stock: 3 },
        ],
      },
      {
        name: "Bomber Satinada",
        description: "Exterior satinado, forro interior vino. Bordado del isotipo en la espalda.",
        price: 349000,
        isFeatured: true,
        stock: 0,
        images: ["/products/bomber-satinada.jpg"],
        variants: [
          { color: "Negro", size: "S", stock: 3 },
          { color: "Negro", size: "M", stock: 5 },
          { color: "Negro", size: "L", stock: 2 },
        ],
      },
      {
        name: "Cortavientos Órbita",
        description: "Nylon ripstop, capucha ajustable. Print órbita reflectivo en la manga.",
        price: 289000,
        stock: 0,
        images: ["/products/cortavientos-orbita.jpg"],
        variants: [
          { color: "Negro", size: "M", stock: 5 },
          { color: "Azul Medianoche", size: "M", stock: 4 },
          { color: "Azul Medianoche", size: "L", stock: 3 },
        ],
      },
    ],
  },
  {
    name: "Pantalones",
    description: "Denim y sarga. Corte recto, tiro alto.",
    products: [
      {
        name: "Cargo Recto Noise",
        description: "Sarga de algodón, seis bolsillos, tiro alto. Corte recto sin ajuste en el tobillo.",
        price: 179000,
        isFeatured: true,
        stock: 0,
        images: ["/products/cargo-recto-noise.jpg"],
        variants: [
          { color: "Negro", size: "30", stock: 6 },
          { color: "Negro", size: "32", stock: 8 },
          { color: "Negro", size: "34", stock: 5 },
          { color: "Vino", size: "32", stock: 4 },
        ],
      },
      {
        name: "Jean Recto Crudo",
        description: "Denim rígido sin lavar, sin elastano. Cae recto de principio a fin.",
        price: 169000,
        compareAtPrice: 199000,
        stock: 0,
        images: ["/products/jean-recto-crudo.jpg"],
        variants: [
          { size: "30", stock: 5 },
          { size: "32", stock: 7 },
          { size: "34", stock: 4 },
          { size: "36", stock: 3 },
        ],
      },
      {
        name: "Jogger Terciopelo",
        description: "Punto perchado, puño y cintura ajustados con cordón plano.",
        price: 149000,
        stock: 0,
        images: ["/products/jogger-terciopelo.jpg"],
        variants: [
          { color: "Negro", size: "S", stock: 6 },
          { color: "Negro", size: "M", stock: 8 },
          { color: "Azul Medianoche", size: "M", stock: 5 },
        ],
      },
    ],
  },
  {
    name: "Accesorios",
    description: "Gorras, bolsos y piezas pequeñas. El símbolo, siempre discreto.",
    products: [
      {
        name: "Gorra Símbolo",
        description: "Gorra estructurada de seis paneles. Símbolo bordado al frente, cierre trasero metálico.",
        price: 79000,
        isFeatured: true,
        stock: 20,
        images: ["/products/gorra-simbolo.jpg"],
      },
      {
        name: "Medias Destello (pack x3)",
        description: "Pack de tres pares en algodón peinado. Destello tejido en el borde.",
        price: 39000,
        stock: 30,
        images: ["/products/medias-destello-pack-x3.jpg"],
      },
      {
        name: "Bolso Cruzado Terciopelo",
        description: "Exterior en cordura resistente al agua, forro interior vino. Correa ajustable.",
        price: 129000,
        compareAtPrice: 159000,
        stock: 0,
        images: ["/products/bolso-cruzado-terciopelo.jpg"],
      },
      {
        name: "Gorro Tejido Noise",
        description: "Punto grueso acanalado, etiqueta bordada en el doblez.",
        price: 59000,
        stock: 25,
        images: ["/products/gorro-tejido-noise.jpg"],
      },
    ],
  },
];

async function seedCatalog() {
  for (const cat of CATALOG) {
    let category = await db.query.categories.findFirst({ where: eq(categories.slug, slugify(cat.name)) });
    if (!category) {
      category = await createCategory({ name: cat.name, description: cat.description, isActive: true });
      console.log(`✓ categoría creada: ${cat.name}`);
    } else {
      console.log(`• categoría ${cat.name} ya existe — sin cambios.`);
    }

    for (const p of cat.products) {
      const existing = await db.query.products.findFirst({ where: eq(products.name, p.name) });
      if (existing) {
        console.log(`  • producto "${p.name}" ya existe — sin cambios.`);
        continue;
      }
      await createProduct({
        name: p.name,
        description: p.description,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        categoryId: category.id,
        isActive: true,
        isFeatured: p.isFeatured ?? false,
        minStock: 5,
        stock: p.variants ? undefined : p.stock,
        images: p.images.map((url, i) => ({ url, isPrimary: i === 0 })),
        variants: p.variants?.map((v) => ({ color: v.color, size: v.size, stock: v.stock })) ?? [],
      });
      console.log(`  ✓ producto creado: ${p.name}`);
    }
  }
}

async function seedCoupons() {
  const demoCoupons = [
    {
      code: "BIENVENIDO10",
      discountType: "PERCENTAGE" as const,
      percentage: 10,
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      maxUsesPerUser: 1,
    },
    {
      code: "ENVIOGRATIS",
      discountType: "FIXED" as const,
      fixedAmount: 12000,
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      minPurchase: 80000,
      maxUsesPerUser: 3,
    },
  ];

  for (const c of demoCoupons) {
    const existing = await db.query.coupons.findFirst({ where: (t, { eq }) => eq(t.code, c.code) });
    if (existing) {
      console.log(`• cupón ${c.code} ya existe — sin cambios.`);
      continue;
    }
    await createCoupon(c);
    console.log(`✓ cupón creado: ${c.code}`);
  }
}

async function main() {
  console.log("Sembrando datos de demostración...\n");
  await seedStoreSettings();
  await seedUsers();
  await seedCatalog();
  await seedCoupons();
  console.log(`\nListo. Credenciales de demostración (contraseña para todos: "${DEMO_PASSWORD}"):`);
  console.log("  admin@velvetnoise.example.com   (ADMIN)");
  console.log("  cliente1@velvetnoise.example.com (CUSTOMER)");
  console.log("  cliente2@velvetnoise.example.com (CUSTOMER)");
}

main()
  .catch((err) => {
    console.error("Error al sembrar datos:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
