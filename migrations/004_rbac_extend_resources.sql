-- ============================================================
--  GOVERNEX — Extensión del catálogo RBAC
--  Archivo: migrations/004_rbac_extend_resources.sql
-- ============================================================
--  El seed original de `permisos` (001_multitenant.sql, Parte 5) solo
--  cubrió 13 módulos. Para cablear requirePermission() en el resto de
--  routers hacen falta los recursos correspondientes — sin esto,
--  requirePermission() devolvería 403 a TODOS los usuarios en esos
--  módulos, porque no existiría ninguna fila que autorice nada.
-- ============================================================

BEGIN;

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

-- Mismo criterio de asignación por defecto que en el seed original:

-- 'Alta Dirección' -> todo
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE NOMBRE = 'Alta Dirección'), p.id
FROM permisos p
WHERE p.recurso IN (
	'politica_calidad','compras','produccion','diseno_desarrollo','enfoque_cliente',
	'liberacion_ps','planes_operacion','planificacion_cambios','requerimientos_ps',
	'salidas_nc','toma_consciencia','contexto_empresa'
)
ON CONFLICT DO NOTHING;

-- 'Admin SGC' -> todo (igual que en el seed original para estos módulos, no hay aprobar aquí)
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE NOMBRE = 'Admin SGC'), p.id
FROM permisos p
WHERE p.recurso IN (
	'politica_calidad','compras','produccion','diseno_desarrollo','enfoque_cliente',
	'liberacion_ps','planes_operacion','planificacion_cambios','requerimientos_ps',
	'salidas_nc','toma_consciencia','contexto_empresa'
)
ON CONFLICT DO NOTHING;

-- 'Usuario' -> solo leer y crear
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE NOMBRE = 'Usuario'), p.id
FROM permisos p
WHERE p.recurso IN (
	'politica_calidad','compras','produccion','diseno_desarrollo','enfoque_cliente',
	'liberacion_ps','planes_operacion','planificacion_cambios','requerimientos_ps',
	'salidas_nc','toma_consciencia','contexto_empresa'
)
AND p.accion IN ('leer', 'crear')
ON CONFLICT DO NOTHING;

COMMIT;