-- ============================================================
--  Migración 024: rol de mínimo privilegio y Row-Level Security por empresa
--  (Fase 5, V16)
--
--  1. Rol `governex_app`, para la aplicación: sin superusuario, sin BYPASSRLS,
--     sin crear objetos; solo SELECT/INSERT/UPDATE/DELETE sobre los datos.
--     Se crea NOLOGIN: el gestor de migraciones (scripts/migrate.ts) le da
--     LOGIN y contraseña desde la variable GX_APP_DB_PASSWORD, nunca desde
--     este archivo. Las migraciones siguen corriendo con el rol dueño
--     (MIGRATION_DATABASE_URL).
--  2. RLS en todas las tablas con columna tenant_id: una fila solo es visible
--     o escribible si su tenant_id coincide con el de la sesión de BD
--     (`app.tenant_id`, que fija src/db.ts en cada petición), o si la
--     petición corre "como sistema" (`app.sistema = on`: login, MFA, panel de
--     plataforma). Sin contexto no se ve ninguna fila.
--     Excluidas: sesiones (se busca por hash del token antes de saber la
--     empresa) y auditoria_eventos (bitácora de solo inserción que se escribe
--     desde cualquier contexto; la app filtra por empresa al leer).
--  3. El trigger de integridad padre→hijo (022) pasa a SECURITY DEFINER: con
--     RLS activo no vería el registro padre de otra empresa y dejaría pasar
--     justamente la referencia cruzada que debe impedir.
--
--  Idempotente: se puede ejecutar varias veces sin efecto adicional.
--  Con el rol dueño/superusuario las políticas no aplican (PostgreSQL), así
--  que hasta que DATABASE_URL use governex_app el comportamiento no cambia.
-- ============================================================

-- 1. Rol de la aplicación ---------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'governex_app') THEN
    CREATE ROLE governex_app NOLOGIN;
  END IF;
END
$$;
ALTER ROLE governex_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 30;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO governex_app', current_database());
END
$$;

-- Nadie fuera del dueño crea objetos en el esquema (por defecto desde PG 15).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO governex_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO governex_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO governex_app;
-- Tablas que creen migraciones futuras (las crea el mismo rol dueño).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO governex_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO governex_app;

-- La app no toca el control de migraciones.
REVOKE ALL ON schema_migrations FROM governex_app;

-- Bitácoras: la app solo inserta y lee (además de los triggers de la 023).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['auditoria_eventos', 'logs_actividad', 'platform_admin_audit_log'] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON %I FROM governex_app', t);
    END IF;
  END LOOP;
END
$$;

-- 2. RLS por empresa --------------------------------------------------------
DO $$
DECLARE
  t text;
  n integer := 0;
  condicion constant text :=
    $c$current_setting('app.sistema', true) = 'on' OR tenant_id = nullif(current_setting('app.tenant_id', true), '')::integer$c$;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace s ON s.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
    WHERE s.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND c.relname NOT IN ('sesiones', 'auditoria_eventos')
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS gx_aislamiento_empresa ON %I', t);
    EXECUTE format('CREATE POLICY gx_aislamiento_empresa ON %I USING (%s) WITH CHECK (%s)', t, condicion, condicion);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'RLS por empresa activo en % tablas.', n;
END
$$;

-- Tablas con tenant_id que no tienen RLS (debe devolver solo las dos
-- excluidas a propósito). La app lo consulta al arrancar y avisa si una
-- migración futura crea una tabla con tenant_id sin política.
CREATE OR REPLACE FUNCTION gx_tablas_tenant_sin_rls() RETURNS SETOF text
LANGUAGE sql STABLE AS $$
  SELECT c.relname::text
  FROM pg_class c
  JOIN pg_namespace s ON s.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
  WHERE s.nspname = 'public' AND c.relkind IN ('r', 'p')
    AND c.relname NOT IN ('sesiones', 'auditoria_eventos')
    AND NOT (c.relrowsecurity AND c.relforcerowsecurity)
  ORDER BY 1
$$;

-- 3. Trigger padre→hijo con visibilidad completa ---------------------------
ALTER FUNCTION gx_verificar_tenant_padre() SECURITY DEFINER SET search_path = pg_catalog, public;
