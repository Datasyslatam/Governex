import * as dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  const { pool } = await import('./db.ts');
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
    `);
    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit();
  }
}

migrate();
