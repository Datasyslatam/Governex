import { pool } from '../src/db'

async function run() {
  try {
    await pool.query(`ALTER TABLE plan_formacion ADD COLUMN IF NOT EXISTS guia_markdown TEXT;`)
    console.log('Columna guia_markdown añadida exitosamente a plan_formacion.')
  } catch (err) {
    console.error('Error alterando la tabla:', err)
  } finally {
    process.exit(0)
  }
}

run()
