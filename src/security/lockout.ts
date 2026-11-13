/**
 * Bloqueo temporal de cuentas por intentos fallidos (V09 / CWE-307).
 *
 * Complementa el limitador por IP+email (rateLimit.ts): este contador vive
 * en la BD y es POR CUENTA, así que detiene también ataques distribuidos
 * desde muchas IP (credential stuffing) y funciona con varias réplicas.
 *
 * - LOCKOUT_MAX_FAILURES (5) fallos consecutivos de contraseña o de código
 *   MFA bloquean la cuenta LOCKOUT_MINUTES (15) minutos.
 * - Durante el bloqueo, incluso la contraseña correcta es rechazada con el
 *   mismo mensaje genérico (no se revela si la cuenta existe o está bloqueada).
 * - Un inicio de sesión completo y correcto reinicia el contador.
 */
import { pool } from '../db'

type Tabla = 'usuarios' | 'platform_admins'

const MAX = Number(process.env.LOCKOUT_MAX_FAILURES || 5)
const MINUTOS = Number(process.env.LOCKOUT_MINUTES || 15)

export function estaBloqueada(bloqueadoHasta: Date | string | null | undefined): boolean {
  return !!bloqueadoHasta && new Date(bloqueadoHasta).getTime() > Date.now()
}

/** Registra un fallo. Devuelve true si este fallo provocó el bloqueo. */
export async function registrarFallo(tabla: Tabla, id: number): Promise<boolean> {
  // Tabla fija (no viene del cliente): interpolación segura.
  const { rows } = await pool.query(
    `UPDATE ${tabla}
        SET intentos_fallidos = intentos_fallidos + 1,
            bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= $2
                                   THEN NOW() + ($3 || ' minutes')::interval
                                   ELSE bloqueado_hasta END
      WHERE id = $1
      RETURNING intentos_fallidos`,
    [id, MAX, String(MINUTOS)]
  )
  return rows[0]?.intentos_fallidos === MAX
}

export async function registrarExito(tabla: Tabla, id: number) {
  await pool.query(
    `UPDATE ${tabla} SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso_en = NOW() WHERE id = $1`,
    [id]
  )
}

export async function desbloquear(tabla: Tabla, id: number) {
  await pool.query(`UPDATE ${tabla} SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1`, [id])
}
