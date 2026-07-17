-- migrations/007_fix_roles_negocio.sql
-- ============================================================
--  GOVERNEX — Corrección del modelo de roles de negocio
--  Alinea ROLES con el modelo real: Superusuario / Operativo / Gestión
-- ============================================================
BEGIN;

-- 1) Renombrar roles existentes (se conserva el id => no rompe FKs en usuarios)
UPDATE roles SET nombre = 'Superusuario' WHERE nombre = 'Alta Dirección';
UPDATE roles SET nombre = 'Gestión'      WHERE nombre = 'Admin SGC';
UPDATE roles SET nombre = 'Operativo'    WHERE nombre = 'Usuario';

-- 2) Limpiar toda asignación previa de estos roles y reconstruir desde cero
DELETE FROM rol_permisos
WHERE rol_id IN (SELECT id FROM roles WHERE nombre IN ('Superusuario','Gestión','Operativo'));

-- 3) SUPERUSUARIO — Gerencia + responsable del SGC: control total
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre = 'Superusuario'), p.id
FROM permisos p
ON CONFLICT DO NOTHING;

-- 4) GESTIÓN — todos los procesos, SOLO observar (leer en todo, nada más)
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre = 'Gestión'), p.id
FROM permisos p
WHERE p.accion = 'leer'
ON CONFLICT DO NOTHING;

-- 5) OPERATIVO — alimenta Governex con datos en los formatos dispuestos:
--    leer + crear, sin editar/eliminar/aprobar
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre = 'Operativo'), p.id
FROM permisos p
WHERE p.accion IN ('leer', 'crear')
ON CONFLICT DO NOTHING;

COMMIT;