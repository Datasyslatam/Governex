import React, { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { useNavigate } from 'react-router-dom'
import { authService, SesionActiva } from '../../services'
import { useAuth } from '../../hooks/useAuth'
import './SeguridadCuentaPage.css'

/**
 * Seguridad de la cuenta (Fase 2):
 *  - Cambio de contraseña (obligatorio si un administrador la restableció).
 *  - Verificación en dos pasos: activar, regenerar códigos, desactivar.
 *  - Sesiones activas: ver dónde está abierta la cuenta y cerrarlas.
 */

const REGLAS = 'Mínimo 12 caracteres y al menos 3 de estos tipos: minúsculas, mayúsculas, números y símbolos. No puede contener tu correo ni tu nombre.'

function describirNavegador(ua: string): string {
  if (!ua) return 'Navegador desconocido'
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  const so = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  return so ? `${nav} en ${so}` : nav
}

const fecha = (s: string) => new Date(s).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

const SeguridadCuentaPage: React.FC = () => {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const forzado = !!user?.debeCambiarPassword

  // ── Contraseña ──
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwCargando, setPwCargando] = useState(false)

  // ── MFA ──
  const [enrolando, setEnrolando] = useState<{ qr: string; secreto: string } | null>(null)
  const [codigoMfa, setCodigoMfa] = useState('')
  const [codigosNuevos, setCodigosNuevos] = useState<string[] | null>(null)
  const [mfaError, setMfaError] = useState('')
  const [restantes, setRestantes] = useState<number | null>(null)

  // ── Sesiones ──
  const [sesiones, setSesiones] = useState<SesionActiva[]>([])

  const cargarSesiones = () => authService.sesiones().then(setSesiones).catch(() => {})
  useEffect(() => {
    if (forzado) return
    cargarSesiones()
    authService.me().then((m) => setRestantes(m.codigosRestantes)).catch(() => {})
  }, [forzado])

  const cambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    if (nueva !== confirmar) { setPwError('La confirmación no coincide con la nueva contraseña'); return }
    setPwCargando(true)
    try {
      await authService.cambiarPassword(actual, nueva)
      setActual(''); setNueva(''); setConfirmar('')
      await refresh()
      await Swal.fire({ icon: 'success', title: 'Contraseña actualizada', text: 'Se cerraron tus sesiones en otros dispositivos.', timer: 2500, showConfirmButton: false })
      if (forzado) navigate('/dashboard')
      else cargarSesiones()
    } catch (err: any) {
      setPwError(err.message || 'No se pudo cambiar la contraseña')
    } finally {
      setPwCargando(false)
    }
  }

  const iniciarEnrolamiento = async () => {
    setMfaError('')
    try {
      setEnrolando(await authService.configurarMfa())
    } catch (err: any) {
      setMfaError(err.message)
    }
  }

  const confirmarEnrolamiento = async (e: React.FormEvent) => {
    e.preventDefault()
    setMfaError('')
    try {
      const r = await authService.activarMfa(codigoMfa)
      setCodigosNuevos(r.codigosRecuperacion)
      setEnrolando(null)
      setCodigoMfa('')
      setRestantes(r.codigosRecuperacion.length)
      await refresh()
    } catch (err: any) {
      setMfaError(err.message || 'Código incorrecto')
    }
  }

  const regenerar = async () => {
    const { value: codigo } = await Swal.fire({
      title: 'Regenerar códigos de recuperación',
      text: 'Los códigos anteriores dejarán de funcionar. Escribe el código actual de tu app autenticadora.',
      input: 'text', inputPlaceholder: '123456', showCancelButton: true, confirmButtonText: 'Regenerar', cancelButtonText: 'Cancelar',
    })
    if (!codigo) return
    try {
      const r = await authService.regenerarCodigos(String(codigo).trim())
      setCodigosNuevos(r.codigosRecuperacion)
      setRestantes(r.codigosRecuperacion.length)
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'No se pudo regenerar', text: err.message })
    }
  }

  const desactivar = async () => {
    const { value } = await Swal.fire({
      title: 'Desactivar verificación en dos pasos',
      html: '<input id="sw-pw" type="password" class="swal2-input" placeholder="Contraseña" autocomplete="current-password">' +
            '<input id="sw-code" class="swal2-input" placeholder="Código de la app (123456)" inputmode="numeric">',
      focusConfirm: false, showCancelButton: true, confirmButtonText: 'Desactivar', cancelButtonText: 'Cancelar',
      preConfirm: () => ({
        password: (document.getElementById('sw-pw') as HTMLInputElement).value,
        codigo: (document.getElementById('sw-code') as HTMLInputElement).value,
      }),
    })
    if (!value) return
    try {
      await authService.desactivarMfa(value.password, value.codigo.trim())
      await refresh()
      setRestantes(null)
      Swal.fire({ icon: 'success', title: 'Verificación en dos pasos desactivada', timer: 2000, showConfirmButton: false })
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'No se pudo desactivar', text: err.message })
    }
  }

  const cerrarSesion = async (s: SesionActiva) => {
    try { await authService.cerrarSesion(s.id); cargarSesiones() } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'No se pudo cerrar la sesión', text: err.message })
    }
  }

  const cerrarOtras = async () => {
    try { await authService.cerrarOtrasSesiones(); cargarSesiones() } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'No se pudieron cerrar las sesiones', text: err.message })
    }
  }

  return (
    <div className="page seg-cuenta">
      <div className="page__header">
        <h2>Seguridad de la cuenta</h2>
        <span>{user?.email}</span>
      </div>

      {forzado && (
        <div className="seg-cuenta__aviso" role="alert">
          Un administrador restableció tu contraseña. Debes definir una nueva antes de continuar.
        </div>
      )}

      {/* ── Contraseña ─────────────────────────────── */}
      <section className="seg-cuenta__panel" aria-labelledby="seg-pw">
        <h3 id="seg-pw">Contraseña</h3>
        <form className="seg-cuenta__form" onSubmit={cambiarPassword}>
          <label>Contraseña actual
            <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required />
          </label>
          <label>Nueva contraseña
            <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required minLength={12} aria-describedby="seg-pw-reglas" />
          </label>
          <label>Confirmar nueva contraseña
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" required />
          </label>
          <p id="seg-pw-reglas" className="seg-cuenta__ayuda">{REGLAS}</p>
          {pwError && <p className="seg-cuenta__error" role="alert">{pwError}</p>}
          <div><button type="submit" className="seg-cuenta__btn" disabled={pwCargando}>{pwCargando ? 'Guardando…' : 'Cambiar contraseña'}</button></div>
        </form>
      </section>

      {!forzado && (
        <>
          {/* ── MFA ──────────────────────────────── */}
          <section className="seg-cuenta__panel" aria-labelledby="seg-mfa">
            <h3 id="seg-mfa">Verificación en dos pasos</h3>
            <p className="seg-cuenta__estado">
              Estado: <strong className={user?.mfaHabilitado ? 'seg-ok' : 'seg-off'}>{user?.mfaHabilitado ? 'Activa' : 'Inactiva'}</strong>
              {user?.mfaObligatorio && <span className="seg-cuenta__chip">Obligatoria para tu rol</span>}
              {user?.mfaHabilitado && restantes != null && <span className="seg-cuenta__chip">{restantes} códigos de recuperación disponibles</span>}
            </p>

            {codigosNuevos && (
              <div className="seg-cuenta__codigos">
                <p>Guarda estos códigos de recuperación en un lugar seguro. Cada uno sirve <strong>una sola vez</strong> y no se volverán a mostrar.</p>
                <ul>{codigosNuevos.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
                <button type="button" className="seg-cuenta__btn seg-cuenta__btn--sec" onClick={() => navigator.clipboard?.writeText(codigosNuevos.join('\n'))}>Copiar</button>
                <button type="button" className="seg-cuenta__btn" onClick={() => setCodigosNuevos(null)}>Ya los guardé</button>
              </div>
            )}

            {!user?.mfaHabilitado && !enrolando && (
              <button type="button" className="seg-cuenta__btn" onClick={iniciarEnrolamiento}>Activar verificación en dos pasos</button>
            )}

            {enrolando && (
              <form className="seg-cuenta__enrolar" onSubmit={confirmarEnrolamiento}>
                <p>Escanea el código con tu app autenticadora y escribe el código de 6 dígitos.</p>
                <img src={enrolando.qr} alt="Código QR para la app autenticadora" width={180} height={180} />
                <code className="seg-cuenta__secreto">{enrolando.secreto.match(/.{1,4}/g)?.join(' ')}</code>
                <label>Código
                  <input value={codigoMfa} onChange={(e) => setCodigoMfa(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required />
                </label>
                <div className="seg-cuenta__fila">
                  <button type="submit" className="seg-cuenta__btn">Activar</button>
                  <button type="button" className="seg-cuenta__btn seg-cuenta__btn--sec" onClick={() => setEnrolando(null)}>Cancelar</button>
                </div>
              </form>
            )}

            {mfaError && <p className="seg-cuenta__error" role="alert">{mfaError}</p>}

            {user?.mfaHabilitado && (
              <div className="seg-cuenta__fila">
                <button type="button" className="seg-cuenta__btn seg-cuenta__btn--sec" onClick={regenerar}>Regenerar códigos de recuperación</button>
                {!user.mfaObligatorio && (
                  <button type="button" className="seg-cuenta__btn seg-cuenta__btn--peligro" onClick={desactivar}>Desactivar</button>
                )}
              </div>
            )}
          </section>

          {/* ── Sesiones ─────────────────────────── */}
          <section className="seg-cuenta__panel" aria-labelledby="seg-ses">
            <div className="seg-cuenta__titulo-fila">
              <h3 id="seg-ses">Sesiones activas</h3>
              {sesiones.length > 1 && (
                <button type="button" className="seg-cuenta__btn seg-cuenta__btn--sec" onClick={cerrarOtras}>Cerrar todas las demás</button>
              )}
            </div>
            <p className="seg-cuenta__ayuda">Las sesiones se cierran solas tras 30 minutos sin actividad o 8 horas desde el inicio.</p>
            <ul className="seg-cuenta__sesiones">
              {sesiones.map((s) => (
                <li key={s.id}>
                  <div>
                    <strong>{describirNavegador(s.user_agent)}</strong>
                    {s.actual && <span className="seg-cuenta__chip seg-ok">Esta sesión</span>}
                    {s.suplantacion && <span className="seg-cuenta__chip">Soporte Governex</span>}
                    <span className="seg-cuenta__meta">IP {s.ip || '—'} · Inicio {fecha(s.creada_en)} · Última actividad {fecha(s.ultimo_uso_en)}</span>
                  </div>
                  {!s.actual && (
                    <button type="button" className="seg-cuenta__btn seg-cuenta__btn--sec" onClick={() => cerrarSesion(s)}>Cerrar</button>
                  )}
                </li>
              ))}
              {sesiones.length === 0 && <li className="seg-cuenta__meta">Cargando…</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

export default SeguridadCuentaPage
