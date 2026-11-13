/**
 * MFA por TOTP (RFC 6238 / RFC 4226) sin dependencias externas (V02).
 *
 * - Secreto de 160 bits, códigos de 6 dígitos, paso de 30 s, tolerancia ±1
 *   paso (reloj del teléfono desfasado hasta ~30 s).
 * - Anti-reutilización: se guarda el último paso aceptado y no se admite un
 *   código de un paso igual o anterior (un código interceptado no sirve dos veces).
 * - El secreto se guarda CIFRADO con AES-256-GCM usando MFA_ENCRYPTION_KEY
 *   (variable de entorno, nunca en la BD ni en el repositorio).
 * - 10 códigos de recuperación de un solo uso; en BD solo su hash SHA-256
 *   (son aleatorios de 50 bits: no requieren un hash lento).
 */
import crypto from 'crypto'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const PASO_S = 30
const DIGITOS = 6
const VENTANA = 1

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export function generarSecretoTotp(): string {
  return base32Encode(crypto.randomBytes(20))
}

export function codigoTotp(secretoB32: string, paso: number): string {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(paso))
  const hmac = crypto.createHmac('sha1', base32Decode(secretoB32)).update(contador).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITOS
  return bin.toString().padStart(DIGITOS, '0')
}

export function pasoActual(ahoraMs = Date.now()): number {
  return Math.floor(ahoraMs / 1000 / PASO_S)
}

/**
 * Verifica un código TOTP. Devuelve el paso aceptado (para guardarlo como
 * último usado) o null si es inválido o ya fue usado.
 */
export function verificarTotp(secretoB32: string, codigo: string, ultimoPaso: number | null): number | null {
  if (!/^\d{6}$/.test(codigo)) return null
  const actual = pasoActual()
  for (let d = -VENTANA; d <= VENTANA; d++) {
    const paso = actual + d
    if (ultimoPaso != null && paso <= ultimoPaso) continue
    const esperado = codigoTotp(secretoB32, paso)
    if (crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(codigo))) return paso
  }
  return null
}

export function urlOtpauth(secretoB32: string, cuenta: string, emisor = 'Governex'): string {
  const label = encodeURIComponent(`${emisor}:${cuenta}`)
  return `otpauth://totp/${label}?secret=${secretoB32}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=${DIGITOS}&period=${PASO_S}`
}

// ── Cifrado del secreto en reposo (AES-256-GCM) ─────────────────────
function claveCifrado(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY || ''
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('MFA_ENCRYPTION_KEY debe ser de 32 bytes (64 hex o base64)')
  return key
}

export function cifrarSecreto(plano: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', claveCifrado(), iv)
  const enc = Buffer.concat([cipher.update(plano, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':')
}

export function descifrarSecreto(cifrado: string): string {
  const [v, iv, tag, data] = cifrado.split(':')
  if (v !== 'v1') throw new Error('Formato de secreto MFA desconocido')
  const decipher = crypto.createDecipheriv('aes-256-gcm', claveCifrado(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}

// ── Códigos de recuperación ─────────────────────────────────────────
export function generarCodigosRecuperacion(n = 10): string[] {
  return Array.from({ length: n }, () => {
    const c = base32Encode(crypto.randomBytes(7)).slice(0, 10)
    return `${c.slice(0, 5)}-${c.slice(5)}`
  })
}

export function hashCodigoRecuperacion(codigo: string): string {
  const normal = codigo.toUpperCase().replace(/[^A-Z2-7]/g, '')
  return crypto.createHash('sha256').update(`governex-mfa-rec:${normal}`).digest('hex')
}

export function mfaObligatorioParaRol(rol: string): boolean {
  const roles = (process.env.MFA_REQUIRED_ROLES ?? 'Superusuario').split(',').map((r) => r.trim()).filter(Boolean)
  return roles.includes('*') || roles.includes(rol)
}
