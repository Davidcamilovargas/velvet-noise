/**
 * Agrega fotos adicionales a un producto que YA existe en la base de datos,
 * sin tocar su foto principal (posición 0). Pensado para el caso de "ya
 * sembré el catálogo, ahora quiero agregarle más ángulos a un producto
 * puntual" sin tener que escribir SQL a mano en el panel de Neon.
 *
 * Uso (desde la carpeta backend/, con las dependencias ya instaladas):
 *
 *   DATABASE_URL="postgresql://usuario:password@host/db?sslmode=require" \
 *     node scripts/add-product-images.js "Jean Recto Crudo" \
 *       /products/jean-recto-crudo-2.jpg \
 *       /products/jean-recto-crudo-3.jpg \
 *       /products/jean-recto-crudo-4.jpg
 *
 * En Windows (PowerShell), la variable de entorno va en una línea aparte:
 *
 *   $env:DATABASE_URL="postgresql://...";
 *   node scripts/add-product-images.js "Jean Recto Crudo" /products/jean-recto-crudo-2.jpg
 *
 * Cada URL debe ser la ruta pública de una imagen que YA esté en
 * frontend/public/products/ (y ya subida/desplegada) — este script solo
 * crea las filas en product_images, no sube archivos.
 */
const { Client } = require("pg");

async function main() {
  const [, , productName, ...imageUrls] = process.argv;

  if (!productName || imageUrls.length === 0) {
    console.error(
      'Uso: node scripts/add-product-images.js "Nombre exacto del producto" /products/imagen1.jpg [/products/imagen2.jpg ...]'
    );
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Falta la variable de entorno DATABASE_URL (la connection string de Neon).");
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows: productRows } = await client.query("SELECT id FROM products WHERE name = $1", [productName]);
    if (productRows.length === 0) {
      console.error(`No se encontró ningún producto con el nombre exacto "${productName}".`);
      process.exit(1);
    }
    const productId = productRows[0].id;

    const { rows: existing } = await client.query(
      "SELECT COALESCE(MAX(position), -1) AS max_position FROM product_images WHERE product_id = $1",
      [productId]
    );
    let nextPosition = Number(existing[0].max_position) + 1;

    for (const url of imageUrls) {
      await client.query(
        "INSERT INTO product_images (product_id, url, position, is_primary) VALUES ($1, $2, $3, false)",
        [productId, url, nextPosition]
      );
      console.log(`✓ agregada ${url} (posición ${nextPosition})`);
      nextPosition++;
    }

    console.log(`Listo — "${productName}" ahora tiene ${nextPosition} foto(s) en total.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});