import { Pool } from 'pg'
import 'dotenv/config'

async function run() {
  console.log('Running migration for activity logs (no-ssl)...')
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  })
  
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    // Create activity logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS logs_actividad (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES USUARIOS (ID) ON DELETE SET NULL,
        usuario_nombre VARCHAR(150),
        usuario_email VARCHAR(150),
        usuario_rol VARCHAR(50),
        accion VARCHAR(100) NOT NULL,
        recurso VARCHAR(100),
        detalle TEXT,
        fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    console.log('Created logs_actividad table if it did not exist.')

    await client.query('COMMIT')
    console.log('Migration finished successfully!')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Migration failed:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
