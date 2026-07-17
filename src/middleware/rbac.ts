import { Response, NextFunction } from 'express'
import { pool } from '../db'
import { AuthRequest } from './auth'

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
export function requirePermission(recurso: string, accion: Accion) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const rol = req.user?.rol
    if (!rol) return res.status(401).json({ error: 'No autenticado', code: 'NO_TOKEN' })

    const cacheKey = `${rol}:${recurso}:${accion}`
    const cached = cache.get(cacheKey)
    const now = Date.now()

    if (cached && cached.expiresAt > now) {
      if (!cached.allowed) return res.status(403).json({ error: `No tienes permiso para ${accion} en ${recurso}`, code: 'FORBIDDEN' })
      return next()
    }

    try {
      const { rows } = await pool.query(
        `SELECT 1
         FROM rol_permisos rp
         JOIN roles r     ON r.id = rp.rol_id
         JOIN permisos p  ON p.id = rp.permiso_id
         WHERE r.nombre = $1 AND p.recurso = $2 AND p.accion = $3`,
        [rol, recurso, accion]
      )
      const allowed = (rows.length ?? 0) > 0
      cache.set(cacheKey, { allowed, expiresAt: now + TTL_MS })

      if (!allowed) return res.status(403).json({ error: `No tienes permiso para ${accion} en ${recurso}`, code: 'FORBIDDEN' })
      next()
    } catch (err) {
      console.error('[requirePermission] error consultando RBAC:', err)
      // Falla cerrado: si la matriz de permisos no se puede consultar, no se
      // asume acceso — es preferible un 500 a una autorización silenciosa.
      res.status(500).json({ error: 'Error al verificar permisos' })
    }
  }
}