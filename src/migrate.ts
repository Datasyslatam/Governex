import * as dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  const { pool } = await import('./db');
  console.log('Running migration on procesos table...');
  try {
    await pool.query(`
      ALTER TABLE procesos ADD COLUMN IF NOT EXISTS actividades TEXT;
      ALTER TABLE procesos ADD COLUMN IF NOT EXISTS indicador_entrada TEXT;
      ALTER TABLE procesos ADD COLUMN IF NOT EXISTS indicador_actividad TEXT;
      ALTER TABLE procesos ADD COLUMN IF NOT EXISTS indicador_salida TEXT;
      ALTER TABLE procesos ADD COLUMN IF NOT EXISTS riesgo_entrada TEXT;
      ALTER TABLE procesos ADD COLUMN IF NOT EXISTS op_entrada TEXT;
      ALTER TABLE procesos ADD COLUMN IF NOT EXISTS riesgo_actividad TEXT;
      ALTER TABLE procesos ADD COLUMN IF NOT EXISTS op_actividad TEXT;
      ALTER TABLE procesos ADD COLUMN IF NOT EXISTS riesgo_salida TEXT;
      ALTER TABLE procesos ADD COLUMN IF NOT EXISTS op_salida TEXT;

      -- Fichas Técnicas Compras
      ALTER TABLE fichas_tecnicas_compra ADD COLUMN IF NOT EXISTS variables_criticas TEXT;
      ALTER TABLE fichas_tecnicas_compra ADD COLUMN IF NOT EXISTS proveedor_id INTEGER;

      -- Evaluaciones
      ALTER TABLE proveedor_evaluaciones ADD COLUMN IF NOT EXISTS variables_evaluadas TEXT;
      ALTER TABLE evaluaciones_orden_compra ADD COLUMN IF NOT EXISTS variables_evaluadas TEXT;
    `);
    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit();
  }
}

migrate();
