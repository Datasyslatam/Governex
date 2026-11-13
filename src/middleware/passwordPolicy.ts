/**
 * Política de contraseñas (V08 / CWE-521; OWASP ASVS 4.0 V2.1, NIST SP 800-63B).
 *
 * Reglas:
 *  - Longitud entre 12 y 128 caracteres (se permiten espacios y frases).
 *  - Al menos 3 de 4 tipos: minúscula, mayúscula, número, símbolo.
 *  - No puede contener la parte local del correo ni el nombre del usuario.
 *  - No puede ser una contraseña común ni repetir un solo carácter.
 *
 * Se aplica en el backend a toda contraseña nueva: alta y edición de
 * usuarios, alta de empresas, alta de platform_admins y restablecimientos.
 * Las contraseñas existentes no se invalidan (se aplica al cambiarlas).
 */

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

// Lista corta de contraseñas y patrones más frecuentes (normalizados a minúsculas).
const COMUNES = new Set([
  'password', 'password1', 'password123', 'contraseña', 'contrasena', 'qwerty', 'qwertyuiop',
  '123456789012', '1234567890', 'administrador', 'admin12345', 'governex', 'governex123',
  'bienvenido', 'bienvenido1', 'colombia', 'colombia123', 'iloveyou', 'letmein', 'abc123456789',
])

export interface PasswordContext {
  email?: string | null
  nombre?: string | null
}

/** Devuelve null si la contraseña cumple la política o el motivo del rechazo. */
export function validarPassword(password: unknown, ctx: PasswordContext = {}): string | null {
  if (typeof password !== 'string') return 'La contraseña es requerida'
  if (password.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
  if (password.length > PASSWORD_MAX_LENGTH) return `La contraseña no puede superar ${PASSWORD_MAX_LENGTH} caracteres`

  const tipos = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  if (tipos < 3) return 'La contraseña debe combinar al menos 3 de estos tipos: minúsculas, mayúsculas, números y símbolos'

  const lower = password.toLowerCase()
  if (/^(.)\1+$/.test(password)) return 'La contraseña no puede repetir un solo carácter'
  if (COMUNES.has(lower) || COMUNES.has(lower.replace(/[^a-zñ0-9]/g, ''))) return 'La contraseña es demasiado común'

  const local = (ctx.email || '').split('@')[0].toLowerCase()
  if (local.length >= 4 && lower.includes(local)) return 'La contraseña no puede contener tu correo'
  for (const parte of (ctx.nombre || '').toLowerCase().split(/\s+/)) {
    if (parte.length >= 4 && lower.includes(parte)) return 'La contraseña no puede contener tu nombre'
  }
  return null
}
