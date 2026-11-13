import { Request, Response, NextFunction } from 'express'
// @ts-ignore
import jwt from 'jsonwebtoken'
import { TENANT_JWT_VERIFY } from './securityConfig'
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

type TenantStatus = 'active' | 'inactive' | 'unknown'

async function getTenantStatus(tenantId: number): Promise<TenantStatus> {
  const cached = tenantStatusCache.get(tenantId)
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return cached.estado === 'Activo' ? 'active' : 'inactive'
  }
  try {
    const { rows } = await pool.query('SELECT estado FROM tenants WHERE id = $1', [tenantId])
    const estado = rows[0]?.estado ?? 'Cancelado' // tenant inexistente se trata como no-activo
    tenantStatusCache.set(tenantId, { estado, expiresAt: now + TENANT_STATUS_TTL_MS })
    return estado === 'Activo' ? 'active' : 'inactive'
  } catch (err) {
    console.error('[authMiddleware] error verificando estado de tenant:', err)
    // Antes se dejaba pasar SIEMPRE ante un error de BD, lo que permitía que
    // un tenant suspendido siguiera operando durante una falla. Ahora:
    //  - si hay un estado conocido (aunque la caché haya vencido), se usa;
    //  - si no hay ninguno, el estado es "desconocido" y se responde 503
    //    (no 403, para no cerrar la sesión como si la empresa estuviera inactiva).
    if (cached) return cached.estado === 'Activo' ? 'active' : 'inactive'
    return 'unknown'
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
    payload = jwt.verify(token, process.env.JWT_SECRET!, TENANT_JWT_VERIFY) as typeof payload
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

  const status = await getTenantStatus(payload.tenantId)
  if (status === 'unknown') {
    return res.status(503).json({ error: 'Servicio temporalmente no disponible. Intenta de nuevo en unos segundos.' })
  }
  if (status === 'inactive') {
    return res.status(403).json({ error: 'La cuenta de tu empresa no está activa. Contacta a soporte de Governex.', code: 'TENANT_INACTIVE' })
  }

  req.user = payload
  next()
}