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
    const sql = fs.readFileSync('migrations/016_perfiles_cargo.sql', 'utf8')
    await client.query(sql)
    console.log('Migración 016 ejecutada correctamente')
  } catch(e) {
    console.error('Error', e)
  } finally {
    await client.end()
  }
}
run()
