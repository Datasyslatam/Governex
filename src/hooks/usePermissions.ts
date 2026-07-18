import { useAuth } from './useAuth'
import type { UserRole } from '../context/AuthContext'

// ── Tipos ─────────────────────────────────────────────────────────────────
export type Accion = 'leer' | 'crear' | 'editar' | 'eliminar' | 'aprobar'

/**
 * Matriz de permisos frontend — espejo exacto de
 * migrations/010_matriz_permisos_definitiva.sql
 *
 * IMPORTANTE: esta matriz es SOLO para UX (habilitar/deshabilitar
 * elementos). La autorización real la ejerce el backend mediante RBAC.
 * Si se actualiza 010_..., actualizar también esta matriz.
 */
const PERMISOS: Record<UserRole, Record<string, Accion[]>> = {
  // ── Superusuario ─ control total ──────────────────────────────────────
  Superusuario: {
    procesos:               ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    politica_calidad:       ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    contexto_empresa:       ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    enfoque_cliente:        ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    riesgos:                ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    objetivos_calidad:      ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    planificacion_cambios:  ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    competencias:           ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    toma_consciencia:       ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    comunicaciones:         ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    documentos:             ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    planes_operacion:       ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    requerimientos_ps:      ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    diseno_desarrollo:      ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    compras:                ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    proveedores:            ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    produccion:             ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    liberacion_ps:          ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    salidas_nc:             ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    auditorias:             ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    indicadores:            ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    rev_direccion:          ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    acciones_correctivas:   ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    no_conformidades:       ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
    mejoras_continuas:      ['leer', 'crear', 'editar', 'eliminar', 'aprobar'],
  },

  // ── Gestión ─ leer/crear/editar en casi todo; sin eliminar/aprobar
  //             en módulos de auditoría sensible ────────────────────────
  'Gestión': {
    procesos:               ['leer', 'crear', 'editar'],
    politica_calidad:       ['leer', 'crear', 'editar'],
    contexto_empresa:       ['leer', 'crear', 'editar'],
    enfoque_cliente:        ['leer', 'crear', 'editar', 'eliminar'],
    riesgos:                ['leer', 'crear', 'editar', 'eliminar'],
    objetivos_calidad:      ['leer', 'crear', 'editar', 'eliminar'],
    planificacion_cambios:  ['leer', 'crear', 'editar', 'eliminar'],
    competencias:           ['leer', 'crear', 'editar', 'eliminar'],
    toma_consciencia:       ['leer', 'crear', 'editar', 'eliminar'],
    comunicaciones:         ['leer', 'crear', 'editar', 'eliminar'],
    documentos:             ['leer', 'crear', 'editar'],                     // sin eliminar/aprobar
    planes_operacion:       ['leer', 'crear', 'editar', 'eliminar'],
    requerimientos_ps:      ['leer', 'crear', 'editar', 'eliminar'],
    diseno_desarrollo:      ['leer', 'crear', 'editar', 'eliminar'],
    compras:                ['leer', 'crear', 'editar', 'eliminar'],
    proveedores:            ['leer', 'crear', 'editar', 'eliminar'],
    produccion:             ['leer', 'crear', 'editar', 'eliminar'],
    liberacion_ps:          ['leer', 'crear', 'editar', 'eliminar'],
    salidas_nc:             ['leer', 'crear', 'editar', 'eliminar'],
    auditorias:             ['leer', 'crear', 'editar'],                     // sin eliminar/aprobar
    indicadores:            ['leer', 'crear', 'editar', 'eliminar'],
    rev_direccion:          ['leer', 'crear', 'editar'],                     // sin eliminar/aprobar
    acciones_correctivas:   ['leer', 'crear', 'editar', 'eliminar'],
    no_conformidades:       ['leer', 'crear', 'editar'],                     // sin eliminar/aprobar
    mejoras_continuas:      ['leer', 'crear', 'editar', 'eliminar'],
  },

  // ── Operativo ─ captura de datos; solo leer en módulos de gobierno ───
  Operativo: {
    procesos:               ['leer'],
    politica_calidad:       ['leer'],
    contexto_empresa:       ['leer'],
    enfoque_cliente:        ['leer', 'crear'],
    riesgos:                ['leer', 'crear'],
    objetivos_calidad:      ['leer'],
    planificacion_cambios:  ['leer'],
    competencias:           ['leer'],
    toma_consciencia:       ['leer', 'crear'],
    comunicaciones:         ['leer', 'crear'],
    documentos:             ['leer', 'crear'],
    planes_operacion:       ['leer', 'crear'],
    requerimientos_ps:      ['leer', 'crear'],
    diseno_desarrollo:      ['leer', 'crear'],
    compras:                ['leer', 'crear'],
    proveedores:            ['leer', 'crear'],
    produccion:             ['leer', 'crear'],
    liberacion_ps:          ['leer'],
    salidas_nc:             ['leer', 'crear'],
    auditorias:             ['leer'],
    indicadores:            ['leer', 'crear'],
    rev_direccion:          ['leer'],
    acciones_correctivas:   ['leer', 'crear'],
    no_conformidades:       ['leer', 'crear'],
    mejoras_continuas:      ['leer', 'crear'],
  },
}

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * Hook RBAC para controlar qué puede hacer el usuario activo en la UI.
 *
 * @param defaultRecurso - recurso por defecto para los helpers (canEdit, etc.)
 *
 * Ejemplo de uso:
 *   const { canEdit, canDelete } = usePermissions('riesgos')
 *   <button disabled={!canEdit}>Editar</button>
 *   <button disabled={!canDelete}>Eliminar</button>
 */
export function usePermissions(defaultRecurso?: string) {
  const { user } = useAuth()
  // Fail-safe: si no hay sesión o rol desconocido, aplicar el nivel más restrictivo
  const role: UserRole = (user?.role as UserRole) ?? 'Operativo'

  /**
   * Consulta si el rol activo tiene permiso para `accion` en `recurso`.
   * Devuelve false para cualquier combinación no listada explícitamente.
   */
  const can = (recurso: string, accion: Accion): boolean => {
    if (user?.permissions && Array.isArray(user.permissions)) {
      return user.permissions.includes(`${recurso}:${accion}`)
    }
    return PERMISOS[role]?.[recurso]?.includes(accion) ?? false
  }

  const canRead    = (recurso = defaultRecurso!) => can(recurso, 'leer')
  const canCreate  = (recurso = defaultRecurso!) => can(recurso, 'crear')
  const canEdit    = (recurso = defaultRecurso!) => can(recurso, 'editar')
  const canDelete  = (recurso = defaultRecurso!) => can(recurso, 'eliminar')
  const canApprove = (recurso = defaultRecurso!) => can(recurso, 'aprobar')

  /**
   * true cuando el usuario no puede ni crear ni editar en este recurso
   * (es un observador puro). Útil para bloquear formularios completos.
   */
  const isReadOnly = (recurso = defaultRecurso!) =>
    !can(recurso, 'crear') && !can(recurso, 'editar')

  return { can, canRead, canCreate, canEdit, canDelete, canApprove, isReadOnly, role }
}
