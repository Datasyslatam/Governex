const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function run() {
  try {
    await client.connect();
    
    // Columnas de proveedor_evaluaciones
    const res1 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'proveedor_evaluaciones'
      ORDER BY ordinal_position
    `);
    console.log('Columnas de proveedor_evaluaciones:');
    res1.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

    // Columnas de proveedores
    const res2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'proveedores'
      ORDER BY ordinal_position
    `);
    console.log('\nColumnas de proveedores:');
    res2.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

    // Probar el query exacto que usa el backend
    try {
      const res3 = await client.query(`
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
      console.log('\nQuery ejecutado exitosamente. Filas:', res3.rows.length);
    } catch (qerr) {
      console.error('\nError en el query de proveedores:', qerr.message);
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.end();
  }
}

run();
