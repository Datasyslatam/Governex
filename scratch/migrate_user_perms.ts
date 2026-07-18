import { Pool } from 'pg'
import 'dotenv/config'

async function run() {
  console.log('Running migration for user permissions (no-ssl)...')
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  })
  
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    // Add column if it doesn't exist
    await client.query(`
      ALTER TABLE USUARIOS 
      ADD COLUMN IF NOT EXISTS tiene_permisos_personalizados BOOLEAN NOT NULL DEFAULT FALSE;
    `)
    console.log('Added tiene_permisos_personalizados column to USUARIOS if it did not exist.')
    
    // Create user permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuario_permisos (
        usuario_id INTEGER NOT NULL REFERENCES USUARIOS (ID) ON DELETE CASCADE,
        permiso_id INTEGER NOT NULL REFERENCES permisos (ID) ON DELETE CASCADE,
        PRIMARY KEY (usuario_id, permiso_id)
      );
    `)
    console.log('Created usuario_permisos table if it did not exist.')

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
