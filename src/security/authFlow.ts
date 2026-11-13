/**
 * Flujo de autenticación compartido por usuarios de empresa y platform_admin:
 *
 *   contraseña OK ──► ¿MFA habilitado? ── sí ──► sesión etapa "mfa" (5 min) ──► código ──► sesión "activa"
 *                         │ no
 *                         ├─ ¿MFA obligatorio para su rol? ── sí ──► etapa "enrolar_mfa" ──► configurar + activar ──► "activa"
 *                         └─ no ──► sesión "activa"
 *
 * Al pasar de una etapa previa a "activa" se emite un identificador NUEVO y
 * se revoca el anterior (rotación: evita la fijación de sesión).
 */
import { Request, Response } from 'express'
import QRCode from 'qrcode'
import { pool } from '../db'
import {
  crearSesion, obtenerSesion, revocarSesion, limpiarCookies, TipoSesion, SesionDB, SUPLANTACION_MS,
} from './sessions'
import {
  generarSecretoTotp, verificarTotp, urlOtpauth, cifrarSecreto, descifrarSecreto,
  generarCodigosRecuperacion, hashCodigoRecuperacion,
} from './mfa'
import { registrarFallo, registrarExito } from './lockout'

export interface Principal {
  id: number
  email: string
  mfa_habilitado: boolean
  mfa_secreto_cifrado: string | null
  mfa_ultimo_paso: string | number | null
  tenant_id?: number
}

const TABLA = { tenant: 'usuarios', platform: 'platform_admins' } as const
const COL_REC = { tenant: 'usuario_id', platform: 'platform_admin_id' } as const

export type ResultadoLogin = 'activa' | 'mfa' | 'enrolar_mfa'

/** Tras validar la contraseña: crea la sesión en la etapa que corresponda. */
export async function abrirSesionTrasPassword(
  req: Request, res: Response, tipo: TipoSesion, p: Principal, mfaObligatorio: boolean
): Promise<{ etapa: ResultadoLogin; csrf: string }> {
  const etapa: ResultadoLogin = p.mfa_habilitado ? 'mfa' : mfaObligatorio ? 'enrolar_mfa' : 'activa'
  const s = await crearSesion(req, res, {
    tipo,
    etapa,
    usuarioId: tipo === 'tenant' ? p.id : undefined,
    platformAdminId: tipo === 'platform' ? p.id : undefined,
    tenantId: tipo === 'tenant' ? p.tenant_id : undefined,
  })
  if (etapa === 'activa') await registrarExito(TABLA[tipo], p.id)
  return { etapa, csrf: s.csrf }
}

/** Sesión previa (etapa mfa / enrolar_mfa) asociada a la cookie, o null. */
export async function sesionPrevia(req: Request, tipo: TipoSesion, etapas: string[]): Promise<SesionDB | null> {
  const s = await obtenerSesion(req, tipo)
  return s && etapas.includes(s.etapa) ? s : null
}

/** Rota la sesión previa a una sesión activa nueva. */
export async function activarSesion(req: Request, res: Response, tipo: TipoSesion, previa: SesionDB) {
  await revocarSesion(previa.id, 'promovida')
  const s = await crearSesion(req, res, {
    tipo,
    etapa: 'activa',
    usuarioId: previa.usuario_id ?? undefined,
    platformAdminId: previa.platform_admin_id ?? undefined,
    tenantId: previa.tenant_id ?? undefined,
  })
  await registrarExito(TABLA[tipo], (previa.usuario_id ?? previa.platform_admin_id)!)
  return s
}

/**
 * Verifica un código TOTP o de recuperación. Actualiza el último paso usado
 * o marca el código de recuperación como consumido. Registra el fallo para
 * el bloqueo de cuenta.
 */
export async function verificarCodigo(
  tipo: TipoSesion, p: Principal, codigo: unknown
): Promise<'totp' | 'recuperacion' | null> {
  const texto = String(codigo ?? '').trim()
  if (!p.mfa_secreto_cifrado || !texto) {
    await registrarFallo(TABLA[tipo], p.id)
    return null
  }
  if (/^\d{6}$/.test(texto)) {
    const paso = verificarTotp(descifrarSecreto(p.mfa_secreto_cifrado), texto, p.mfa_ultimo_paso == null ? null : Number(p.mfa_ultimo_paso))
    if (paso != null) {
      // Condición en el UPDATE: dos peticiones simultáneas con el mismo código no pasan ambas.
      const { rowCount } = await pool.query(
        `UPDATE ${TABLA[tipo]} SET mfa_ultimo_paso = $2 WHERE id = $1 AND (mfa_ultimo_paso IS NULL OR mfa_ultimo_paso < $2)`,
        [p.id, paso]
      )
      if (rowCount) return 'totp'
    }
  } else {
    const { rowCount } = await pool.query(
      `UPDATE mfa_codigos_recuperacion SET usado_en = NOW()
       WHERE ${COL_REC[tipo]} = $1 AND codigo_hash = $2 AND usado_en IS NULL`,
      [p.id, hashCodigoRecuperacion(texto)]
    )
    if (rowCount) return 'recuperacion'
  }
  await registrarFallo(TABLA[tipo], p.id)
  return null
}

/** Genera un secreto nuevo (pendiente de confirmar) y devuelve el QR. */
export async function prepararEnrolamiento(tipo: TipoSesion, p: Principal) {
  // Si ya hay un secreto pendiente (generado pero sin confirmar), se reutiliza:
  // evita que dos solicitudes seguidas (doble clic, recarga) dejen en la BD un
  // secreto distinto del que muestra el QR.
  let secreto: string
  if (!p.mfa_habilitado && p.mfa_secreto_cifrado) {
    secreto = descifrarSecreto(p.mfa_secreto_cifrado)
  } else {
    secreto = generarSecretoTotp()
    // Se guarda cifrado pero con mfa_habilitado = false hasta que el usuario
    // confirme un código válido (así un enrolamiento a medias no bloquea la cuenta).
    await pool.query(
      `UPDATE ${TABLA[tipo]} SET mfa_secreto_cifrado = $2, mfa_ultimo_paso = NULL WHERE id = $1 AND mfa_habilitado = false`,
      [p.id, cifrarSecreto(secreto)]
    )
  }
  const otpauth = urlOtpauth(secreto, p.email, tipo === 'platform' ? 'Governex Plataforma' : 'Governex')
  const qr = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 })
  return { secreto, otpauth, qr }
}

/** Confirma el enrolamiento con un código y emite los códigos de recuperación. */
export async function confirmarEnrolamiento(tipo: TipoSesion, p: Principal, codigo: unknown): Promise<string[] | null> {
  if (p.mfa_habilitado || !p.mfa_secreto_cifrado) return null
  const texto = String(codigo ?? '').trim()
  const paso = verificarTotp(descifrarSecreto(p.mfa_secreto_cifrado), texto, null)
  if (paso == null) {
    await registrarFallo(TABLA[tipo], p.id)
    return null
  }
  const codigos = generarCodigosRecuperacion()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`UPDATE ${TABLA[tipo]} SET mfa_habilitado = true, mfa_ultimo_paso = $2 WHERE id = $1`, [p.id, paso])
    await client.query(`DELETE FROM mfa_codigos_recuperacion WHERE ${COL_REC[tipo]} = $1`, [p.id])
    for (const c of codigos) {
      await client.query(`INSERT INTO mfa_codigos_recuperacion (${COL_REC[tipo]}, codigo_hash) VALUES ($1, $2)`, [p.id, hashCodigoRecuperacion(c)])
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  return codigos
}

export async function regenerarCodigos(tipo: TipoSesion, id: number): Promise<string[]> {
  const codigos = generarCodigosRecuperacion()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM mfa_codigos_recuperacion WHERE ${COL_REC[tipo]} = $1`, [id])
    for (const c of codigos) {
      await client.query(`INSERT INTO mfa_codigos_recuperacion (${COL_REC[tipo]}, codigo_hash) VALUES ($1, $2)`, [id, hashCodigoRecuperacion(c)])
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  return codigos
}

export async function desactivarMfa(tipo: TipoSesion, id: number) {
  await pool.query(
    `UPDATE ${TABLA[tipo]} SET mfa_habilitado = false, mfa_secreto_cifrado = NULL, mfa_ultimo_paso = NULL WHERE id = $1`,
    [id]
  )
  await pool.query(`DELETE FROM mfa_codigos_recuperacion WHERE ${COL_REC[tipo]} = $1`, [id])
}

export async function codigosRestantes(tipo: TipoSesion, id: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM mfa_codigos_recuperacion WHERE ${COL_REC[tipo]} = $1 AND usado_en IS NULL`,
    [id]
  )
  return rows[0].n
}

export { limpiarCookies, SUPLANTACION_MS }
