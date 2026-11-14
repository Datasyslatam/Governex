/**
 * Bitácora de seguridad (Fase 3, V10).
 *
 * auditar() inserta en `auditoria_eventos` (solo inserción, cadena SHA-256,
 * ver migración 023) y además emite el evento como línea JSON en stdout para
 * un SIEM. Nunca lanza: si la BD falla, el evento queda al menos en stdout y
 * la operación del usuario continúa.
 *
 * Reglas de contenido: nunca contraseñas, códigos MFA, tokens, cookies ni
 * secretos. En `detalle` solo metadatos (motivo, ids, valores anteriores y
 * nuevos de campos de control).
 */
import { Request } from 'express'
import { pool, comoSistema } from '../db'
import { logJson } from '../middleware/requestContext'

export type Categoria = 'autenticacion' | 'acceso' | 'usuarios' | 'plataforma' | 'datos' | 'seguridad'
export type Resultado = 'exito' | 'fallo' | 'denegado'

export interface Actor {
  tipo: 'usuario' | 'platform_admin' | 'anonimo' | 'sistema'
  id?: number | null
  email?: string | null
}

export interface EventoAuditoria {
  categoria: Categoria
  accion: string
  resultado: Resultado
  tenantId?: number | null
  /** Si no se indica, se deduce de la sesión de la petición. */
  actor?: Actor
  suplantadoPor?: number | null
  recurso?: string | null
  recursoId?: string | number | null
  detalle?: Record<string, unknown>
}

const CLAVES_PROHIBIDAS = /pass|contrase|token|secret|codigo|cookie|csrf/i

/** Quita del detalle cualquier clave que pueda contener un secreto. */
function limpiar(detalle: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(detalle)) {
    if (CLAVES_PROHIBIDAS.test(k) && !/^codigos?_restantes$|^tipo_codigo$/.test(k)) continue
    out[k] = typeof v === 'string' ? v.slice(0, 500) : v
  }
  return out
}

function actorDeLaPeticion(req: Request | null): Actor {
  const r = req as any
  if (r?.user?.id) return { tipo: 'usuario', id: r.user.id }
  if (r?.platformAdmin?.id) return { tipo: 'platform_admin', id: r.platformAdmin.id, email: r.platformAdmin.email }
  return { tipo: 'anonimo' }
}

export async function auditar(req: Request | null, ev: EventoAuditoria): Promise<void> {
  const r = req as any
  const actor = { ...(ev.actor ?? actorDeLaPeticion(req)) }
  // Completa el correo del actor para que la bitácora sea legible por sí sola.
  if (actor.tipo === 'usuario' && actor.id && !actor.email) {
    try {
      const { rows } = await comoSistema(() => pool.query('SELECT email FROM usuarios WHERE id = $1', [actor.id]))
      actor.email = rows[0]?.email ?? null
    } catch { /* sin correo: queda el id */ }
  }
  const fila = {
    correlation_id: req?.correlationId ?? null,
    tenant_id: ev.tenantId ?? r?.user?.tenantId ?? null,
    actor_tipo: actor.tipo,
    actor_id: actor.id ?? null,
    actor_email: actor.email ? String(actor.email).slice(0, 150) : null,
    suplantado_por_admin: ev.suplantadoPor ?? r?.user?.suplantadoPor ?? null,
    categoria: ev.categoria,
    accion: ev.accion.slice(0, 60),
    resultado: ev.resultado,
    recurso: ev.recurso ?? null,
    recurso_id: ev.recursoId != null ? String(ev.recursoId).slice(0, 100) : null,
    ip: req?.ip ? String(req.ip).slice(0, 64) : null,
    user_agent: req ? String(req.headers['user-agent'] || '').slice(0, 300) : null,
    metodo: req?.method ?? null,
    ruta: req ? req.originalUrl.split('?')[0].slice(0, 300) : null,
    detalle: limpiar(ev.detalle),
  }

  logJson({ tipo: 'auditoria', cid: fila.correlation_id, categoria: fila.categoria, accion: fila.accion,
    resultado: fila.resultado, tenant: fila.tenant_id, actor_tipo: fila.actor_tipo, actor_id: fila.actor_id,
    suplantado_por: fila.suplantado_por_admin, recurso: fila.recurso, recurso_id: fila.recurso_id, ip: fila.ip })

  try {
    await comoSistema(() => pool.query(
      `INSERT INTO auditoria_eventos (correlation_id, tenant_id, actor_tipo, actor_id, actor_email, suplantado_por_admin,
         categoria, accion, resultado, recurso, recurso_id, ip, user_agent, metodo, ruta, detalle, hash_anterior, hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'','')`,
      [fila.correlation_id, fila.tenant_id, fila.actor_tipo, fila.actor_id, fila.actor_email, fila.suplantado_por_admin,
       fila.categoria, fila.accion, fila.resultado, fila.recurso, fila.recurso_id, fila.ip, fila.user_agent,
       fila.metodo, fila.ruta, JSON.stringify(fila.detalle)]
    ))
  } catch (err) {
    console.error('[auditoria] no se pudo registrar el evento en la BD:', (err as Error).message)
  }
}
