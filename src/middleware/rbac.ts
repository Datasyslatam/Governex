import { Response, NextFunction } from 'express'
import { pool } from '../db'
import { AuthRequest } from './auth'
import { auditar } from '../security/audit'

type Accion = 'leer' | 'crear' | 'editar' | 'eliminar' | 'aprobar'

// Caché corta (60s) por rol+recurso+accion — la matriz de permisos cambia
// con muy poca frecuencia (solo cuando un admin la edita), así que no vale
// la pena una query en cada request protegido.
const TTL_MS = 60_000
const cache = new Map<string, { allowed: boolean; expiresAt: number }>()

/**
 * Middleware de autorización fina por recurso+acción, basado en la matriz
 * RBAC (tablas `permisos` / `rol_permisos`, globales a la plataforma).
 * Debe usarse DESPUÉS de authMiddleware, ya que depende de req.user.rol.
 *
 * Uso:
 *   router.delete('/:id', authMiddleware, requirePermission('riesgos', 'eliminar'), handler)
 */
/** Responde 403 y deja constancia en la bitácora de seguridad (V10). */
async function denegar(req: AuthRequest, res: Response, recurso: string, accion: string) {
  await auditar(req, {
    categoria: 'acceso', accion: 'permiso_denegado', resultado: 'denegado', recurso,
    detalle: { permiso: `${recurso}:${accion}`, rol: req.user?.rol },
  })
  return res.status(403).json({ error: `No tienes permiso para ${accion} en ${recurso}`, code: 'FORBIDDEN' })
}

export function requirePermission(recurso: string, accion: Accion) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const rol = req.user?.rol
    if (!rol) return res.status(401).json({ error: 'No autenticado', code: 'NO_TOKEN' })

    // La clave incluye el id del usuario (no solo el rol): la consulta de abajo
    // evalúa permisos personalizados por usuario, así que cachear por rol hacía
    // que un usuario heredara la decisión tomada para otro del mismo rol.
    const cacheKey = `${req.user!.id}:${recurso}:${accion}`
    const cached = cache.get(cacheKey)
    const now = Date.now()

    if (cached && cached.expiresAt > now) {
      if (!cached.allowed) return denegar(req, res, recurso, accion)
      return next()
    }

    try {
      const { rows } = await pool.query(
        `SELECT 1
         FROM usuarios u
         JOIN permisos p ON p.recurso = $2 AND p.accion = $3
         LEFT JOIN rol_permisos rp ON rp.rol_id = u.rol_id AND rp.permiso_id = p.id AND u.tiene_permisos_personalizados = false
         LEFT JOIN usuario_permisos up ON up.usuario_id = u.id AND up.permiso_id = p.id AND u.tiene_permisos_personalizados = true
         WHERE u.id = $1 AND (rp.permiso_id IS NOT NULL OR up.permiso_id IS NOT NULL)`,
        [req.user!.id, recurso, accion]
      )
      const allowed = (rows.length ?? 0) > 0
      cache.set(cacheKey, { allowed, expiresAt: now + TTL_MS })

      if (!allowed) return denegar(req, res, recurso, accion)
      next()
    } catch (err) {
      console.error('[requirePermission] error consultando RBAC:', err)
      // Falla cerrado: si la matriz de permisos no se puede consultar, no se
      // asume acceso — es preferible un 500 a una autorización silenciosa.
      res.status(500).json({ error: 'Error al verificar permisos' })
    }
  }
}
/** Invalida la caché de permisos de un usuario (tras editar su rol o permisos). */
export function olvidarPermisos(usuarioId: number) {
  for (const k of cache.keys()) if (k.startsWith(`${usuarioId}:`)) cache.delete(k)
}
