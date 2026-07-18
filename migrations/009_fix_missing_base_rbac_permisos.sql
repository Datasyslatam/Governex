-- ============================================================
--  GOVERNEX — Reparación: permisos faltantes de los 13 módulos base
--  Archivo: migrations/009_fix_missing_base_rbac_permisos.sql
-- ============================================================
--  DIAGNÓSTICO CONFIRMADO EN PRODUCCIÓN (Railway):
--  la tabla `permisos` solo tiene las 48 filas que sembró la
--  migración 004 (los 12 módulos "nuevos": politica_calidad, compras,
--  produccion, diseno_desarrollo, enfoque_cliente, liberacion_ps,
--  planes_operacion, planificacion_cambios, requerimientos_ps,
--  salidas_nc, toma_consciencia, contexto_empresa).
--
--  Los 13 módulos "originales" (procesos, riesgos, documentos,
--  auditorias, no_conformidades, acciones_correctivas, indicadores,
--  proveedores, competencias, rev_direccion, objetivos_calidad,
--  comunicaciones, mejoras_continuas) NO tienen ninguna fila — el
--  bloque "PARTE 5" de 001_multitenant.sql (líneas ~543-578) nunca se
--  aplicó en producción, probablemente porque se corrió una versión
--  más vieja de ese archivo antes de que se agregara ese bloque.
--
--  Este script reproduce exactamente ese bloque, con dos diferencias
--  para que sea seguro de correr HOY sin importar el estado de la BD:
--    1) ON CONFLICT DO NOTHING en todo (no duplica nada si alguna
--       fila ya existiera).
--    2) Resuelve cada rol por su nombre actual O el histórico, por si
--       007_fix_roles_negocio.sql (que renombra los roles) ya corrió
--       o no en este entorno.
-- ============================================================

BEGIN;

-- 1) Catálogo de permisos (leer/crear/editar/eliminar) para los 13
--    módulos originales.
INSERT INTO permisos (recurso, accion)
SELECT r.recurso, a.accion
FROM (VALUES
	('procesos'), ('riesgos'), ('documentos'), ('auditorias'), ('no_conformidades'),
	('acciones_correctivas'), ('indicadores'), ('proveedores'), ('competencias'),
	('rev_direccion'), ('objetivos_calidad'), ('comunicaciones'), ('mejoras_continuas')
) AS r(recurso)
CROSS JOIN (VALUES ('leer'), ('crear'), ('editar'), ('eliminar')) AS a(accion)
ON CONFLICT DO NOTHING;

-- 2) 'aprobar' solo existe en los módulos con flujo de aprobación real.
INSERT INTO permisos (recurso, accion) VALUES
	('documentos', 'aprobar'),
	('auditorias', 'aprobar'),
	('no_conformidades', 'aprobar'),
	('rev_direccion', 'aprobar')
ON CONFLICT DO NOTHING;

-- 3) Rol de control total: 'Superusuario' (nombre vigente) o
--    'Alta Dirección' (nombre viejo) -> todo, incluye aprobar.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre IN ('Superusuario', 'Alta Dirección')), p.id
FROM permisos p
WHERE p.recurso IN (
	'procesos','riesgos','documentos','auditorias','no_conformidades',
	'acciones_correctivas','indicadores','proveedores','competencias',
	'rev_direccion','objetivos_calidad','comunicaciones','mejoras_continuas'
)
ON CONFLICT DO NOTHING;

-- 4) Rol intermedio. Se respeta el modelo VIGENTE (el del 007):
--    - si el rol ya se llama 'Gestión' -> solo lectura (regla nueva)
--    - si todavía se llama 'Admin SGC' (007 no ha corrido) -> todo
--      excepto aprobar en rev_direccion, igual que el 001 original.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre = 'Gestión'), p.id
FROM permisos p
WHERE p.recurso IN (
	'procesos','riesgos','documentos','auditorias','no_conformidades',
	'acciones_correctivas','indicadores','proveedores','competencias',
	'rev_direccion','objetivos_calidad','comunicaciones','mejoras_continuas'
)
AND p.accion = 'leer'
AND EXISTS (SELECT 1 FROM roles WHERE nombre = 'Gestión')
ON CONFLICT DO NOTHING;

INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre = 'Admin SGC'), p.id
FROM permisos p
WHERE p.recurso IN (
	'procesos','riesgos','documentos','auditorias','no_conformidades',
	'acciones_correctivas','indicadores','proveedores','competencias',
	'rev_direccion','objetivos_calidad','comunicaciones','mejoras_continuas'
)
AND NOT (p.accion = 'aprobar' AND p.recurso = 'rev_direccion')
AND EXISTS (SELECT 1 FROM roles WHERE nombre = 'Admin SGC')
ON CONFLICT DO NOTHING;

-- 5) Rol de captura de datos: 'Operativo' (nombre vigente) o 'Usuario'
--    (nombre viejo) -> leer + crear, sin editar/eliminar/aprobar.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre IN ('Operativo', 'Usuario')), p.id
FROM permisos p
WHERE p.recurso IN (
	'procesos','riesgos','documentos','auditorias','no_conformidades',
	'acciones_correctivas','indicadores','proveedores','competencias',
	'rev_direccion','objetivos_calidad','comunicaciones','mejoras_continuas'
)
AND p.accion IN ('leer', 'crear')
ON CONFLICT DO NOTHING;

COMMIT;