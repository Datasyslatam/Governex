import { Request, Response, NextFunction } from 'express'
// @ts-ignore
import jwt from 'jsonwebtoken'
import { pool } from '../db'

// Payload mínimo que viaja en el JWT. Nunca se agrega nada más
// (ej. nombre del usuario) para no filtrar datos innecesarios ni
// dejar el token con información que puede quedar obsoleta.
export interface AuthRequest extends Request {
  user?: {
    id: number
    tenantId: number
    rol: string
  }
}

// ── Caché de estado de tenant ──────────────────────────────────
// El JWT vive hasta 8h; sin esto, un tenant suspendido a mitad de una
// sesión activa seguiría teniendo acceso completo hasta que el token
// expire. Se verifica el estado en cada request, con una caché corta
// en memoria (60s) para no convertir authMiddleware en una query extra
// por cada llamada de la app.
const TENANT_STATUS_TTL_MS = 60_000
const tenantStatusCache = new Map<number, { estado: string; expiresAt: number }>()

async function isTenantActive(tenantId: number): Promise<boolean> {
  const cached = tenantStatusCache.get(tenantId)
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return cached.estado === 'Activo'
  }
  try {
    const { rows } = await pool.query('SELECT estado FROM tenants WHERE id = $1', [tenantId])
    const estado = rows[0]?.estado ?? 'Cancelado' // tenant inexistente se trata como no-activo
    tenantStatusCache.set(tenantId, { estado, expiresAt: now + TENANT_STATUS_TTL_MS })
    return estado === 'Activo'
  } catch (err) {
    // Si la BD falla, se falla cerrado del lado de la caché (no se guarda
    // nada) pero se deja pasar la request: un error transitorio de BD no
    // debería tumbar toda la aplicación para todos los tenants activos.
    console.error('[authMiddleware] error verificando estado de tenant:', err)
    return true
  }
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido', code: 'NO_TOKEN' })
  }

  const token = header.split(' ')[1]
  let payload: { id: number; tenantId: number; rol: string }
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as typeof payload
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado', code: 'INVALID_TOKEN' })
  }

  // Defensa en profundidad: un token viejo (emitido antes de la migración
  // multi-tenant) no tendría tenantId. Se rechaza explícitamente en vez de
  // dejar pasar un req.user.tenantId undefined que rompería los queries
  // aguas abajo de forma silenciosa.
  if (typeof payload.tenantId !== 'number') {
    return res.status(401).json({ error: 'Token inválido: falta información de tenant. Vuelve a iniciar sesión.', code: 'INVALID_TOKEN' })
  }

  const active = await isTenantActive(payload.tenantId)
  if (!active) {
    return res.status(403).json({ error: 'La cuenta de tu empresa no está activa. Contacta a soporte de Governex.', code: 'TENANT_INACTIVE' })
  }

  req.user = payload
  next()
}