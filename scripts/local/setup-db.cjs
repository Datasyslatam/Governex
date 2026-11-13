#!/usr/bin/env node
/**
 * Construye la BD LOCAL de pruebas desde cero y siembra datos de prueba.
 *
 * SEGURIDAD: se niega a ejecutarse si DATABASE_URL no apunta a 127.0.0.1 /
 * localhost. Nunca debe correr contra Railway ni contra producción.
 *
 * Pasos:
 *   1. schema.sql (equivale al estado tras la migración 005)
 *   2. Gestor de migraciones (scripts/migrate.ts): línea base 005 y luego
 *      006..última, igual que en CI y que en producción.
 *   3. Siembra: 2 empresas (A y B), 3 usuarios por empresa (uno por rol),
 *      1 usuario Operativo con permisos personalizados y 1 platform_admin.
 *      Contraseña de todos: LOCAL_SEED_PASSWORD (.env).
 *
 * Uso: node scripts/local/setup-db.cjs [--reset]
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
const { execFileSync } = require('child_process')
const bcrypt = require('bcryptjs')

const root = path.join(__dirname, '..', '..')
const url = process.env.DATABASE_URL || ''
const seedPassword = process.env.LOCAL_SEED_PASSWORD

let host
try { host = new URL(url).hostname } catch { host = '' }
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  console.error(`[setup-db] ABORTADO: DATABASE_URL apunta a "${host || '(vacío)'}". Este script solo corre contra una BD local.`)
  process.exit(1)
}
if (!seedPassword) {
  console.error('[setup-db] Falta LOCAL_SEED_PASSWORD en .env (ejecuta scripts/local/init-env.cjs).')
  process.exit(1)
}

async function run() {
  const client = new Client({ connectionString: url, ssl: false })
  await client.connect()
  try {
    if (process.argv.includes('--reset')) {
      console.log('[setup-db] --reset: borrando esquema public local')
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    }

    console.log('[setup-db] Aplicando schema.sql')
    await client.query(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'))

    // Mismo camino que CI y producción: gestor con tabla schema_migrations.
    const tsx = (args) => execFileSync('npx', ['tsx', path.join('scripts', 'migrate.ts'), ...args],
      { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env: process.env })
    tsx(['--baseline=005'])
    tsx([])

    // ── Siembra ─────────────────────────────────────────────
    const hash = await bcrypt.hash(seedPassword, 10)
    const tenants = [
      { nombre: 'Empresa A (prueba local)', nit: 'LOCAL-A', slug: 'a' },
      { nombre: 'Empresa B (prueba local)', nit: 'LOCAL-B', slug: 'b' },
    ]
    const roles = [
      ['Superusuario', 'super'],
      ['Gestión', 'gestion'],
      ['Operativo', 'operativo'],
    ]
    for (const t of tenants) {
      const { rows } = await client.query(
        `INSERT INTO tenants (nombre, nit, estado, plan) VALUES ($1, $2, 'Activo', 'Standard')
         ON CONFLICT (nit) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
        [t.nombre, t.nit]
      )
      const tenantId = rows[0].id
      await client.query(
        `INSERT INTO tipos_proceso (nombre, tenant_id) VALUES ('Estratégico',$1),('Misional',$1),('Apoyo',$1) ON CONFLICT DO NOTHING`,
        [tenantId]
      )
      for (const [rol, slug] of roles) {
        await client.query(
          `INSERT INTO usuarios (nombre, email, password_hash, rol_id, tenant_id)
           VALUES ($1, $2, $3, (SELECT id FROM roles WHERE nombre = $4), $5)
           ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, activo = true`,
          [`${slug} ${t.slug.toUpperCase()}`, `${slug}.${t.slug}@governex.test`, hash, rol, tenantId]
        )
      }
      // Usuario con permisos personalizados: SOLO 'riesgos:leer' (prueba de BFLA)
      const { rows: u } = await client.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol_id, tenant_id, tiene_permisos_personalizados)
         VALUES ($1, $2, $3, (SELECT id FROM roles WHERE nombre = 'Operativo'), $4, true)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, tiene_permisos_personalizados = true
         RETURNING id`,
        [`limitado ${t.slug.toUpperCase()}`, `limitado.${t.slug}@governex.test`, hash, tenantId]
      )
      await client.query('DELETE FROM usuario_permisos WHERE usuario_id = $1', [u[0].id])
      await client.query(
        `INSERT INTO usuario_permisos (usuario_id, permiso_id)
         SELECT $1, id FROM permisos WHERE recurso = 'riesgos' AND accion = 'leer'`,
        [u[0].id]
      )
    }
    await client.query(
      `INSERT INTO platform_admins (nombre, email, password_hash) VALUES ('Admin local', 'platform@governex.test', $1)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, activo = true`,
      [hash]
    )

    const { rows: count } = await client.query(
      `SELECT (SELECT count(*) FROM tenants) t, (SELECT count(*) FROM usuarios) u, (SELECT count(*) FROM permisos) p, (SELECT count(*) FROM rol_permisos) rp`
    )
    console.log(`[setup-db] Listo. tenants=${count[0].t} usuarios=${count[0].u} permisos=${count[0].p} rol_permisos=${count[0].rp}`)
    console.log('[setup-db] Usuarios: {super|gestion|operativo|limitado}.{a|b}@governex.test, platform@governex.test (contraseña: LOCAL_SEED_PASSWORD de .env)')
  } finally {
    await client.end()
  }
}

run().catch((e) => {
  console.error('[setup-db] Error:', e.message)
  process.exit(1)
})
