import { Response, NextFunction } from 'express'
import { pool } from '../db'
import { AuthRequest } from './auth'

/**
 * Validación de llaves foráneas recibidas en el cuerpo de la petición
 * (defensa contra IDOR / CWE-639 "por llave foránea").
 *
 * Problema que resuelve: varias rutas aceptaban `proceso_id`, `nc_id`, etc.
 * sin comprobar que el registro referenciado perteneciera a la empresa del
 * usuario. Un usuario de la empresa A podía enlazar sus registros a datos de
 * la empresa B y luego leerlos a través de los JOIN de los listados.
 *
 * Uso (siempre DESPUÉS de authMiddleware y requirePermission):
 *   router.post('/', requirePermission('auditorias', 'crear'),
 *     requireTenantRefs({ proceso_id: 'procesos', programa_id: 'programas_auditoria' }),
 *     handler)
 *
 * - Los campos ausentes, null o '' se ignoran (son opcionales en las rutas).
 * - Un campo que termina en `_ids` puede ser un arreglo: se validan todos.
 * - Responde 400 con el mismo mensaje que ya usaban las rutas que validaban.
 */

// Lista blanca: el nombre de tabla NUNCA proviene del cliente, solo de esta
// constante, por lo que la interpolación en el SQL de abajo es segura.
const TABLAS = {
  procesos: 'int',
  tipos_proceso: 'int',
  programas_auditoria: 'int',
  auditorias: 'int',
  hallazgos: 'int',
  no_conformidades: 'int',
  personal: 'int',
  perfiles_cargo: 'int',
  proveedores: 'int',
  politica_calidad: 'int',
  documentos: 'int',
  fichas_tecnicas_ps: 'text',
} as const

export type TablaTenant = keyof typeof TABLAS

const ENTERO = /^\d{1,10}$/

export async function referenciasValidas(
  tabla: TablaTenant,
  ids: unknown[],
  tenantId: number
): Promise<boolean> {
  const tipo = TABLAS[tabla]
  if (!tipo) throw new Error(`Tabla no permitida en requireTenantRefs: ${tabla}`)
  const valores = [...new Set(ids.map((v) => String(v)))]
  if (valores.length === 0) return true
  if (tipo === 'int' && !valores.every((v) => ENTERO.test(v))) return false

  const cast = tipo === 'int' ? 'int[]' : 'text[]'
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM ${tabla} WHERE id = ANY($1::${cast}) AND tenant_id = $2`,
    [valores, tenantId]
  )
  return rows[0].n === valores.length
}

export function requireTenantRefs(campos: Record<string, TablaTenant>) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const tenantId = req.user?.tenantId
    if (typeof tenantId !== 'number') return res.status(401).json({ error: 'No autenticado', code: 'NO_TOKEN' })
    try {
      for (const [campo, tabla] of Object.entries(campos)) {
        const valor = req.body?.[campo]
        if (valor === undefined || valor === null || valor === '') continue
        const ids = Array.isArray(valor) ? valor.filter((v) => v !== null && v !== '') : [valor]
        if (!(await referenciasValidas(tabla, ids, tenantId))) {
          return res.status(400).json({ error: `${campo} no pertenece a tu organización` })
        }
      }
      next()
    } catch (err) {
      console.error('[requireTenantRefs] error validando referencias:', err)
      // Falla cerrado.
      res.status(500).json({ error: 'Error al validar la información enviada' })
    }
  }
}
