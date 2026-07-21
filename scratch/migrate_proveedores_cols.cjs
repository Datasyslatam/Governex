const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function run() {
  try {
    await client.connect();
    console.log('Aplicando migración de columnas faltantes...');

    // Columnas faltantes en proveedor_evaluaciones
    await client.query(`
      ALTER TABLE proveedor_evaluaciones
        ADD COLUMN IF NOT EXISTS debilidades TEXT,
        ADD COLUMN IF NOT EXISTS precio_mercado VARCHAR(50),
        ADD COLUMN IF NOT EXISTS precio_proveedor VARCHAR(50),
        ADD COLUMN IF NOT EXISTS generada_con_ia BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log('✔ proveedor_evaluaciones: columnas debilidades, precio_mercado, precio_proveedor, generada_con_ia agregadas.');

    // Columnas faltantes en proveedores
    await client.query(`
      ALTER TABLE proveedores
        ADD COLUMN IF NOT EXISTS periodicidad_evaluacion VARCHAR(20) NOT NULL DEFAULT 'Anual',
        ADD COLUMN IF NOT EXISTS email VARCHAR(150);
    `);
    console.log('✔ proveedores: columnas periodicidad_evaluacion, email agregadas.');

    // Probar el query original del backend
    const res = await client.query(`
      SELECT pv.*,
             (SELECT row_to_json(e) FROM (
               SELECT total, fecha, calidad, entrega, precio, servicio, debilidades FROM proveedor_evaluaciones
               WHERE proveedor_id = pv.id AND tenant_id = pv.tenant_id
               ORDER BY fecha DESC, id DESC LIMIT 1
             ) e) AS ultima_evaluacion
       FROM proveedores pv
       WHERE pv.tenant_id = 1
       ORDER BY pv.razon
    `);
    console.log('✔ Query GET /proveedores ejecutado correctamente. Filas:', res.rows.length);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.end();
    console.log('Listo.');
  }
}

run();
