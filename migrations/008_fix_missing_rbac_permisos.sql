-- ============================================================
--  GOVERNEX — Reparación: permisos faltantes por módulo
--  Archivo: migrations/008_fix_missing_rbac_permisos.sql
-- ============================================================
--  MOTIVO
--  ------
--  migrations/"004 rbac extend resources.sql" y "005 platform
--  admins.sql" se guardaron con espacios en el nombre, rompiendo el
--  patrón NNN_slug.sql del resto de migraciones (001_, 002_, 003_,
--  006_, 007_). Como no existe ningún runner que recorra la carpeta
--  migrations/ automáticamente (migrate.cjs solo aplica schema.sql a
--  mano), todo indica que "004" nunca llegó a ejecutarse.
--
--  Eso deja sin NINGUNA fila en `permisos` a estos 12 recursos:
--    politica_calidad, compras, produccion, diseno_desarrollo,
--    enfoque_cliente, liberacion_ps, planes_operacion,
--    planificacion_cambios, requerimientos_ps, salidas_nc,
--    toma_consciencia, contexto_empresa
--  (es decir: Contexto de la Organización, Liderazgo y Política, y el
--  resto de módulos "nuevos" del sidebar).
--
--  requirePermission() hace un JOIN contra `permisos`; si no hay fila
--  que autorice recurso+acción, el JOIN no devuelve nada y responde
--  403 a TODOS los roles (incluido Superusuario) en crear/editar/
--  eliminar de esos módulos. Los GET funcionan porque esas rutas no
--  pasan por requirePermission (por eso "se ve" pero "no se puede
--  hacer nada").
--
--  Esta migración:
--   1) Es idempotente (ON CONFLICT DO NOTHING) — se puede correr las
--      veces que haga falta sin duplicar ni romper nada.
--   2) Funciona sin importar si 007_fix_roles_negocio.sql (que
--      renombra los roles) ya corrió o no, porque resuelve cada rol
--      por su nombre actual O el histórico.
-- ============================================================

BEGIN;

-- 1) Catálogo de permisos que faltaba (idéntico a la migración 004
--    original; ON CONFLICT hace que sea inofensivo si alguna fila ya
--    existiera).
INSERT INTO permisos (recurso, accion)
SELECT r.recurso, a.accion
FROM (VALUES
	('politica_calidad'), ('compras'), ('produccion'), ('diseno_desarrollo'),
	('enfoque_cliente'), ('liberacion_ps'), ('planes_operacion'),
	('planificacion_cambios'), ('requerimientos_ps'), ('salidas_nc'),
	('toma_consciencia'), ('contexto_empresa')
) AS r(recurso)
CROSS JOIN (VALUES ('leer'), ('crear'), ('editar'), ('eliminar')) AS a(accion)
ON CONFLICT DO NOTHING;

-- 2) Rol de control total: 'Superusuario' (nombre vigente tras el 007)
--    o 'Alta Dirección' (nombre viejo, si el 007 todavía no corrió).
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre IN ('Superusuario', 'Alta Dirección')), p.id
FROM permisos p
WHERE p.recurso IN (
	'politica_calidad','compras','produccion','diseno_desarrollo','enfoque_cliente',
	'liberacion_ps','planes_operacion','planificacion_cambios','requerimientos_ps',
	'salidas_nc','toma_consciencia','contexto_empresa'
)
ON CONFLICT DO NOTHING;

-- 3) Rol intermedio. Se respeta el modelo VIGENTE (el del 007):
--    - si el rol ya se llama 'Gestión' -> solo lectura (regla nueva)
--    - si todavía se llama 'Admin SGC' (007 no ha corrido) -> todo,
--      igual que hacía la migración 004 original para ese rol.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre = 'Gestión'), p.id
FROM permisos p
WHERE p.recurso IN (
	'politica_calidad','compras','produccion','diseno_desarrollo','enfoque_cliente',
	'liberacion_ps','planes_operacion','planificacion_cambios','requerimientos_ps',
	'salidas_nc','toma_consciencia','contexto_empresa'
)
AND p.accion = 'leer'
AND EXISTS (SELECT 1 FROM roles WHERE nombre = 'Gestión')
ON CONFLICT DO NOTHING;

INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre = 'Admin SGC'), p.id
FROM permisos p
WHERE p.recurso IN (
	'politica_calidad','compras','produccion','diseno_desarrollo','enfoque_cliente',
	'liberacion_ps','planes_operacion','planificacion_cambios','requerimientos_ps',
	'salidas_nc','toma_consciencia','contexto_empresa'
)
AND EXISTS (SELECT 1 FROM roles WHERE nombre = 'Admin SGC')
ON CONFLICT DO NOTHING;

-- 4) Rol de captura de datos: 'Operativo' (nombre vigente) o 'Usuario'
--    (nombre viejo) -> leer + crear, sin editar/eliminar.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre IN ('Operativo', 'Usuario')), p.id
FROM permisos p
WHERE p.recurso IN (
	'politica_calidad','compras','produccion','diseno_desarrollo','enfoque_cliente',
	'liberacion_ps','planes_operacion','planificacion_cambios','requerimientos_ps',
	'salidas_nc','toma_consciencia','contexto_empresa'
)
AND p.accion IN ('leer', 'crear')
ON CONFLICT DO NOTHING;

COMMIT;
