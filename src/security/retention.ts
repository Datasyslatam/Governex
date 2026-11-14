/**
 * Retención de datos técnicos (Fase 5, V22).
 *
 * Borra las sesiones vencidas o revocadas hace más de RETENCION_SESIONES_DIAS
 * (30 por defecto). Las sesiones guardan IP y navegador (dato personal) y,
 * pasado ese plazo, ya no sirven ni para soporte ni para seguridad: lo que
 * hace falta conservar de cada inicio y cierre de sesión ya está en la
 * bitácora de seguridad (auditoria_eventos), que NO se borra.
 *
 * Las bitácoras (auditoria_eventos, logs_actividad, platform_admin_audit_log)
 * son de solo inserción y se conservan: su plazo de retención lo debe fijar el
 * cliente según sus obligaciones (ver FASE_5_REGISTRO_CAMBIOS.md).
 */
import { pool, comoSistema } from '../db'
import { logJson } from '../middleware/requestContext'

const DIAS = Math.max(1, Number(process.env.RETENCION_SESIONES_DIAS) || 30)
const CADA_MS = 6 * 60 * 60 * 1000 // cada 6 horas

export async function purgarSesiones(): Promise<number> {
  const { rowCount } = await comoSistema(() => pool.query(
    `DELETE FROM sesiones
     WHERE expira_en < NOW() - make_interval(days => $1)
        OR revocada_en < NOW() - make_interval(days => $1)`,
    [DIAS]
  ))
  return rowCount ?? 0
}

export function iniciarRetencion() {
  const ejecutar = () => purgarSesiones()
    .then((n) => { if (n > 0) logJson({ tipo: 'retencion', tabla: 'sesiones', borradas: n, dias: DIAS }) })
    .catch((err) => console.error('[retencion] error purgando sesiones:', err.message))
  setTimeout(ejecutar, 60_000).unref()
  setInterval(ejecutar, CADA_MS).unref()
}
