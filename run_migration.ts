import { Client } from 'pg'
import fs from 'fs'
import 'dotenv/config'

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  })
  try {
    await client.connect()
    console.log('Conectado a BD')
    const migrationFile = process.argv[2] || 'migrations/017_add_descripcion_actividades_empresa.sql'
    console.log(`Ejecutando migración: ${migrationFile}`)
    const sql = fs.readFileSync(migrationFile, 'utf8')
    await client.query(sql)
    console.log(`Migración ejecutada correctamente: ${migrationFile}`)
  } catch(e) {
    console.error('Error', e)
  } finally {
    await client.end()
  }
}
run()
