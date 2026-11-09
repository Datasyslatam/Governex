import { Request, Response, NextFunction } from 'express'

/**
 * Limitador de intentos FALLIDOS de inicio de sesión, en memoria y sin
 * dependencias externas.
 *
 * - Solo cuenta respuestas 401 (credenciales incorrectas): un usuario que
 *   entra bien nunca se ve afectado, y un login exitoso reinicia su contador.
 * - La clave combina IP + email, para que un atacante no pueda bloquear a un
 *   usuario legítimo desde otra red con solo conocer su correo.
 * - Al superar el máximo responde 429 hasta que pase la ventana.
 *
 * Limitación conocida: al ser en memoria, el contador es por instancia del
 * servidor y se reinicia al redeplegar. Si Railway escala a varias réplicas,
 * migrar a un almacén compartido (p. ej. Redis).
 */
interface Options {
  windowMs: number
  maxFailures: number
}

export function loginRateLimit({ windowMs, maxFailures }: Options) {
  const attempts = new Map<string, { failures: number; resetAt: number }>()

  // Limpieza periódica para que el Map no crezca sin control.
  const sweep = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of attempts) {
      if (entry.resetAt <= now) attempts.delete(key)
    }
  }, windowMs)
  sweep.unref?.()

  return (req: Request, res: Response, next: NextFunction) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const key = `${req.ip}|${email}`
    const now = Date.now()

    const entry = attempts.get(key)
    if (entry && entry.resetAt > now && entry.failures >= maxFailures) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000)
      res.setHeader('Retry-After', String(retryAfterSec))
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(retryAfterSec / 60)} minuto(s).`,
        code: 'TOO_MANY_ATTEMPTS',
      })
    }

    res.on('finish', () => {
      if (res.statusCode === 401) {
        const current = attempts.get(key)
        if (!current || current.resetAt <= Date.now()) {
          attempts.set(key, { failures: 1, resetAt: Date.now() + windowMs })
        } else {
          current.failures += 1
        }
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        attempts.delete(key)
      }
    })

    next()
  }
}
