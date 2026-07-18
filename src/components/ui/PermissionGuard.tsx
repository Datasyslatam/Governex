import React from 'react'
import { usePermissions, Accion } from '../../hooks/usePermissions'

interface PermissionGuardProps {
  recurso: string
  accion: Accion
  /**
   * 'disable' (por defecto): muestra el elemento pero deshabilitado + tooltip.
   * 'hide': oculta el elemento completamente cuando no hay permiso.
   */
  mode?: 'disable' | 'hide'
  children: React.ReactElement
}

/**
 * Envuelve cualquier elemento interactivo y lo deshabilita (o lo oculta)
 * si el rol activo no tiene el permiso requerido.
 *
 * Modo 'disable' (default):
 *   - Agrega `disabled` al elemento hijo si admite esa prop (button, input…)
 *   - Envuelve en un <span title="…"> con cursor not-allowed para elementos
 *     que no admiten `disabled` (div, span, td…)
 *
 * Modo 'hide':
 *   - Renderiza null cuando no hay permiso.
 *
 * Ejemplos:
 *   <PermissionGuard recurso="riesgos" accion="editar">
 *     <button onClick={handleEdit}>Editar</button>
 *   </PermissionGuard>
 *
 *   <PermissionGuard recurso="riesgos" accion="eliminar" mode="hide">
 *     <button className="btn-icon danger">🗑️</button>
 *   </PermissionGuard>
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  recurso,
  accion,
  mode = 'disable',
  children,
}) => {
  const { can } = usePermissions()
  const allowed = can(recurso, accion)

  if (allowed) return children

  if (mode === 'hide') return null

  // Modo 'disable': clonar el hijo inyectando disabled + aria
  const disabledChild = React.cloneElement(children, {
    disabled: true,
    'aria-disabled': true,
    onClick: (e: React.MouseEvent) => e.preventDefault(),
    style: {
      ...(children.props.style ?? {}),
      opacity: 0.45,
      cursor: 'not-allowed',
      pointerEvents: 'none' as const,
    },
  })

  return (
    <span
      title="Tu rol no tiene permiso para esta acción"
      style={{ display: 'inline-block', cursor: 'not-allowed' }}
    >
      {disabledChild}
    </span>
  )
}

export default PermissionGuard
