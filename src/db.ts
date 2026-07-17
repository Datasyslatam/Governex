import { Pool } from 'pg'

const dbUrl = process.env.DATABASE_URL || ''
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal || dbUrl.includes('railway.internal')
    ? false
    : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  console.error('Error inesperado en pool de PostgreSQL:', err)
})