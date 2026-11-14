import { Request, Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { pool, comoSistema } from '../db'
import { auditar } from '../security/audit'

/**
 * Bitácora de actividad de la empresa (la que ve el Superusuario en
 * "Gestión de usuarios → Bitácora"). Es de solo inserción (migración 023).
 * Desde la Fase 3 guarda también IP, ID de correlación y, si la acción la
 * hizo soporte de Governex suplantando al usuario, el admin responsable.
 */
export async function registrarActividadDirecto(
  tenantId: number,
  userId: number | null,
  usuarioNombre: string,
  usuarioEmail: string,
  usuarioRol: string,
  accion: string,
  recurso: string | null,
  detalle: string,
  req?: Request | null
) {
  const r = req as any
  try {
    await comoSistema(() => pool.query(
      `INSERT INTO logs_actividad (tenant_id, usuario_id, usuario_nombre, usuario_email, usuario_rol, accion, recurso, detalle,
                                   ip, correlation_id, suplantado_por_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [tenantId, userId, usuarioNombre, usuarioEmail, usuarioRol, accion, recurso, detalle,
       req?.ip ? String(req.ip).slice(0, 64) : null, req?.correlationId ?? null, r?.user?.suplantadoPor ?? null]
    ))
  } catch (err) {
    console.error('[registrarActividadDirecto] error al guardar log:', err)
  }
}

/**
 * Middleware global: registra las escrituras exitosas (POST, PUT, DELETE) de
 * los módulos de negocio en la bitácora de actividad y en la bitácora de
 * seguridad inmutable (categoría "datos").
 *
 * Las rutas /api/auth/* quedan FUERA a propósito: registran sus propios
 * eventos con detalle controlado. Antes este middleware tomaba el campo
 * `codigo` del cuerpo como "elemento" y en /api/auth/mfa/* ese campo es el
 * código de verificación del usuario.
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

    const ruta = req.originalUrl.split('?')[0]
    if (ruta.startsWith('/api/auth/') || ruta.startsWith('/api/platform-admin/')) return

    let accion = ''
    if (method === 'POST') accion = 'Crear'
    else if (method === 'PUT') accion = 'Modificar'
    else if (method === 'DELETE') accion = 'Eliminar'

    // Extraer recurso (segundo segmento después de /api)
    const urlParts = ruta.split('/')
    const recurso = urlParts[2] || 'sistema'
    const recursoId = urlParts[3] && /^[\w-]{1,60}$/.test(urlParts[3]) ? urlParts[3] : null

    try {
      const { rows } = await comoSistema(() => pool.query('SELECT nombre, email FROM usuarios WHERE id = $1', [userId]))
      const userName = rows[0]?.nombre || 'Usuario Desconocido'
      const userEmail = rows[0]?.email || ''

      let detalle = `Acción ejecutada: ${accion} en ${recurso}`
      // Identificador descriptivo del registro (nunca el cuerpo completo).
      const b = req.body && typeof req.body === 'object' ? req.body : {}
      const elemento = [b.codigo, b.nombre, b.titulo, b.proceso].find((v) => typeof v === 'string' && v.trim())
      if (elemento) detalle += ` - Elemento: "${String(elemento).slice(0, 120)}"`
      if (req.user?.suplantadoPor) detalle += ' (realizado por soporte de Governex en suplantación)'

      await registrarActividadDirecto(tenantId, userId, userName, userEmail, userRole, accion, recurso, detalle, req)
      await auditar(req, {
        categoria: 'datos',
        accion: `${accion.toLowerCase()}_${recurso}`.slice(0, 60),
        resultado: 'exito',
        actor: { tipo: 'usuario', id: userId, email: userEmail },
        recurso,
        recursoId,
        detalle: elemento ? { elemento: String(elemento).slice(0, 120), status: res.statusCode } : { status: res.statusCode },
      })
    } catch (err) {
      console.error('[logActivityMiddleware] error en middleware de logs:', err)
    }
  })

  next()
}
