import crypto from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { sinContexto } from '../db'

/**
 * Contexto de cada petición (Fase 3, V10):
 *  - ID de correlación: se acepta el X-Request-Id entrante si tiene un formato
 *    seguro (lo pone un balanceador o el cliente) o se genera uno. Se devuelve
 *    en la respuesta y viaja a la bitácora, para unir en un SIEM la petición
 *    HTTP con sus eventos de auditoría.
 *  - Log de acceso estructurado: una línea JSON por petición a /api en la
 *    salida estándar (Railway la conserva; un SIEM la puede ingerir).
 *    Nunca incluye cuerpos, cookies, contraseñas ni tokens.
 */
declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string
  }
}

const FORMATO_ID = /^[A-Za-z0-9._-]{8,64}$/

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const entrante = String(req.headers['x-request-id'] || '')
  req.correlationId = FORMATO_ID.test(entrante) ? entrante : crypto.randomUUID()
  res.setHeader('X-Request-Id', req.correlationId)

  const ruta = req.originalUrl.split('?')[0]
  if (ruta.startsWith('/api/') && ruta !== '/api/health') {
    const inicio = process.hrtime.bigint()
    res.on('finish', () => {
      const r = req as any
      logJson({
        tipo: 'acceso',
        cid: req.correlationId,
        metodo: req.method,
        ruta: ruta.slice(0, 200),
        status: res.statusCode,
        ms: Number((process.hrtime.bigint() - inicio) / 1_000_000n),
        ip: req.ip,
        usuario: r.user?.id ?? undefined,
        tenant: r.user?.tenantId ?? undefined,
        suplantado_por: r.user?.suplantadoPor ?? undefined,
        platform_admin: r.platformAdmin?.id ?? undefined,
      })
    })
  }
  // Fase 5: sin contexto de BD hasta que la autenticación lo fije (empresa o
  // sistema). Las tablas con RLS no devuelven filas sin contexto.
  sinContexto(() => next())
}

/** Escribe un evento estructurado (una línea JSON) en stdout. */
export function logJson(evento: Record<string, unknown>) {
  try {
    process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), app: 'governex', ...evento }) + '\n')
  } catch {
    /* nunca romper una petición por el log */
  }
}
