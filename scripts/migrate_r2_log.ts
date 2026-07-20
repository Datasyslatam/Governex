import 'dotenv/config';
import { pool } from '../src/db.js';

async function runMigration() {
  try {
    console.log('Running migration for R2 upload logs table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registro_cargas_r2 (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        nombre_archivo VARCHAR(255) NOT NULL,
        key_r2 TEXT NOT NULL UNIQUE,
        mime_type VARCHAR(100) NOT NULL,
        tamano_bytes BIGINT NOT NULL,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      COMMENT ON TABLE registro_cargas_r2 IS 'Registro histórico de todas las cargas de documentos a R2.';
    `);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

runMigration();
