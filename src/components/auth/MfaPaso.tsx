import React, { useEffect, useRef, useState } from 'react'
import './MfaPaso.css'

/**
 * Paso de verificación en dos pasos (TOTP) del inicio de sesión.
 *  - modo "mfa": pide el código de 6 dígitos de la app autenticadora
 *    (o un código de recuperación).
 *  - modo "enrolar_mfa": primer ingreso de un rol con MFA obligatorio:
 *    muestra el QR, pide el primer código y luego los códigos de
 *    recuperación (que solo se muestran una vez).
 * Sirve tanto para usuarios de empresa como para platform_admin: recibe las
 * funciones de API como props.
 */
export interface MfaApi<R> {
  verificar: (codigo: string) => Promise<R>
  configurar: () => Promise<{ qr: string; secreto: string }>
  activar: (codigo: string) => Promise<R & { codigosRecuperacion?: string[] }>
}

interface Props<R> {
  modo: 'mfa' | 'enrolar_mfa'
  api: MfaApi<R>
  onListo: (resultado: R) => void
  onCancelar: () => void
}

export function MfaPaso<R>({ modo, api, onListo, onCancelar }: Props<R>) {
  const [codigo, setCodigo] = useState('')
  const [usarRecuperacion, setUsarRecuperacion] = useState(false)
  const [enrolamiento, setEnrolamiento] = useState<{ qr: string; secreto: string } | null>(null)
  const [codigosRec, setCodigosRec] = useState<string[] | null>(null)
  const [pendiente, setPendiente] = useState<R | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [verSecreto, setVerSecreto] = useState(false)

  const pedido = useRef(false)
  useEffect(() => {
    if (modo !== 'enrolar_mfa' || pedido.current) return
    pedido.current = true // StrictMode monta dos veces en desarrollo
    setCargando(true)
    api.configurar()
      .then(setEnrolamiento)
      .catch((e: any) => setError(e.message || 'No se pudo preparar la verificación en dos pasos'))
      .finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = codigo.trim()
    if (!valor) { setError('Ingresa el código'); return }
    setCargando(true)
    setError('')
    try {
      if (modo === 'enrolar_mfa') {
        const r = await api.activar(valor)
        if (r.codigosRecuperacion?.length) {
          setCodigosRec(r.codigosRecuperacion)
          setPendiente(r)
        } else onListo(r)
      } else {
        onListo(await api.verificar(valor))
      }
    } catch (err: any) {
      setError(err.message || 'Código incorrecto')
      setCodigo('')
    } finally {
      setCargando(false)
    }
  }

  const copiarCodigos = () => {
    if (codigosRec) navigator.clipboard?.writeText(codigosRec.join('\n')).catch(() => {})
  }

  // ── Códigos de recuperación (solo tras enrolar) ───────────────
  if (codigosRec && pendiente) {
    return (
      <div className="mfa">
        <h2>Guarda tus códigos de recuperación</h2>
        <p className="mfa__texto">
          Si pierdes el teléfono, cada código te permite entrar <strong>una sola vez</strong>.
          Guárdalos en un lugar seguro: no se volverán a mostrar.
        </p>
        <ul className="mfa__codigos" aria-label="Códigos de recuperación">
          {codigosRec.map((c) => <li key={c}><code>{c}</code></li>)}
        </ul>
        <div className="mfa__acciones">
          <button type="button" className="mfa__secundario" onClick={copiarCodigos}>Copiar códigos</button>
          <button type="button" className="login__submit" onClick={() => onListo(pendiente)}>Ya los guardé, continuar</button>
        </div>
      </div>
    )
  }

  return (
    <form className="mfa" onSubmit={enviar} noValidate>
      <h2>{modo === 'enrolar_mfa' ? 'Activa la verificación en dos pasos' : 'Verificación en dos pasos'}</h2>

      {modo === 'enrolar_mfa' ? (
        <>
          <p className="mfa__texto">
            Tu rol requiere un segundo factor. Escanea este código con una app autenticadora
            (Google Authenticator, Microsoft Authenticator, Authy…) y escribe el código de 6 dígitos que muestra.
          </p>
          <div className="mfa__qr">
            {enrolamiento ? <img src={enrolamiento.qr} alt="Código QR para la app autenticadora" width={200} height={200} /> : <span className="login__spinner" aria-hidden="true" />}
          </div>
          {enrolamiento && (
            <button type="button" className="mfa__enlace" onClick={() => setVerSecreto((v) => !v)}>
              {verSecreto ? 'Ocultar clave' : '¿No puedes escanear? Ver la clave para ingresarla a mano'}
            </button>
          )}
          {verSecreto && enrolamiento && <code className="mfa__secreto">{enrolamiento.secreto.match(/.{1,4}/g)?.join(' ')}</code>}
        </>
      ) : (
        <p className="mfa__texto">
          {usarRecuperacion
            ? 'Escribe uno de tus códigos de recuperación (formato XXXXX-XXXXX).'
            : 'Escribe el código de 6 dígitos de tu app autenticadora.'}
        </p>
      )}

      {error && (
        <div className="login__error" role="alert"><span>{error}</span></div>
      )}

      <label className="login__field">
        <span className="login__label">{usarRecuperacion ? 'Código de recuperación' : 'Código'}</span>
        <span className="login__input">
          <input
            className="mfa__input"
            value={codigo}
            onChange={(e) => setCodigo(usarRecuperacion ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode={usarRecuperacion ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            autoFocus
            placeholder={usarRecuperacion ? 'XXXXX-XXXXX' : '123456'}
            disabled={cargando}
          />
        </span>
      </label>

      <button type="submit" className="login__submit" disabled={cargando || (modo === 'enrolar_mfa' && !enrolamiento)}>
        {cargando ? 'Verificando…' : modo === 'enrolar_mfa' ? 'Activar y entrar' : 'Verificar'}
      </button>

      <div className="mfa__pie">
        {modo === 'mfa' && (
          <button type="button" className="mfa__enlace" onClick={() => { setUsarRecuperacion((v) => !v); setCodigo(''); setError('') }}>
            {usarRecuperacion ? 'Usar el código de la app' : '¿Perdiste el teléfono? Usar un código de recuperación'}
          </button>
        )}
        <button type="button" className="mfa__enlace" onClick={onCancelar}>Volver al inicio de sesión</button>
      </div>
    </form>
  )
}

export default MfaPaso
