#!/usr/bin/env node
/**
 * Pruebas de la Fase 5: rol de mínimo privilegio, RLS por empresa, TLS hacia
 * la BD y retención de sesiones. Verifican el comportamiento EN LA BASE DE
 * DATOS, no solo en la aplicación.
 *
 * Variables:
 *   DATABASE_URL       conexión con el rol dueño (prepara y limpia datos de prueba)
 *   APP_DATABASE_URL   conexión con el rol governex_app (el que usa la app)
 * Requiere `npm run build` (usa dist-server/db.js) y la migración 024 aplicada.
 *
 * Uso: node scripts/security/rls-tests.cjs [--json salida.json]
 * Solo para BD locales o de CI: crea y borra filas de prueba.
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { Client } = require('pg')

const OWNER_URL = process.env.DATABASE_URL
const APP_URL = process.env.APP_DATABASE_URL
if (!OWNER_URL || !APP_URL) {
  console.error('Defina DATABASE_URL (rol dueño) y APP_DATABASE_URL (rol governex_app).')
  process.exit(1)
}
for (const u of [OWNER_URL, APP_URL]) {
  const h = new URL(u).hostname
  if (!['127.0.0.1', 'localhost', '::1'].includes(h)) {
    console.error(`ABORTADO: ${h} no es local. Estas pruebas solo corren contra BD locales o de CI.`)
    process.exit(1)
  }
}

const resultados = []
async function prueba(id, nombre, fn) {
  try {
    const det = await fn()
    resultados.push({ id, nombre, ok: true, detalle: det || '' })
    console.log(`PASS  ${id}  ${nombre}${det ? `  [${det}]` : ''}`)
  } catch (e) {
    resultados.push({ id, nombre, ok: false, detalle: e.message })
    console.log(`FAIL  ${id}  ${nombre}  → ${e.message}`)
  }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

/** Ejecuta fn en una transacción de la app con el contexto indicado y la revierte. */
async function comoApp(app, ctx, fn) {
  await app.query('BEGIN')
  try {
    await app.query("SELECT set_config('app.tenant_id', $1, true), set_config('app.sistema', $2, true)",
      [ctx.tenant != null ? String(ctx.tenant) : '', ctx.sistema ? 'on' : 'off'])
    return await fn()
  } finally {
    await app.query('ROLLBACK')
  }
}
/** Espera que la consulta falle con el código SQLSTATE indicado. */
async function fallaCon(app, codigo, sql, params) {
  await app.query('SAVEPOINT p')
  try {
    await app.query(sql, params)
  } catch (e) {
    await app.query('ROLLBACK TO SAVEPOINT p')
    assert(e.code === codigo, `se esperaba ${codigo}, llegó ${e.code} (${e.message})`)
    return `${codigo}: ${e.message.slice(0, 70)}`
  }
  throw new Error(`se esperaba error ${codigo} y la sentencia se ejecutó`)
}

;(async () => {
  const owner = new Client({ connectionString: OWNER_URL }); await owner.connect()
  const app = new Client({ connectionString: APP_URL }); await app.connect()

  const { rows: ten } = await owner.query(
    `SELECT t.id FROM tenants t WHERE EXISTS (SELECT 1 FROM usuarios u WHERE u.tenant_id = t.id)
       AND EXISTS (SELECT 1 FROM tipos_proceso p WHERE p.tenant_id = t.id) ORDER BY t.id LIMIT 2`)
  assert(ten.length === 2, 'se necesitan 2 empresas con usuarios y tipos de proceso (datos de prueba)')
  const A = ten[0].id, B = ten[1].id

  await prueba('R01', 'La app se conecta con un rol sin superusuario, sin BYPASSRLS y sin ser dueño de tablas', async () => {
    const { rows } = await app.query(`SELECT current_user AS rol, r.rolsuper, r.rolbypassrls,
        EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tableowner=current_user) AS duenio
      FROM pg_roles r WHERE r.rolname = current_user`)
    const r = rows[0]
    assert(!r.rolsuper && !r.rolbypassrls && !r.duenio, JSON.stringify(r))
    return r.rol
  })

  await prueba('R02', 'Todas las tablas con tenant_id tienen RLS forzado (salvo sesiones y auditoria_eventos)', async () => {
    const { rows } = await owner.query('SELECT gx_tablas_tenant_sin_rls() AS t')
    assert(rows.length === 0, rows.map((x) => x.t).join(', '))
    const { rows: p } = await owner.query(`SELECT count(*)::int n FROM pg_policies WHERE policyname = 'gx_aislamiento_empresa'`)
    return `${p[0].n} tablas con política`
  })

  await prueba('R03', 'Sin contexto la BD no devuelve filas de empresa', () => comoApp(app, {}, async () => {
    const { rows } = await app.query('SELECT count(*)::int n FROM usuarios')
    assert(rows[0].n === 0, `${rows[0].n} filas`)
    return '0 usuarios visibles'
  }))

  await prueba('R04', 'Con contexto de empresa A solo se ven filas de A, aunque la consulta no filtre', () => comoApp(app, { tenant: A }, async () => {
    const { rows } = await app.query('SELECT DISTINCT tenant_id FROM usuarios')
    assert(rows.length === 1 && rows[0].tenant_id === A, JSON.stringify(rows))
    const { rows: b } = await app.query('SELECT count(*)::int n FROM usuarios WHERE tenant_id = $1', [B])
    assert(b[0].n === 0, `ve ${b[0].n} usuarios de B`)
    return `solo tenant ${A}`
  }))

  await prueba('R05', 'Empresa A no puede modificar ni borrar filas de B (0 filas afectadas)', () => comoApp(app, { tenant: A }, async () => {
    const u = await app.query('UPDATE tipos_proceso SET nombre = nombre WHERE tenant_id = $1', [B])
    const d = await app.query('DELETE FROM tipos_proceso WHERE tenant_id = $1', [B])
    assert(u.rowCount === 0 && d.rowCount === 0, `update ${u.rowCount}, delete ${d.rowCount}`)
    return 'update 0, delete 0'
  }))

  await prueba('R06', 'Empresa A no puede insertar filas a nombre de B', () => comoApp(app, { tenant: A }, () =>
    fallaCon(app, '42501', 'INSERT INTO tipos_proceso (nombre, tenant_id) VALUES ($1, $2)', ['rls-prueba', B])))

  await prueba('R07', 'Empresa A no puede mover una fila suya a B', () => comoApp(app, { tenant: A }, () =>
    fallaCon(app, '42501', 'UPDATE tipos_proceso SET tenant_id = $1 WHERE tenant_id = $2', [B, A])))

  await prueba('R08', 'Integridad padre→hijo (022) sigue bloqueando referencias a otra empresa con RLS activo', async () => {
    const { rows } = await owner.query('SELECT id FROM tipos_proceso WHERE tenant_id = $1 LIMIT 1', [B])
    return comoApp(app, { tenant: A }, () => fallaCon(app, '23503',
      'INSERT INTO procesos (codigo, nombre, tipo_id, tenant_id) VALUES ($1, $2, $3, $4)', ['RLS-T', 'rls-prueba', rows[0].id, A]))
  })

  await prueba('R09', 'Contexto "sistema" (login, plataforma) ve todas las empresas', () => comoApp(app, { sistema: true }, async () => {
    const { rows } = await app.query('SELECT count(DISTINCT tenant_id)::int n FROM usuarios')
    assert(rows[0].n >= 2, `${rows[0].n} empresas`)
    return `${rows[0].n} empresas`
  }))

  await prueba('R10', 'El rol de la app no puede crear, borrar ni alterar tablas, ni desactivar RLS', () => comoApp(app, {}, async () => {
    const r = []
    r.push(await fallaCon(app, '42501', 'CREATE TABLE rls_intruso (id int)'))
    r.push(await fallaCon(app, '42501', 'DROP TABLE tipos_proceso'))
    r.push(await fallaCon(app, '42501', 'ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY'))
    return `${r.length} intentos rechazados`
  }))

  await prueba('R11', 'El rol de la app no lee el control de migraciones ni modifica bitácoras', () => comoApp(app, { sistema: true }, async () => {
    await fallaCon(app, '42501', 'SELECT * FROM schema_migrations')
    await fallaCon(app, '42501', 'UPDATE auditoria_eventos SET accion = accion')
    await fallaCon(app, '42501', 'DELETE FROM logs_actividad')
    return '3 intentos rechazados'
  }))

  // Pruebas sobre el código real de la app (dist-server/db.js) con el rol de la app.
  process.env.DATABASE_URL = APP_URL
  const db = require(path.join(__dirname, '..', '..', 'dist-server', 'db.js'))

  await prueba('R12', 'La app (pool real) aplica el contexto: empresa / sin contexto / sistema', async () => {
    const a = await db.conTenant(A, () => db.pool.query('SELECT DISTINCT tenant_id FROM usuarios'))
    const n = await db.sinContexto(() => db.pool.query('SELECT count(*)::int n FROM usuarios'))
    const s = await db.comoSistema(() => db.pool.query('SELECT count(DISTINCT tenant_id)::int n FROM usuarios'))
    assert(a.rows.length === 1 && a.rows[0].tenant_id === A, `empresa: ${JSON.stringify(a.rows)}`)
    assert(n.rows[0].n === 0, `sin contexto: ${n.rows[0].n}`)
    assert(s.rows[0].n >= 2, `sistema: ${s.rows[0].n}`)
    return 'empresa=1, sin contexto=0, sistema>=2'
  })

  await prueba('R13', 'El contexto no se filtra entre peticiones concurrentes que comparten el pool', async () => {
    const tareas = []
    for (let i = 0; i < 200; i++) {
      const t = i % 2 ? A : B
      tareas.push(db.conTenant(t, async () => {
        const c = await db.pool.connect() // también la forma con transacción
        try {
          await c.query('SELECT pg_sleep(0.001)')
          const { rows } = await c.query('SELECT DISTINCT tenant_id FROM usuarios')
          return rows.length === 1 && rows[0].tenant_id === t
        } finally { c.release() }
      }))
      tareas.push(db.conTenant(t, async () => {
        const { rows } = await db.pool.query('SELECT DISTINCT tenant_id FROM usuarios')
        return rows.length === 1 && rows[0].tenant_id === t
      }))
    }
    const ok = await Promise.all(tareas)
    const malos = ok.filter((x) => !x).length
    assert(malos === 0, `${malos} de ${ok.length} consultas vieron otra empresa`)
    return `${ok.length} consultas concurrentes correctas`
  })

  await prueba('R14', 'Retención: se borran sesiones vencidas/revocadas hace más de 30 días, no las vigentes', async () => {
    const { rows: u } = await owner.query('SELECT id, tenant_id FROM usuarios WHERE tenant_id = $1 LIMIT 1', [A])
    const ids = []
    for (const [nombre, expira, revocada] of [
      ['vieja-vencida', "NOW() - interval '40 days'", 'NULL'],
      ['vieja-revocada', "NOW() + interval '1 day'", "NOW() - interval '31 days'"],
      ['vigente', "NOW() + interval '1 day'", 'NULL'],
    ]) {
      const { rows } = await owner.query(
        `INSERT INTO sesiones (id, token_hash, tipo, etapa, usuario_id, tenant_id, csrf_token, expira_en, revocada_en)
         VALUES (gen_random_uuid(), $1, 'tenant', 'activa', $2, $3, 'x', ${expira}, ${revocada}) RETURNING id`,
        [`rls-prueba-${nombre}-${Date.now()}`, u[0].id, u[0].tenant_id])
      ids.push(rows[0].id)
    }
    const ret = require(path.join(__dirname, '..', '..', 'dist-server', 'security', 'retention.js'))
    await ret.purgarSesiones()
    const { rows } = await owner.query('SELECT id FROM sesiones WHERE id = ANY($1::uuid[])', [ids])
    await owner.query('DELETE FROM sesiones WHERE id = ANY($1::uuid[])', [ids])
    assert(rows.length === 1 && rows[0].id === ids[2], `quedaron ${rows.length}`)
    return '2 borradas, 1 vigente conservada'
  })

  await prueba('R15', 'TLS hacia una BD externa valida el certificado; red privada y local sin TLS', async () => {
    const ver = (url, extra = {}) => JSON.parse(execFileSync(process.execPath, ['-e',
      `process.env.DATABASE_URL=${JSON.stringify(url)};const {pool}=require(${JSON.stringify(path.join(__dirname, '..', '..', 'dist-server', 'db.js'))});console.log(JSON.stringify(pool.options.ssl===false?false:{r:pool.options.ssl.rejectUnauthorized}));process.exit(0)`],
      { env: { ...process.env, DB_SSL_REJECT_UNAUTHORIZED: '', ...extra }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim())
    const externo = ver('postgresql://u:p@db.ejemplo.invalid:5432/x')
    const interno = ver('postgresql://u:p@postgres.railway.internal:5432/railway')
    const local = ver('postgresql://u:p@127.0.0.1:5433/x')
    const exento = ver('postgresql://u:p@db.ejemplo.invalid:5432/x', { DB_SSL_REJECT_UNAUTHORIZED: 'false' })
    assert(externo && externo.r === true, `externo: ${JSON.stringify(externo)}`)
    assert(interno === false && local === false, `interno ${interno}, local ${local}`)
    assert(exento && exento.r === false, `exención explícita: ${JSON.stringify(exento)}`)
    return 'externo=verifica, interno/local=sin TLS, exención solo explícita'
  })

  await db.pool.end()
  await app.end(); await owner.end()

  const ok = resultados.filter((r) => r.ok).length
  console.log(`\nResultado: ${ok}/${resultados.length} pruebas superadas`)
  const iJson = process.argv.indexOf('--json')
  if (iJson > -1 && process.argv[iJson + 1]) {
    fs.writeFileSync(process.argv[iJson + 1], JSON.stringify({ fecha: new Date().toISOString(), total: resultados.length, superadas: ok, resultados }, null, 2))
  }
  process.exit(ok === resultados.length ? 0 : 1)
})().catch((e) => { console.error('Error:', e.message); process.exit(1) })
