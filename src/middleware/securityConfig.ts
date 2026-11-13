/**
 * Configuración criptográfica centralizada y validación de secretos al
 * arrancar (V18 / CWE-347, CWE-321).
 *
 * - Se fija explícitamente el algoritmo HS256 tanto al firmar como al
 *   verificar: un token con otro `alg` (p. ej. "none" o RS256 usando la
 *   secret como clave pública) se rechaza sin depender de los valores por
 *   defecto de la librería.
 * - Si JWT_SECRET o PLATFORM_ADMIN_JWT_SECRET faltan, son cortas o son
 *   iguales, el servidor NO arranca. Antes arrancaba y fallaba (o firmaba)
 *   en tiempo de ejecución.
 */
import type { SignOptions, VerifyOptions } from 'jsonwebtoken'

export const JWT_ALGORITHM = 'HS256' as const

/** Opciones de verificación para los tokens de usuarios de empresa. */
export const TENANT_JWT_VERIFY: VerifyOptions = { algorithms: [JWT_ALGORITHM] }
/** Opciones de verificación para los tokens de platform_admin. */
export const PLATFORM_JWT_VERIFY: VerifyOptions = { algorithms: [JWT_ALGORITHM] }

export function signOptions(expiresIn: SignOptions['expiresIn']): SignOptions {
  return { algorithm: JWT_ALGORITHM, expiresIn }
}

const MIN_SECRET_LENGTH = 32

/** Lanza un error si la configuración de secretos no es segura. */
export function assertSecurityConfig(env: NodeJS.ProcessEnv = process.env): void {
  const problemas: string[] = []
  const tenant = env.JWT_SECRET || ''
  const platform = env.PLATFORM_ADMIN_JWT_SECRET || ''

  if (tenant.length < MIN_SECRET_LENGTH) problemas.push(`JWT_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres`)
  if (platform.length < MIN_SECRET_LENGTH) problemas.push(`PLATFORM_ADMIN_JWT_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres`)
  if (tenant && tenant === platform) problemas.push('JWT_SECRET y PLATFORM_ADMIN_JWT_SECRET deben ser distintas')

  if (problemas.length) {
    throw new Error(
      `[seguridad] Configuración insegura, el servidor no arranca:\n  - ${problemas.join('\n  - ')}\n` +
        "  Genera valores con: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
    )
  }
}
