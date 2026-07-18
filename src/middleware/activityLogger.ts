import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { pool } from '../db'

/**
 * Registra una acción de auditoría de forma directa.
 */
export async function registrarActividadDirecto(
  tenantId: number,
  userId: number | null,
  usuarioNombre: string,
  usuarioEmail: string,
  usuarioRol: string,
  accion: string,
  recurso: string | null,
  detalle: string
) {
  try {
    await pool.query(
      `INSERT INTO logs_actividad (tenant_id, usuario_id, usuario_nombre, usuario_email, usuario_rol, accion, recurso, detalle)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, userId, usuarioNombre, usuarioEmail, usuarioRol, accion, recurso, detalle]
    )
  } catch (err) {
    console.error('[registrarActividadDirecto] error al guardar log:', err)
  }
}

/**
 * Middleware global que intercepta respuestas exitosas para peticiones de escritura (POST, PUT, DELETE)
 * y las registra automáticamente en la bitácora de actividad.
 */
export async function logActivityMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  res.on('finish', async () => {
    // Solo registrar operaciones exitosas (código 2xx o 3xx)
    if (res.statusCode >= 400) return
    
    const method = req.method
    if (!['POST', 'PUT', 'DELETE'].includes(method)) return

    const tenantId = req.user?.tenantId
    const userId = req.user?.id
    const userRole = req.user?.rol
    
    if (!tenantId || !userId) return

    // Evitar registrar login/register redundantes aquí, se manejan a mano o tienen flujos específicos
    if (req.originalUrl.includes('/login') || req.originalUrl.includes('/logout')) return

    let accion = ''
    if (method === 'POST') accion = 'Crear'
    else if (method === 'PUT') accion = 'Modificar'
    else if (method === 'DELETE') accion = 'Eliminar'

    // Extraer recurso (segundo segmento después de /api)
    const urlParts = req.originalUrl.split('?')[0].split('/')
    const recurso = urlParts[2] || 'sistema'

    try {
      const { rows } = await pool.query('SELECT nombre, email FROM usuarios WHERE id = $1', [userId])
      const userName = rows[0]?.nombre || 'Usuario Desconocido'
      const userEmail = rows[0]?.email || ''

      let detalle = `Acción ejecutada: ${accion} en ${recurso}`
      
      // Intentar extraer algún dato descriptivo del body para el log
      if (req.body) {
        const identifier = req.body.codigo || req.body.nombre || req.body.titulo || req.body.email || req.body.proceso || '';
        if (identifier) {
          detalle += ` - Elemento: "${identifier}"`
        }
      }

      await registrarActividadDirecto(
        tenantId,
        userId,
        userName,
        userEmail,
        userRole,
        accion,
        recurso,
        detalle
      )
    } catch (err) {
      console.error('[logActivityMiddleware] error en middleware de logs:', err)
    }
  })

  next()
}
