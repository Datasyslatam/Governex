import { Pool } from 'pg'

const dbUrl = process.env.DATABASE_URL || ''
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')

// Por defecto se mantiene rejectUnauthorized: false (comportamiento previo),
// porque el proxy público de Railway usa un certificado que Node no valida.
// Para conexiones externas con certificado válido, definir
// DB_SSL_REJECT_UNAUTHORIZED=true y así evitar ataques de intermediario (MITM).
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal || dbUrl.includes('railway.internal')
    ? false
    : { rejectUnauthorized },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  console.error('Error inesperado en pool de PostgreSQL:', err)
})

// Auto-run migration
pool.query(`ALTER TABLE plan_formacion ADD COLUMN IF NOT EXISTS guia_markdown TEXT;`)
  .then(() => console.log('Migración: Columna guia_markdown verificada'))
  .catch((e) => console.error('Error en migración:', e))