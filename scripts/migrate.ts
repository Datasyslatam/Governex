/**
 * Gestor de migraciones de Governex.
 *
 * Aplica en orden los archivos migrations/NNN_*.sql que aún no estén
 * registrados en la tabla de control `schema_migrations`.
 *
 * Uso:
 *   npm run migrate                    aplica las migraciones pendientes
 *   npm run migrate -- --status        muestra aplicadas y pendientes (no cambia nada)
 *   npm run migrate -- --baseline=NNN  registra 001..NNN como ya aplicadas SIN ejecutarlas
 *
 * Primera vez:
 *   - BD existente (producción), donde 001..019 se aplicaron a mano:
 *       npm run migrate -- --baseline=019   y luego   npm run migrate
 *   - BD nueva:
 *       psql "$DATABASE_URL" -f schema.sql  (equivale al estado tras la 005)
 *       npm run migrate -- --baseline=005   y luego   npm run migrate
 *
 * Seguridad: usa un advisory lock para que dos despliegues simultáneos no
 * apliquen migraciones a la vez; cada archivo corre en su propia transacción
 * (salvo los que ya traen BEGIN/COMMIT propios), y se detiene al primer error.
 */
import 'dotenv/config'
import { createHash } from 'crypto'
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { pool } from '../src/db'

const DIR = path.join(process.cwd(), 'migrations')
const LOCK_ID = 727_001 // identificador arbitrario y fijo del advisory lock
const args = process.argv.slice(2)
const soloEstado = args.includes('--status')
const baselineArg = args.find(a => a.startsWith('--baseline='))?.split('=')[1]

interface Archivo { version: string; nombre: string; sql: string; checksum: string }

function leerMigraciones(): Archivo[] {
  return readdirSync(DIR)
    .filter(f => /^\d{3}_.+\.sql$/.test(f))
    .sort()
    .map(nombre => {
      const sql = readFileSync(path.join(DIR, nombre), 'utf8')
      // Checksum sobre saltos de línea normalizados: Git en Windows convierte LF→CRLF
      // y eso no debe contar como "archivo modificado".
      const normalizado = sql.replace(/\r\n/g, '\n')
      return { version: nombre.slice(0, 3), nombre, sql, checksum: createHash('sha256').update(normalizado).digest('hex') }
    })
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está definida')
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID])
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     VARCHAR(10) PRIMARY KEY,
        nombre      TEXT        NOT NULL,
        checksum    TEXT        NOT NULL,
        modo        VARCHAR(10) NOT NULL CHECK (modo IN ('aplicada', 'baseline')),
        aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`)

    const archivos = leerMigraciones()
    const { rows } = await client.query('SELECT version, checksum, modo FROM schema_migrations')
    const registradas = new Map<string, { checksum: string; modo: string }>(
      rows.map(r => [r.version as string, { checksum: r.checksum as string, modo: r.modo as string }]))

    // Archivos modificados después de aplicarse: se avisa, no se re-ejecutan.
    for (const a of archivos) {
      const r = registradas.get(a.version)
      if (r && r.modo === 'aplicada' && r.checksum !== a.checksum) {
        console.warn(`AVISO: ${a.nombre} cambió después de aplicarse (no se vuelve a ejecutar).`)
      }
    }

    if (baselineArg) {
      if (!/^\d{3}$/.test(baselineArg)) throw new Error('--baseline debe ser un número de 3 dígitos, p. ej. --baseline=019')
      const base = archivos.filter(a => a.version <= baselineArg && !registradas.has(a.version))
      for (const a of base) {
        await client.query(
          `INSERT INTO schema_migrations (version, nombre, checksum, modo) VALUES ($1, $2, $3, 'baseline')`,
          [a.version, a.nombre, a.checksum])
      }
      console.log(`Línea base: ${base.length} migración(es) registradas como ya aplicadas (hasta ${baselineArg}).`)
      return
    }

    const pendientes = archivos.filter(a => !registradas.has(a.version))

    if (soloEstado) {
      for (const a of archivos) {
        const r = registradas.get(a.version)
        console.log(`${r ? (r.modo === 'baseline' ? 'línea base' : 'aplicada  ') : 'PENDIENTE '}  ${a.nombre}`)
      }
      console.log(`\n${pendientes.length} pendiente(s).`)
      return
    }

    if (registradas.size === 0) {
      const { rows: t } = await client.query(`SELECT to_regclass('public.tenants') IS NOT NULL AS existe`)
      console.error(
        'La tabla schema_migrations está vacía: no se sabe qué migraciones ya se aplicaron.\n' +
        (t[0].existe
          ? 'Esta BD ya tiene esquema. Confirme hasta qué migración está aplicada y registre la línea base,\n' +
            'normalmente:  npm run migrate -- --baseline=019'
          : 'BD vacía: cargue primero schema.sql y luego ejecute:  npm run migrate -- --baseline=005'))
      process.exitCode = 1
      return
    }

    if (pendientes.length === 0) {
      console.log('No hay migraciones pendientes.')
      return
    }

    for (const a of pendientes) {
      const gestionaSuTransaccion = /^\s*BEGIN\s*;/im.test(a.sql)
      process.stdout.write(`Aplicando ${a.nombre}... `)
      try {
        if (!gestionaSuTransaccion) await client.query('BEGIN')
        await client.query(a.sql)
        await client.query(
          `INSERT INTO schema_migrations (version, nombre, checksum, modo) VALUES ($1, $2, $3, 'aplicada')`,
          [a.version, a.nombre, a.checksum])
        if (!gestionaSuTransaccion) await client.query('COMMIT')
        console.log('OK')
      } catch (err) {
        if (!gestionaSuTransaccion) await client.query('ROLLBACK').catch(() => {})
        console.log('ERROR')
        console.error(`Se detuvo en ${a.nombre}:`, (err as Error).message)
        process.exitCode = 1
        return
      }
    }
    console.log(`${pendientes.length} migración(es) aplicadas.`)
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {})
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error(err.message || err)
  process.exitCode = 1
})
