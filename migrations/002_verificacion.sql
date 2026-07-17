-- ============================================================
--  GOVERNEX — Verificación post-migración
--  Ejecutar DESPUÉS de 001_multitenant.sql para confirmar que
--  no quedó ninguna fila huérfana ni tabla de negocio sin tenant_id.
-- ============================================================

-- 1) Todas las tablas de negocio deben tener tenant_id NOT NULL y FK a tenants.
--    Si esta consulta devuelve filas, falta migrar esa tabla.
SELECT table_name
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT IN ('tenants', 'roles', 'permisos', 'rol_permisos')
  AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = t.table_name
        AND c.column_name = 'tenant_id'
  );

-- 2) Ninguna fila de negocio debe tener tenant_id NULL (debería ser imposible
--    por el NOT NULL, pero se deja como doble verificación explícita).
--    Repetir por cada tabla que te interese auditar puntualmente, ejemplo:
-- SELECT count(*) FROM riesgos WHERE tenant_id IS NULL;
-- SELECT count(*) FROM documentos WHERE tenant_id IS NULL;

-- 3) Todas las FK tenant_id deben apuntar a un tenant existente (garantizado
--    por la FK, pero útil si se migran datos manualmente con triggers desactivados).
-- SELECT * FROM riesgos r WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = r.tenant_id);

-- 4) Conteo de filas por tenant en las tablas más grandes, para confirmar
--    que el tenant inicial (id=1) concentra todos los datos existentes.
SELECT 'usuarios' AS tabla, tenant_id, count(*) FROM usuarios GROUP BY tenant_id
UNION ALL
SELECT 'procesos', tenant_id, count(*) FROM procesos GROUP BY tenant_id
UNION ALL
SELECT 'riesgos', tenant_id, count(*) FROM riesgos GROUP BY tenant_id
UNION ALL
SELECT 'documentos', tenant_id, count(*) FROM documentos GROUP BY tenant_id
UNION ALL
SELECT 'auditorias', tenant_id, count(*) FROM auditorias GROUP BY tenant_id
UNION ALL
SELECT 'no_conformidades', tenant_id, count(*) FROM no_conformidades GROUP BY tenant_id
ORDER BY tabla, tenant_id;
