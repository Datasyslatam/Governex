/**
 * Sesiones del lado del servidor (V06, V07; OWASP ASVS V3).
 *
 * Reemplaza el JWT guardado en localStorage:
 *  - El navegador recibe un identificador aleatorio de 256 bits en una cookie
 *    HttpOnly + SameSite=Strict (+ Secure en producción). JavaScript no puede
 *    leerla, así que un XSS ya no puede robar la sesión.
 *  - En la BD solo se guarda su hash SHA-256 (si se filtra la tabla, los
 *    identificadores no sirven).
 *  - Revocable al instante: logout, cambio de contraseña, desactivación del
 *    usuario, cambio de rol o cierre remoto desde "Sesiones activas".
 *  - Expira por inactividad (SESSION_IDLE_MIN, 30 min) y por duración
 *    absoluta (SESSION_MAX_HOURS, 8 h; platform: PLATFORM_SESSION_MAX_HOURS, 4 h).
 *  - CSRF: token sincronizador por sesión. Se entrega en una cookie legible
 *    (gx_csrf) y el frontend debe reenviarlo en la cabecera X-CSRF-Token en
 *    toda petición que modifique datos.
 */
import crypto from 'crypto'
import { Request, Response } from 'express'
import { pool } from '../db'

export type TipoSesion = 'tenant' | 'platform'
export type EtapaSesion = 'mfa' | 'enrolar_mfa' | 'activa'

const PROD = process.env.NODE_ENV === 'production'
const IDLE_MS = Number(process.env.SESSION_IDLE_MIN || 30) * 60_000
const MAX_TENANT_MS = Number(process.env.SESSION_MAX_HOURS || 8) * 3_600_000
const MAX_PLATFORM_MS = Number(process.env.PLATFORM_SESSION_MAX_HOURS || 4) * 3_600_000
export const PREAUTH_MS = 5 * 60_000
export const SUPLANTACION_MS = Number(process.env.IMPERSONATION_MIN || 30) * 60_000

export const COOKIES = {
  tenant: { session: 'gx_session', csrf: 'gx_csrf', path: '/api' },
  platform: { session: 'gx_psession', csrf: 'gx_pcsrf', path: '/api/platform-admin' },
} as const

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function leerCookie(req: Request, nombre: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const parte of header.split(';')) {
    const i = parte.indexOf('=')
    if (i < 0) continue
    if (parte.slice(0, i).trim() === nombre) {
      try { return decodeURIComponent(parte.slice(i + 1).trim()) } catch { return undefined }
    }
  }
  return undefined
}

function clientIp(req: Request): string {
  return String(req.ip || '').slice(0, 64)
}

interface NuevaSesion {
  tipo: TipoSesion
  etapa: EtapaSesion
  usuarioId?: number
  platformAdminId?: number
  tenantId?: number
  suplantadoPorAdmin?: number
  duracionMs?: number
}

export async function crearSesion(req: Request, res: Response, s: NuevaSesion) {
  const token = crypto.randomBytes(32).toString('base64url')
  const csrf = crypto.randomBytes(24).toString('base64url')
  const id = crypto.randomUUID()
  const maxMs = s.duracionMs ?? (s.etapa !== 'activa' ? PREAUTH_MS : s.tipo === 'platform' ? MAX_PLATFORM_MS : MAX_TENANT_MS)
  const expira = new Date(Date.now() + maxMs)

  await pool.query(
    `INSERT INTO sesiones (id, token_hash, tipo, etapa, usuario_id, platform_admin_id, tenant_id, suplantado_por_admin,
                           csrf_token, ip, user_agent, expira_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, hashToken(token), s.tipo, s.etapa, s.usuarioId ?? null, s.platformAdminId ?? null, s.tenantId ?? null,
     s.suplantadoPorAdmin ?? null, csrf, clientIp(req), String(req.headers['user-agent'] || '').slice(0, 300), expira]
  )

  const c = COOKIES[s.tipo]
  const base = { httpOnly: true, secure: PROD, sameSite: 'strict' as const, path: c.path, maxAge: maxMs }
  res.cookie(c.session, token, base)
  // Legible por JS (no es secreta frente a XSS, sí frente a otros sitios).
  res.cookie(c.csrf, csrf, { ...base, httpOnly: false, path: '/' })
  return { id, csrf, expira }
}

export function limpiarCookies(res: Response, tipo: TipoSesion) {
  const c = COOKIES[tipo]
  res.clearCookie(c.session, { path: c.path, httpOnly: true, secure: PROD, sameSite: 'strict' })
  res.clearCookie(c.csrf, { path: '/', secure: PROD, sameSite: 'strict' })
}

export interface SesionDB {
  id: string
  tipo: TipoSesion
  etapa: EtapaSesion
  usuario_id: number | null
  platform_admin_id: number | null
  tenant_id: number | null
  suplantado_por_admin: number | null
  csrf_token: string
  creada_en: Date
  ultimo_uso_en: Date
  expira_en: Date
}

// Caché corta para no consultar la BD en cada petición. Una revocación hecha
// en esta instancia limpia la caché al momento; en otra réplica tarda ≤ 10 s.
const CACHE_MS = 10_000
const cache = new Map<string, { s: SesionDB; hasta: number }>()

export function olvidarCache(predicado?: (s: SesionDB) => boolean) {
  if (!predicado) return cache.clear()
  for (const [k, v] of cache) if (predicado(v.s)) cache.delete(k)
}

/** Devuelve la sesión válida asociada a la cookie, o null. Lanza si la BD falla. */
export async function obtenerSesion(req: Request, tipo: TipoSesion): Promise<SesionDB | null> {
  const token = leerCookie(req, COOKIES[tipo].session)
  if (!token || token.length > 100) return null
  const h = hashToken(token)
  const now = Date.now()

  let s: SesionDB | undefined
  const c = cache.get(h)
  if (c && c.hasta > now) s = c.s
  else {
    const { rows } = await pool.query(
      `SELECT id, tipo, etapa, usuario_id, platform_admin_id, tenant_id, suplantado_por_admin, csrf_token,
              creada_en, ultimo_uso_en, expira_en
       FROM sesiones WHERE token_hash = $1 AND tipo = $2 AND revocada_en IS NULL`,
      [h, tipo]
    )
    s = rows[0]
    if (!s) { cache.delete(h); return null }
    cache.set(h, { s, hasta: now + CACHE_MS })
  }

  if (new Date(s.expira_en).getTime() <= now) { cache.delete(h); return null }
  if (s.etapa === 'activa' && now - new Date(s.ultimo_uso_en).getTime() > IDLE_MS) {
    cache.delete(h)
    await revocarSesion(s.id, 'inactividad')
    return null
  }

  // Marca de actividad como máximo una vez por minuto.
  if (s.etapa === 'activa' && now - new Date(s.ultimo_uso_en).getTime() > 60_000) {
    s.ultimo_uso_en = new Date(now)
    pool.query('UPDATE sesiones SET ultimo_uso_en = NOW() WHERE id = $1', [s.id]).catch(() => {})
  }
  return s
}

export async function revocarSesion(id: string, motivo: string) {
  await pool.query(
    `UPDATE sesiones SET revocada_en = NOW(), motivo_revocacion = $2 WHERE id = $1 AND revocada_en IS NULL`,
    [id, motivo]
  )
  olvidarCache((s) => s.id === id)
}

/** Revoca todas las sesiones de un usuario de empresa (opcionalmente menos una). */
export async function revocarSesionesUsuario(usuarioId: number, motivo: string, exceptoId?: string) {
  await pool.query(
    `UPDATE sesiones SET revocada_en = NOW(), motivo_revocacion = $2
     WHERE usuario_id = $1 AND revocada_en IS NULL AND ($3::uuid IS NULL OR id <> $3::uuid)`,
    [usuarioId, motivo, exceptoId ?? null]
  )
  olvidarCache((s) => s.usuario_id === usuarioId && s.id !== exceptoId)
}

export async function revocarSesionesPlatform(adminId: number, motivo: string, exceptoId?: string) {
  await pool.query(
    `UPDATE sesiones SET revocada_en = NOW(), motivo_revocacion = $2
     WHERE platform_admin_id = $1 AND revocada_en IS NULL AND ($3::uuid IS NULL OR id <> $3::uuid)`,
    [adminId, motivo, exceptoId ?? null]
  )
  olvidarCache((s) => s.platform_admin_id === adminId && s.id !== exceptoId)
}

/** Verifica el token CSRF en métodos que modifican estado. */
export function csrfValido(req: Request, s: SesionDB): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true
  const enviado = String(req.headers['x-csrf-token'] || '')
  if (!enviado || enviado.length !== s.csrf_token.length) return false
  return crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(s.csrf_token))
}
