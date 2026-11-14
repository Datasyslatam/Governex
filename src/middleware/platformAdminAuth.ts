import net from 'net'
import { Request, Response, NextFunction } from 'express'
import { pool } from '../db'
import { obtenerSesion, csrfValido, SesionDB } from '../security/sessions'
import { auditar } from '../security/audit'

/**
 * Autenticación de platform_admin por sesión del servidor (Fase 2).
 * Cookie propia `gx_psession` (Path=/api/platform-admin), distinta de la de
 * empresas: nunca comparten credencial ni superficie. MFA obligatorio
 * (la sesión solo llega a etapa "activa" tras verificar el código).
 *
 * Fase 3 (V20):
 *  - Roles de plataforma: "propietario" (además gestiona a otros
 *    administradores) y "operador" (empresas, soporte, suplantación).
 *  - Lista opcional de IP permitidas: PLATFORM_ADMIN_IP_ALLOWLIST
 *    (IPs o rangos CIDR IPv4 separados por coma). Vacía = sin restricción.
 */
export type RolPlataforma = 'propietario' | 'operador'

export interface PlatformAdminRequest extends Request {
  platformAdmin?: {
    id: number
    email: string
    rol?: RolPlataforma
    sesionId?: string
  }
  sesion?: SesionDB
}

const PERMITIDAS_CAMBIO_PASSWORD = new Set(['/api/platform-admin/me', '/api/platform-admin/password', '/api/platform-admin/logout'])

// ── Lista de IP permitidas ─────────────────────────────────────────
function ipv4ANumero(ip: string): number {
  return ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0
}

function coincide(ip: string, regla: string): boolean {
  if (!regla.includes('/')) return ip === regla
  const [base, bitsTxt] = regla.split('/')
  const bits = Number(bitsTxt)
  if (!net.isIPv4(ip) || !net.isIPv4(base) || !(bits >= 0 && bits <= 32)) return false
  const mascara = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipv4ANumero(ip) & mascara) === (ipv4ANumero(base) & mascara)
}

export function ipPermitida(ipRaw: string | undefined, lista = process.env.PLATFORM_ADMIN_IP_ALLOWLIST || ''): boolean {
  const reglas = lista.split(',').map((r) => r.trim()).filter(Boolean)
  if (reglas.length === 0) return true
  const ip = String(ipRaw || '').replace(/^::ffff:/, '')
  return reglas.some((r) => coincide(ip, r))
}

// ── Autenticación ─────────────────────────────────────────────────
export async function platformAdminMiddleware(req: PlatformAdminRequest, res: Response, next: NextFunction) {
  let sesion: SesionDB | null
  try {
    sesion = await obtenerSesion(req, 'platform')
  } catch (err) {
    console.error('[platformAdminMiddleware] error consultando sesión:', err)
    return res.status(503).json({ error: 'Servicio temporalmente no disponible.' })
  }
  if (!sesion || sesion.etapa !== 'activa' || !sesion.platform_admin_id) {
    return res.status(401).json({ error: 'Sesión no válida o expirada', code: 'NO_SESSION' })
  }

  const { rows } = await pool.query(
    'SELECT id, email, rol, activo, debe_cambiar_password FROM platform_admins WHERE id = $1',
    [sesion.platform_admin_id]
  )
  const admin = rows[0]
  if (!admin || !admin.activo) {
    return res.status(401).json({ error: 'Sesión no válida o expirada', code: 'NO_SESSION' })
  }
  if (!csrfValido(req, sesion)) {
    await auditar(req, { categoria: 'seguridad', accion: 'csrf_rechazado', resultado: 'denegado',
      actor: { tipo: 'platform_admin', id: admin.id, email: admin.email } })
    return res.status(403).json({ error: 'Solicitud rechazada por protección CSRF. Recarga la página.', code: 'CSRF' })
  }
  if (admin.debe_cambiar_password && !PERMITIDAS_CAMBIO_PASSWORD.has(req.originalUrl.split('?')[0])) {
    return res.status(403).json({ error: 'Debes cambiar tu contraseña antes de continuar.', code: 'PASSWORD_CHANGE_REQUIRED' })
  }

  req.sesion = sesion
  req.platformAdmin = { id: admin.id, email: admin.email, rol: admin.rol, sesionId: sesion.id }
  next()
}

/** Exige un rol de plataforma concreto (separación de funciones, V20). */
export function requirePlatformRole(rol: RolPlataforma) {
  return async (req: PlatformAdminRequest, res: Response, next: NextFunction) => {
    if (req.platformAdmin?.rol === rol) return next()
    await auditar(req, { categoria: 'acceso', accion: 'rol_plataforma_insuficiente', resultado: 'denegado',
      actor: { tipo: 'platform_admin', id: req.platformAdmin?.id, email: req.platformAdmin?.email },
      detalle: { requerido: rol, actual: req.platformAdmin?.rol } })
    return res.status(403).json({ error: `Esta acción requiere el rol de plataforma "${rol}".`, code: 'FORBIDDEN' })
  }
}
