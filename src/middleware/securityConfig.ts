/**
 * Validación de la configuración de seguridad al arrancar (falla rápido).
 *
 * Fase 2: la autenticación ya no usa JWT (sesiones del servidor, ver
 * security/sessions.ts), así que JWT_SECRET y PLATFORM_ADMIN_JWT_SECRET
 * dejaron de ser necesarias. La clave obligatoria ahora es
 * MFA_ENCRYPTION_KEY, que cifra los secretos TOTP en la BD (AES-256-GCM).
 */

/** Lanza un error si la configuración no es segura; el servidor no arranca. */
export function assertSecurityConfig(env: NodeJS.ProcessEnv = process.env): void {
  const problemas: string[] = []

  const raw = env.MFA_ENCRYPTION_KEY || ''
  const bytes = /^[0-9a-fA-F]{64}$/.test(raw) ? 32 : Buffer.from(raw, 'base64').length
  if (bytes !== 32) problemas.push('MFA_ENCRYPTION_KEY debe ser una clave de 32 bytes (64 caracteres hex o base64)')

  if (problemas.length) {
    throw new Error(
      `[seguridad] Configuración insegura, el servidor no arranca:\n  - ${problemas.join('\n  - ')}\n` +
        "  Genera la clave con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
        '  IMPORTANTE: guárdala en un gestor de secretos; si se pierde, todos los usuarios deberán re-enrolar su MFA.'
    )
  }
}
