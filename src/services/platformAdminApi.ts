import Swal from 'sweetalert2'

const BASE = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'governex_platform_admin_token'

// Storage completamente separado del de tenants (services/api.ts usa
// 'governex_token'). Nunca deben compartir clave: mezclar los dos tokens
// en el mismo localStorage sería el primer paso hacia confundirlos.
export function savePlatformAdminToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}
export function getPlatformAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function clearPlatformAdminToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class PlatformAdminApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'PlatformAdminApiError'
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}, skipSessionModal = false): Promise<T> {
  const token = getPlatformAdminToken()
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
    if (res.status === 401 && !skipSessionModal) {
      clearPlatformAdminToken()
      Swal.fire({ icon: 'warning', title: 'Sesión finalizada', text: 'Vuelve a iniciar sesión como super-admin.' })
    }
    throw new PlatformAdminApiError(body.error || `Error ${res.status}`, res.status)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface PlatformAdminInfo {
  id: number
  nombre: string
  email: string
}

export interface TenantSummary {
  id: number
  nombre: string
  nit: string
  estado: 'Activo' | 'Suspendido' | 'Cancelado'
  plan: string
  fecha_creacion: string
  usuarios_count: string // viene como string por el COUNT() de Postgres
}

export interface CreateTenantPayload {
  nombreEmpresa: string
  nit: string
  plan: 'Standard' | 'Pro' | 'Enterprise'
  adminNombre: string
  adminEmail: string
  adminPassword: string
}

export interface PlatformAdminSummary {
  id: number
  nombre: string
  email: string
  activo: boolean
  creado_en: string
}

export interface AuditLogEntry {
  id: number
  actor_admin_id: number | null
  actor_email: string
  accion: string
  entidad_tipo: 'tenant' | 'platform_admin'
  entidad_id: string | null
  detalle: Record<string, any>
  creado_en: string
}

export interface TenantUsuario {
  id: number
  nombre: string
  email: string
  activo: boolean
  creado_en: string
  rol_nombre: string
}

export interface TenantDetail {
  tenant: TenantSummary
  usuarios: TenantUsuario[]
}

export const platformAdminApi = {
  login: (email: string, password: string) =>
    request<{ token: string; admin: PlatformAdminInfo }>('/api/platform-admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, true), // skipSessionModal: un 401 aquí es "credenciales incorrectas", no una sesión expirada

  listTenants: () => request<TenantSummary[]>('/api/platform-admin/tenants'),

  createTenant: (payload: CreateTenantPayload) =>
    request<{ tenant: TenantSummary; adminUser: { id: number; nombre: string; email: string } }>(
      '/api/platform-admin/tenants',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  updateTenantEstado: (id: number, estado: TenantSummary['estado']) =>
    request<TenantSummary>(`/api/platform-admin/tenants/${id}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado }),
    }),
    
  listAdmins: () => request<PlatformAdminSummary[]>('/api/platform-admin/platform-admins'),

  createAdmin: (payload: { nombre: string; email: string; password: string }) =>
    request<PlatformAdminSummary>('/api/platform-admin/platform-admins', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAdminEstado: (id: number, activo: boolean) =>
    request<PlatformAdminSummary>(`/api/platform-admin/platform-admins/${id}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ activo }),
    }),

  getAuditLog: () => request<AuditLogEntry[]>('/api/platform-admin/audit-log'),

  getTenantDetail: (id: number) => request<TenantDetail>(`/api/platform-admin/tenants/${id}`),

  updateTenant: (id: number, body: { nombre: string; nit: string; plan: TenantSummary['plan'] }) =>
    request<TenantSummary>(`/api/platform-admin/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  resetUserPassword: (tenantId: number, usuarioId: number, password: string) =>
    request<{ ok: true }>(`/api/platform-admin/tenants/${tenantId}/usuarios/${usuarioId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  
  impersonateUser: (tenantId: number, usuarioId: number) =>
    request<{
      token: string
      user: { id: number; nombre: string; email: string; rol: string }
      tenant: { id: number; nombre: string }
    }>(`/api/platform-admin/tenants/${tenantId}/impersonate`, {
      method: 'POST',
      body: JSON.stringify({ usuarioId }),
    }),

  getGlobalStats: () => request<GlobalStats>('/api/platform-admin/global-stats'),
}

export interface GlobalStats {
  mrr: number
  totalFiles: number
  totalStorageBytes: number
  totalUsuarios: number
  totalProcesos: number
  totalRiesgos: number
  totalAuditorias: number
  totalDocumentos: number
  totalNoConformidades: number
  totalMejoras: number
}
