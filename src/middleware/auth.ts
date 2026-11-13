import { Request, Response, NextFunction } from 'express'
import { pool } from '../db'
import { obtenerSesion, csrfValido, SesionDB } from '../security/sessions'

/**
 * Autenticación de usuarios de empresa por SESIÓN DEL SERVIDOR (Fase 2).
 *
 * Antes: JWT de 8 h en localStorage, enviado como `Authorization: Bearer`,
 * imposible de revocar. Ahora: cookie HttpOnly `gx_session` → fila en
 * `sesiones` (ver security/sessions.ts). Ya no se aceptan tokens Bearer.
 *
 * La forma de req.user no cambia ({ id, tenantId, rol }), así que ninguna
 * ruta de negocio tuvo que modificarse. El rol, el estado del usuario y el
 * de su empresa se leen de la BD (caché de 10 s): un cambio de rol, una
 * desactivación o una suspensión de empresa se aplican de inmediato, sin
 * esperar a que expire un token.
 */
export interface AuthRequest extends Request {
  user?: {
    id: number
    tenantId: number
    rol: string
    sesionId?: string
    suplantadoPor?: number | null
    debeCambiarPassword?: boolean
  }
  sesion?: SesionDB
}

interface EstadoUsuario {
  activo: boolean
  tenantId: number
  rol: string
  debeCambiarPassword: boolean
  tenantEstado: string
}

const CACHE_MS = 10_000
const estadoCache = new Map<number, { e: EstadoUsuario; hasta: number }>()

export function olvidarEstadoUsuario(usuarioId?: number) {
  if (usuarioId == null) estadoCache.clear()
  else estadoCache.delete(usuarioId)
}

async function estadoUsuario(usuarioId: number): Promise<EstadoUsuario | null | 'error'> {
  const now = Date.now()
  const c = estadoCache.get(usuarioId)
  if (c && c.hasta > now) return c.e
  try {
    const { rows } = await pool.query(
      `SELECT u.activo, u.tenant_id, u.debe_cambiar_password, r.nombre AS rol, t.estado AS tenant_estado
       FROM usuarios u JOIN roles r ON r.id = u.rol_id JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [usuarioId]
    )
    if (!rows[0]) return null
    const e: EstadoUsuario = {
      activo: rows[0].activo,
      tenantId: rows[0].tenant_id,
      rol: rows[0].rol,
      debeCambiarPassword: rows[0].debe_cambiar_password,
      tenantEstado: rows[0].tenant_estado,
    }
    estadoCache.set(usuarioId, { e, hasta: now + CACHE_MS })
    return e
  } catch (err) {
    console.error('[authMiddleware] error consultando usuario:', err)
    // Ante una falla de BD se usa el último estado conocido; si no hay, 503.
    return c ? c.e : 'error'
  }
}

// Rutas permitidas mientras el usuario está obligado a cambiar su contraseña.
const PERMITIDAS_CAMBIO_PASSWORD = new Set(['/api/auth/me', '/api/auth/password', '/api/auth/logout'])

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  let sesion: SesionDB | null
  try {
    sesion = await obtenerSesion(req, 'tenant')
  } catch (err) {
    console.error('[authMiddleware] error consultando sesión:', err)
    return res.status(503).json({ error: 'Servicio temporalmente no disponible. Intenta de nuevo en unos segundos.' })
  }
  if (!sesion || sesion.etapa !== 'activa' || !sesion.usuario_id) {
    return res.status(401).json({ error: 'Sesión no válida o expirada. Inicia sesión de nuevo.', code: 'NO_SESSION' })
  }

  const e = await estadoUsuario(sesion.usuario_id)
  if (e === 'error') {
    return res.status(503).json({ error: 'Servicio temporalmente no disponible. Intenta de nuevo en unos segundos.' })
  }
  if (!e || !e.activo || e.tenantId !== sesion.tenant_id) {
    return res.status(401).json({ error: 'Sesión no válida o expirada. Inicia sesión de nuevo.', code: 'NO_SESSION' })
  }
  if (e.tenantEstado !== 'Activo') {
    return res.status(403).json({ error: 'La cuenta de tu empresa no está activa. Contacta a soporte de Governex.', code: 'TENANT_INACTIVE' })
  }

  if (!csrfValido(req, sesion)) {
    return res.status(403).json({ error: 'Solicitud rechazada por protección CSRF. Recarga la página.', code: 'CSRF' })
  }

  const ruta = req.originalUrl.split('?')[0]
  if (e.debeCambiarPassword && !PERMITIDAS_CAMBIO_PASSWORD.has(ruta)) {
    return res.status(403).json({ error: 'Debes cambiar tu contraseña antes de continuar.', code: 'PASSWORD_CHANGE_REQUIRED' })
  }

  req.sesion = sesion
  req.user = {
    id: sesion.usuario_id,
    tenantId: e.tenantId,
    rol: e.rol,
    sesionId: sesion.id,
    suplantadoPor: sesion.suplantado_por_admin,
    debeCambiarPassword: e.debeCambiarPassword,
  }
  next()
}
