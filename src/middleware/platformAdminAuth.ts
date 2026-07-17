import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// Estructuralmente distinto del AuthRequest de tenants (middleware/auth.ts):
// nunca tiene tenantId ni rol de negocio. Un platform_admin administra la
// plataforma, no los datos de un SGC.
export interface PlatformAdminRequest extends Request {
  platformAdmin?: {
    id: number
    email: string
  }
}

interface PlatformAdminJwtPayload {
  id: number
  email: string
  type: 'platform_admin'
}

export function platformAdminMiddleware(req: PlatformAdminRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido', code: 'NO_TOKEN' })
  }

  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.PLATFORM_ADMIN_JWT_SECRET!) as PlatformAdminJwtPayload

    // Un token de tenant firmado con la OTRA secret nunca pasaría el verify
    // de arriba. Este chequeo de `type` es una segunda capa de defensa por
    // si en algún momento se decidiera reusar la misma secret que los
    // tokens de tenant (no se hace hoy — ver nota en platformAdmin.ts).
    if (payload.type !== 'platform_admin') {
      return res.status(401).json({ error: 'Token inválido', code: 'INVALID_TOKEN' })
    }

    req.platformAdmin = { id: payload.id, email: payload.email }
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado', code: 'INVALID_TOKEN' })
  }
}