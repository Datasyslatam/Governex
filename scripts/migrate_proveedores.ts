import { pool } from '../src/db.js';

async function runMigration() {
  try {
    console.log('Running migration for Proveedores IA...');
    await pool.query(`
      ALTER TABLE PROVEEDORES
        ADD COLUMN IF NOT EXISTS periodicidad_evaluacion VARCHAR(20) DEFAULT 'Anual' CHECK (periodicidad_evaluacion IN ('Semestral', 'Anual')),
        ADD COLUMN IF NOT EXISTS email VARCHAR(150);

      ALTER TABLE PROVEEDOR_EVALUACIONES
        ADD COLUMN IF NOT EXISTS precio_mercado NUMERIC,
        ADD COLUMN IF NOT EXISTS precio_proveedor NUMERIC,
        ADD COLUMN IF NOT EXISTS debilidades TEXT,
        ADD COLUMN IF NOT EXISTS generada_con_ia BOOLEAN DEFAULT FALSE;
    `);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

runMigration();
