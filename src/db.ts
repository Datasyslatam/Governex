import { AsyncLocalStorage } from 'async_hooks'
import { readFileSync } from 'fs'
import { Pool, PoolClient } from 'pg'
import type { ConnectionOptions } from 'tls'

/**
 * Conexión a PostgreSQL (Fase 5).
 *
 * 1) Contexto de empresa para Row-Level Security (RLS, migración 024).
 *    Cada petición corre dentro de un contexto (AsyncLocalStorage):
 *      - empresa: { tenantId }        → la BD solo deja ver/escribir filas de esa empresa
 *      - sistema: { sistema: true }   → login, MFA, panel de plataforma y tareas internas
 *      - sin contexto                 → la BD no devuelve filas de las tablas protegidas
 *    Al entregar una conexión del pool se fija ese contexto en la sesión de
 *    PostgreSQL (`app.tenant_id`, `app.sistema`), y las políticas RLS lo usan.
 *    El código de las rutas no cambia: sigue usando pool.query / pool.connect.
 *    RLS solo es efectivo si la app se conecta con un rol que NO sea
 *    superusuario ni dueño de las tablas (rol `governex_app`, ver
 *    docs/seguridad/FASE_5_REGISTRO_CAMBIOS.md).
 *
 * 2) TLS. Por la red privada de Railway (`*.railway.internal`) el tráfico ya va
 *    cifrado con WireGuard y Postgres no ofrece TLS verificable, así que no se
 *    usa TLS. Hacia cualquier otro servidor que no sea local, TLS es
 *    obligatorio y el certificado SE VALIDA (antes no se validaba). Opciones:
 *      DB_SSL_CA=<ruta a un .pem>         CA propia del servidor
 *      DB_SSL_REJECT_UNAUTHORIZED=false   solo para el procedimiento manual de
 *                                         emergencia con el proxy público de Railway
 */

interface ContextoBD { tenantId: number | null; sistema: boolean }
const almacen = new AsyncLocalStorage<ContextoBD>()

/** Ejecuta fn con las consultas restringidas a una empresa. */
export function conTenant<T>(tenantId: number, fn: () => T): T {
  return almacen.run({ tenantId, sistema: false }, fn)
}
/** Ejecuta fn con acceso a todas las empresas (login, plataforma, tareas internas). */
export function comoSistema<T>(fn: () => T): T {
  return almacen.run({ tenantId: null, sistema: true }, fn)
}
/** Ejecuta fn sin contexto: las tablas protegidas no devuelven filas. */
export function sinContexto<T>(fn: () => T): T {
  return almacen.run({ tenantId: null, sistema: false }, fn)
}
export function contextoActual(): ContextoBD | undefined {
  return almacen.getStore()
}

const dbUrl = process.env.DATABASE_URL || ''
let host = ''
try { host = new URL(dbUrl).hostname } catch { /* URL vacía o inválida: la conexión fallará con su propio error */ }
const esLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)
const esRedPrivadaRailway = host.endsWith('.railway.internal')

function opcionesSsl(): false | ConnectionOptions {
  if (esLocal || esRedPrivadaRailway) return false
  const ca = process.env.DB_SSL_CA ? readFileSync(process.env.DB_SSL_CA, 'utf8') : undefined
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  if (!rejectUnauthorized) {
    console.warn('[db] ATENCIÓN: TLS hacia la BD SIN validar el certificado (DB_SSL_REJECT_UNAUTHORIZED=false). Úsese solo de forma temporal.')
  }
  return { rejectUnauthorized, ...(ca ? { ca } : {}) }
}

type ClienteConContexto = PoolClient & { __gxContexto?: string }

// Una consulta sin ningún contexto indica que se perdió el de la petición
// (p. ej. un callback de una librería basada en eventos): con RLS efectivo esa
// consulta no ve filas. Se avisa como máximo una vez por minuto, con la pila,
// para poder localizarla en los logs.
let ultimoAviso = 0
function avisarSinContexto() {
  const ahora = Date.now()
  if (ahora - ultimoAviso < 60_000) return
  ultimoAviso = ahora
  const pila = (new Error().stack || '').split('\n').slice(3, 8).map((l) => l.trim()).join(' | ')
  console.warn(`[db] consulta sin contexto de BD (empresa/sistema): no verá filas protegidas por RLS. ${pila}`)
}

class PoolConContexto extends Pool {
  // Solo se usa la forma con promesa (sin callback) en todo el código.
  override async connect(): Promise<PoolClient> {
    const client = (await super.connect()) as ClienteConContexto
    const ctx = almacen.getStore()
    if (!ctx) avisarSinContexto()
    const tenant = ctx?.tenantId != null ? String(ctx.tenantId) : ''
    const sistema = ctx?.sistema ? 'on' : 'off'
    const clave = `${tenant}|${sistema}`
    if (client.__gxContexto !== clave) {
      try {
        await client.query(
          "SELECT set_config('app.tenant_id', $1, false), set_config('app.sistema', $2, false)",
          [tenant, sistema]
        )
        client.__gxContexto = clave
      } catch (err) {
        client.release(err as Error) // descarta la conexión: no se sabe en qué contexto quedó
        throw err
      }
    }
    return client
  }

  override async query(config: any, values?: any): Promise<any> {
    const client = await this.connect()
    try {
      return await client.query(config, values)
    } finally {
      client.release()
    }
  }
}

export const pool = new PoolConContexto({
  connectionString: process.env.DATABASE_URL,
  ssl: opcionesSsl(),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  console.error('Error inesperado en pool de PostgreSQL:', err)
})

/**
 * Informa al arrancar si RLS es efectivo con el rol de conexión actual.
 * Con un superusuario o un rol con BYPASSRLS las políticas no se aplican.
 */
export async function verificarRolBD(): Promise<{ rol: string; rlsEfectivo: boolean; tablasSinRls: string[] }> {
  const { rows } = await comoSistema(() => pool.query(
    `SELECT current_user AS rol, r.rolsuper, r.rolbypassrls,
            EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user) AS es_duenio
     FROM pg_roles r WHERE r.rolname = current_user`))
  const r = rows[0]
  let tablasSinRls: string[] = []
  try {
    const { rows: t } = await comoSistema(() => pool.query('SELECT gx_tablas_tenant_sin_rls() AS t'))
    tablasSinRls = t.map((x: { t: string }) => x.t)
  } catch { /* migración 024 aún no aplicada */ }
  return { rol: r.rol, rlsEfectivo: !r.rolsuper && !r.rolbypassrls && !r.es_duenio, tablasSinRls }
}

// El ALTER TABLE de plan_formacion.guia_markdown que se ejecutaba aquí en
// cada arranque ahora vive en migrations/020_consolidar_ddl_huerfano.sql.
// El esquema se gestiona solo con migraciones (npm run migrate).
