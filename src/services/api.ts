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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }))
    throw new Error(err.error || `Error ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get:    <T>(path: string)                  => request<T>(path),
  post:   <T>(path: string, body: unknown)   => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
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
    throw new Error(err.error || `Error ${res.status}`)
  }
  return res.json()
}
