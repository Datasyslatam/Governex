import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { usePlatformAdminAuth } from '../../context/PlatformAdminAuthContext'
import { authService } from '../../services'
import './LoginPage.css'
import logoLight from '../../assets/logo-governex-light.webp'
import logoColor from '../../assets/logo-governex-color.webp'

const API_BASE = import.meta.env.VITE_API_URL || ''
const ENTORNO = import.meta.env.PROD ? 'Producción' : 'Desarrollo'

/* ── Íconos (SVG en línea, sin dependencias) ─────────────── */
type IconProps = { className?: string }
const svgProps = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
}
const IconMail = (p: IconProps) => (
  <svg {...svgProps} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
)
const IconLock = (p: IconProps) => (
  <svg {...svgProps} {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><circle cx="12" cy="16" r="1" /></svg>
)
const IconEye = (p: IconProps) => (
  <svg {...svgProps} {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
)
const IconEyeOff = (p: IconProps) => (
  <svg {...svgProps} {...p}><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="m3 3 18 18" /></svg>
)
const IconArrow = (p: IconProps) => (
  <svg {...svgProps} {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
)
const IconAlert = (p: IconProps) => (
  <svg {...svgProps} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
)
const IconRiesgo = (p: IconProps) => (
  <svg {...svgProps} {...p}><path d="M12 3 2.5 19.5h19L12 3Z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>
)
const IconAuditoria = (p: IconProps) => (
  <svg {...svgProps} {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="m9 13 2 2 4-4" /></svg>
)
const IconDocumento = (p: IconProps) => (
  <svg {...svgProps} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></svg>
)
const IconIndicador = (p: IconProps) => (
  <svg {...svgProps} {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
)

const FEATURES = [
  { icon: IconRiesgo,     tono: 'azul',    texto: 'Riesgos y oportunidades con mapa de calor' },
  { icon: IconAuditoria,  tono: 'naranja', texto: 'Auditorías, hallazgos y acciones correctivas' },
  { icon: IconDocumento,  tono: 'azul',    texto: 'Documentos controlados con flujo de aprobación' },
  { icon: IconIndicador,  tono: 'naranja', texto: 'Indicadores y análisis asistido por IA' },
] as const

type EstadoServidor = 'verificando' | 'en-linea' | 'sin-conexion'

const LoginPage: React.FC = () => {
  const { login }   = useAuth()
  const { login: loginPlatformAdmin } = usePlatformAdminAuth()
  const navigate    = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [servidor, setServidor] = useState<EstadoServidor>('verificando')

  // Estado real del servidor (no decorativo): consulta /api/health al cargar.
  useEffect(() => {
    let activo = true
    fetch(`${API_BASE}/api/health`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (activo) setServidor(d?.status === 'ok' ? 'en-linea' : 'sin-conexion') })
      .catch(() => { if (activo) setServidor('sin-conexion') })
    return () => { activo = false }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Completa el correo y la contraseña'); return }
    setLoading(true)
    setError('')
    try {
      const { user, tenant } = await authService.login(email, password)
      // Adaptar al formato que espera el AuthContext existente.
      // tenant solo se guarda para mostrarlo en UI (ej. nombre de la
      // empresa en el header); nunca se usa para filtrar datos ni se
      // reenvía al backend — eso siempre lo decide el JWT server-side.
      login({ name: user.nombre, role: user.rol as any, tenant, permissions: user.permissions })
      navigate('/dashboard')
    } catch (tenantErr: any) {
      // Las credenciales no son válidas como usuario de tenant. Antes de
      // mostrar el error, probamos silenciosamente si son válidas como
      // super-admin de Governex — así el mismo formulario sirve para
      // ambos accesos, sin exponer ningún enlace visible al panel.
      try {
        await loginPlatformAdmin(email, password)
        navigate('/platform-admin')
        return
      } catch {
        setError(tenantErr.message || 'Credenciales incorrectas')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      {/* ── Panel de marca ─────────────────────────────── */}
      <aside className="login__brand-panel">
        <svg className="login__deco" viewBox="0 0 400 400" aria-hidden="true">
          <polygon points="200,20 356,110 356,290 200,380 44,290 44,110" />
          <polygon points="200,80 304,140 304,260 200,320 96,260 96,140" />
        </svg>

        <img className="login__logo" src={logoLight} alt="Governex" />

        <div className="login__pitch">
          <h1>Gobernanza <span>Digital</span></h1>
          <p>
            Procesos, riesgos, auditorías, documentos e indicadores de su sistema
            de gestión en una sola plataforma.
          </p>
          <ul className="login__features">
            {FEATURES.map(({ icon: Icon, tono, texto }) => (
              <li key={texto}>
                <span className={`login__feature-icon login__feature-icon--${tono}`}><Icon /></span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <footer className="login__brand-footer">© 2026 Governex · Barranquilla, Colombia</footer>
      </aside>

      {/* ── Panel de acceso ────────────────────────────── */}
      <main className="login__form-panel">
        <img className="login__logo-mobile" src={logoColor} alt="Governex" />

        <form className="login__card" onSubmit={handleSubmit} noValidate>
          <h2>Iniciar sesión</h2>
          <p className="login__subtitle">Ingrese con su usuario corporativo</p>

          {error && (
            <div className="login__error" role="alert">
              <IconAlert /> <span>{error}</span>
            </div>
          )}

          <label className="login__field">
            <span className="login__label">Correo</span>
            <span className="login__input">
              <IconMail className="login__input-icon" />
              <input
                type="email" value={email} autoComplete="username" autoFocus
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                disabled={loading}
              />
            </span>
          </label>

          <label className="login__field">
            <span className="login__label">Contraseña</span>
            <span className="login__input">
              <IconLock className="login__input-icon" />
              <input
                type={verPassword ? 'text' : 'password'} value={password} autoComplete="current-password"
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button" className="login__toggle"
                onClick={() => setVerPassword(v => !v)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verPassword}
              >
                {verPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </span>
          </label>

          <button type="submit" className="login__submit" disabled={loading}>
            {loading ? (<><span className="login__spinner" aria-hidden="true" /> Ingresando…</>) : (<>Ingresar <IconArrow /></>)}
          </button>
          <p className="login__helper">Tras 10 intentos fallidos, el acceso se bloquea por 15 minutos.</p>

          <div className={`login__status login__status--${servidor}`} aria-live="polite">
            <span className="login__status-dot" aria-hidden="true" />
            {servidor === 'verificando' && 'Verificando servidor…'}
            {servidor === 'en-linea' && `Servidor en línea · ${ENTORNO}`}
            {servidor === 'sin-conexion' && 'Sin conexión con el servidor'}
          </div>
        </form>

        <div className="login__powered-by">Powered by Datasys · Latam Group</div>
      </main>
    </div>
  )
}

export default LoginPage
