import { Request, Response, NextFunction } from 'express'
import { pool } from '../db'
import { obtenerSesion, csrfValido, SesionDB } from '../security/sessions'

/**
 * Autenticación de platform_admin por sesión del servidor (Fase 2).
 * Cookie propia `gx_psession` (Path=/api/platform-admin), distinta de la de
 * empresas: nunca comparten credencial ni superficie. MFA obligatorio
 * (la sesión solo llega a etapa "activa" tras verificar el código).
 */
export interface PlatformAdminRequest extends Request {
  platformAdmin?: {
    id: number
    email: string
    sesionId?: string
  }
  sesion?: SesionDB
}

const PERMITIDAS_CAMBIO_PASSWORD = new Set(['/api/platform-admin/me', '/api/platform-admin/password', '/api/platform-admin/logout'])

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
    'SELECT id, email, activo, debe_cambiar_password FROM platform_admins WHERE id = $1',
    [sesion.platform_admin_id]
  )
  const admin = rows[0]
  if (!admin || !admin.activo) {
    return res.status(401).json({ error: 'Sesión no válida o expirada', code: 'NO_SESSION' })
  }
  if (!csrfValido(req, sesion)) {
    return res.status(403).json({ error: 'Solicitud rechazada por protección CSRF. Recarga la página.', code: 'CSRF' })
  }
  if (admin.debe_cambiar_password && !PERMITIDAS_CAMBIO_PASSWORD.has(req.originalUrl.split('?')[0])) {
    return res.status(403).json({ error: 'Debes cambiar tu contraseña antes de continuar.', code: 'PASSWORD_CHANGE_REQUIRED' })
  }

  req.sesion = sesion
  req.platformAdmin = { id: admin.id, email: admin.email, sesionId: sesion.id }
  next()
}
