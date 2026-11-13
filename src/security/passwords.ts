/**
 * Hash de contraseñas con Argon2id (V08 / OWASP Password Storage Cheat Sheet).
 *
 * Parámetros: m = 19 MiB, t = 2, p = 1 (mínimo recomendado por OWASP para
 * Argon2id). Ajustables por variables de entorno si el servidor lo permite.
 *
 * Migración transparente: las contraseñas guardadas con bcrypt ($2a$/$2b$)
 * siguen funcionando; al iniciar sesión correctamente, verifyPassword indica
 * `needsRehash` y el llamador re-guarda el hash con Argon2id. No hay que
 * pedir a nadie que cambie su contraseña.
 */
import { hash as argon2Hash, verify as argon2Verify, hashSync as argon2HashSync } from '@node-rs/argon2'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// Algorithm es un `const enum` en los tipos de @node-rs/argon2 y no existe en
// tiempo de ejecución: 2 = Argon2id.
const ARGON2ID = 2 as any

const OPCIONES = {
  algorithm: ARGON2ID,
  memoryCost: Number(process.env.ARGON2_MEMORY_KIB || 19456),
  timeCost: Number(process.env.ARGON2_TIME_COST || 2),
  parallelism: 1,
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2Hash(plain, OPCIONES)
}

function parametrosActuales(hash: string): boolean {
  // $argon2id$v=19$m=19456,t=2,p=1$...
  const m = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(hash)
  return !!m && Number(m[1]) >= OPCIONES.memoryCost && Number(m[2]) >= OPCIONES.timeCost
}

export async function verifyPassword(
  plain: string,
  hash: string | null | undefined
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (!hash) {
    // Se trabaja igual para que el tiempo de respuesta no delate si existe el usuario.
    await argon2Verify(DUMMY_HASH, plain).catch(() => false)
    return { ok: false, needsRehash: false }
  }
  try {
    if (hash.startsWith('$argon2')) {
      const ok = await argon2Verify(hash, plain)
      return { ok, needsRehash: ok && !parametrosActuales(hash) }
    }
    if (/^\$2[aby]\$/.test(hash)) {
      const ok = await bcrypt.compare(plain, hash)
      return { ok, needsRehash: ok }
    }
  } catch {
    /* hash corrupto: se trata como inválido */
  }
  return { ok: false, needsRehash: false }
}

// Hash de un valor aleatorio que nadie conoce (solo para igualar tiempos).
const DUMMY_HASH = argon2HashSync(crypto.randomBytes(32).toString('hex'), OPCIONES)
