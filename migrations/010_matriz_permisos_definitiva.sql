-- ============================================================
--  GOVERNEX — Matriz de permisos definitiva (roles × módulos)
--  Archivo: migrations/010_matriz_permisos_definitiva.sql
-- ============================================================
--  Reconstruye rol_permisos desde cero para Superusuario, Gestión y
--  Operativo, aplicando exactamente la matriz aprobada:
--
--   · Superusuario -> control total (leer/crear/editar/eliminar y
--     aprobar donde existe) en los 25 módulos.
--   · Gestión      -> leer/crear/editar/eliminar en la mayoría de
--     módulos; SIN eliminar y SIN aprobar en los 4 módulos con rastro
--     de auditoría sensible (documentos, auditorias, no_conformidades,
--     rev_direccion).
--   · Operativo    -> leer + crear en los módulos operativos de
--     captura diaria; SOLO leer en los módulos de definición/gobierno
--     del SGC (política, roles y responsabilidades, objetivos de
--     calidad, planificación de cambios, competencias, liberación de
--     PS, auditorías, revisión por la dirección).
--
--  Es SEGURA de correr aunque 007_fix_roles_negocio.sql (que renombra
--  los roles) ya haya corrido o no: cada bloque resuelve el rol por su
--  nombre vigente ('Superusuario'/'Gestión'/'Operativo') o el
--  histórico ('Alta Dirección'/'Admin SGC'/'Usuario'), y si ninguno de
--  los dos nombres existe, simplemente no inserta nada (no rompe la
--  transacción).
--
--  IMPORTANTE: este script REEMPLAZA por completo la asignación
--  actual de estos 3 roles (borra y reconstruye). No es aditivo como
--  las migraciones 008/009.
-- ============================================================

BEGIN;

-- 0) Limpiar toda asignación previa de estos 3 roles para reconstruir
--    desde cero según la matriz aprobada.
DELETE FROM rol_permisos
WHERE rol_id IN (
	SELECT id FROM roles
	WHERE nombre IN ('Superusuario', 'Alta Dirección', 'Gestión', 'Admin SGC', 'Operativo', 'Usuario')
);

-- ============================================================
-- 1) SUPERUSUARIO -> control total en todo (incluye 'aprobar')
-- ============================================================
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('Superusuario', 'Alta Dirección')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2) GESTIÓN
-- ============================================================
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON TRUE
JOIN (VALUES
	('procesos','leer'), ('procesos','crear'), ('procesos','editar'),

	('politica_calidad','leer'), ('politica_calidad','crear'), ('politica_calidad','editar'),
	('contexto_empresa','leer'), ('contexto_empresa','crear'), ('contexto_empresa','editar'),
	('enfoque_cliente','leer'), ('enfoque_cliente','crear'), ('enfoque_cliente','editar'), ('enfoque_cliente','eliminar'),

	('riesgos','leer'), ('riesgos','crear'), ('riesgos','editar'), ('riesgos','eliminar'),
	('objetivos_calidad','leer'), ('objetivos_calidad','crear'), ('objetivos_calidad','editar'), ('objetivos_calidad','eliminar'),
	('planificacion_cambios','leer'), ('planificacion_cambios','crear'), ('planificacion_cambios','editar'), ('planificacion_cambios','eliminar'),

	('competencias','leer'), ('competencias','crear'), ('competencias','editar'), ('competencias','eliminar'),
	('toma_consciencia','leer'), ('toma_consciencia','crear'), ('toma_consciencia','editar'), ('toma_consciencia','eliminar'),
	('comunicaciones','leer'), ('comunicaciones','crear'), ('comunicaciones','editar'), ('comunicaciones','eliminar'),
	('documentos','leer'), ('documentos','crear'), ('documentos','editar'),

	('planes_operacion','leer'), ('planes_operacion','crear'), ('planes_operacion','editar'), ('planes_operacion','eliminar'),
	('requerimientos_ps','leer'), ('requerimientos_ps','crear'), ('requerimientos_ps','editar'), ('requerimientos_ps','eliminar'),
	('diseno_desarrollo','leer'), ('diseno_desarrollo','crear'), ('diseno_desarrollo','editar'), ('diseno_desarrollo','eliminar'),
	('compras','leer'), ('compras','crear'), ('compras','editar'), ('compras','eliminar'),
	('proveedores','leer'), ('proveedores','crear'), ('proveedores','editar'), ('proveedores','eliminar'),
	('produccion','leer'), ('produccion','crear'), ('produccion','editar'), ('produccion','eliminar'),
	('liberacion_ps','leer'), ('liberacion_ps','crear'), ('liberacion_ps','editar'), ('liberacion_ps','eliminar'),
	('salidas_nc','leer'), ('salidas_nc','crear'), ('salidas_nc','editar'), ('salidas_nc','eliminar'),

	('auditorias','leer'), ('auditorias','crear'), ('auditorias','editar'),
	('indicadores','leer'), ('indicadores','crear'), ('indicadores','editar'), ('indicadores','eliminar'),
	('rev_direccion','leer'), ('rev_direccion','crear'), ('rev_direccion','editar'),

	('acciones_correctivas','leer'), ('acciones_correctivas','crear'), ('acciones_correctivas','editar'), ('acciones_correctivas','eliminar'),
	('no_conformidades','leer'), ('no_conformidades','crear'), ('no_conformidades','editar'),
	('mejoras_continuas','leer'), ('mejoras_continuas','crear'), ('mejoras_continuas','editar'), ('mejoras_continuas','eliminar')
) AS matriz(recurso, accion) ON matriz.recurso = p.recurso AND matriz.accion = p.accion
WHERE r.nombre IN ('Gestión', 'Admin SGC')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3) OPERATIVO
-- ============================================================
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON TRUE
JOIN (VALUES
	('procesos','leer'),

	('politica_calidad','leer'),
	('contexto_empresa','leer'),
	('enfoque_cliente','leer'), ('enfoque_cliente','crear'),

	('riesgos','leer'), ('riesgos','crear'),
	('objetivos_calidad','leer'),
	('planificacion_cambios','leer'),

	('competencias','leer'),
	('toma_consciencia','leer'), ('toma_consciencia','crear'),
	('comunicaciones','leer'), ('comunicaciones','crear'),
	('documentos','leer'), ('documentos','crear'),

	('planes_operacion','leer'), ('planes_operacion','crear'),
	('requerimientos_ps','leer'), ('requerimientos_ps','crear'),
	('diseno_desarrollo','leer'), ('diseno_desarrollo','crear'),
	('compras','leer'), ('compras','crear'),
	('proveedores','leer'), ('proveedores','crear'),
	('produccion','leer'), ('produccion','crear'),
	('liberacion_ps','leer'),
	('salidas_nc','leer'), ('salidas_nc','crear'),

	('auditorias','leer'),
	('indicadores','leer'), ('indicadores','crear'),
	('rev_direccion','leer'),

	('acciones_correctivas','leer'), ('acciones_correctivas','crear'),
	('no_conformidades','leer'), ('no_conformidades','crear'),
	('mejoras_continuas','leer'), ('mejoras_continuas','crear')
) AS matriz(recurso, accion) ON matriz.recurso = p.recurso AND matriz.accion = p.accion
WHERE r.nombre IN ('Operativo', 'Usuario')
ON CONFLICT DO NOTHING;

COMMIT;