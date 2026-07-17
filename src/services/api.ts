import Swal from 'sweetalert2'

// En producción (Railway), el frontend y backend están en el mismo servidor,
// así que las peticiones van a /api/... sin dominio.
// En desarrollo local, usa VITE_API_URL o localhost:3001.
const BASE = import.meta.env.VITE_API_URL || ''

function getToken(): string | null {
  return localStorage.getItem('governex_token')
}

export function saveToken(token: string) {
  localStorage.setItem('governex_token', token)
}

export function clearToken() {
  localStorage.removeItem('governex_token')
}

// Códigos de error que el backend adjunta junto al mensaje (ver
// middleware/auth.ts y middleware/rbac.ts). Nunca se decide el flujo de
// sesión inspeccionando el texto del mensaje — solo este código.
type ApiErrorCode = 'NO_TOKEN' | 'INVALID_TOKEN' | 'TENANT_INACTIVE' | 'FORBIDDEN'

export class ApiError extends Error {
  status: number
  code?: ApiErrorCode
  constructor(message: string, status: number, code?: ApiErrorCode) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// Evento que AuthContext escucha para cerrar sesión. Se dispara acá (no se
// llama a logout() directamente) porque api.ts es un módulo plano, sin
// acceso al árbol de React ni a sus hooks.
const SESSION_INVALID_EVENT = 'governex:session-invalid'

let sessionExpiredAlertShown = false

function handleSessionInvalid(code: ApiErrorCode) {
  // Evita mostrar el mismo aviso varias veces si hay varias peticiones en
  // vuelo cuando la sesión se invalida (ej. una pantalla con 3 fetch en paralelo).
  if (sessionExpiredAlertShown) return
  sessionExpiredAlertShown = true

  const isTenantInactive = code === 'TENANT_INACTIVE'
  Swal.fire({
    icon: 'warning',
    title: isTenantInactive ? 'Empresa no activa' : 'Sesión finalizada',
    text: isTenantInactive
      ? 'La cuenta de tu empresa no está activa. Contacta a soporte de Governex.'
      : 'Tu sesión expiró o ya no es válida. Vuelve a iniciar sesión.',
    confirmButtonText: 'Entendido',
  }).then(() => {
    sessionExpiredAlertShown = false
  })

  window.dispatchEvent(new CustomEvent(SESSION_INVALID_EVENT, { detail: { code } }))
}

function handleForbidden(message: string) {
  // Toast liviano, no bloqueante: a diferencia de la sesión inválida, esto
  // NO implica cerrar sesión — el usuario sigue autenticado, simplemente
  // su rol no tiene el permiso RBAC para esa acción puntual.
  Swal.fire({
    icon: 'error',
    title: 'Acción no permitida',
    text: message,
    timer: 3500,
    showConfirmButton: false,
  })
}

async function request<T>(path: string, options: RequestInit = {}, skipSessionModal = false): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error desconocido' }))
    const code = body.code as ApiErrorCode | undefined

    if (!skipSessionModal && (res.status === 401 || code === 'TENANT_INACTIVE')) {
      handleSessionInvalid(code ?? 'INVALID_TOKEN')
    } else if (code === 'FORBIDDEN') {
      handleForbidden(body.error || 'No tienes permiso para realizar esta acción')
    }

    throw new ApiError(body.error || `Error ${res.status}`, res.status, code)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get:    <T>(path: string)                  => request<T>(path),
  post:   <T>(path: string, body: unknown, skipSessionModal = false) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, skipSessionModal),
  put:    <T>(path: string, body: unknown)   => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
}

export async function uploadFile(file: File): Promise<{
  url: string; key: string; nombre: string; tipoMime: string; tamanoBytes: number
}> {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${BASE}/api/uploads`, {
    method: 'POST',
    // OJO: no seteamos Content-Type manualmente — el navegador debe
    // generar el boundary del multipart/form-data automáticamente.
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error al subir archivo' }))
    throw new ApiError(err.error || `Error ${res.status}`, res.status, err.code)
  }
  return res.json()
}

/**
 * Las URLs de R2 que devuelven los endpoints de listado (archivo_url, url,
 * organigrama_url, etc.) son firmadas y expiran a los 5 minutos. Nunca hay
 * que reusar directamente el valor que vino en un GET de hace rato — antes
 * de abrir/descargar un archivo, se debe pedir una URL fresca con la key.
 *
 * Uso típico en un componente:
 *   <button onClick={() => openSignedFile(doc.archivoKey)}>Ver documento</button>
 *
 * (Si el componente todavía guarda la URL firmada "vieja" en vez de la key,
 * hay que ajustar ese componente para guardar/pasar la key en su lugar —
 * la key no expira, es el identificador estable del archivo en R2.)
 */
export async function getSignedFileUrl(key: string): Promise<string> {
  const { url } = await api.get<{ url: string }>(`/api/uploads/signed-url?key=${encodeURIComponent(key)}`)
  return url
}

export async function openSignedFile(key: string): Promise<void> {
  try {
    const url = await getSignedFileUrl(key)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'No se pudo abrir el archivo', text: (err as Error).message })
  }
} 