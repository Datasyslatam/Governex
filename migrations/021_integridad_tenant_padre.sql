-- ============================================================
--  Migración 021: integridad multi-tenant en referencias padre → hijo
--
--  Problema: varias rutas reciben el id de un registro "padre" desde la
--  petición (proceso_id, nc_id, proveedor_id, personal_id, ...) y no
--  verifican que ese padre pertenezca a la misma empresa. Así, la empresa A
--  podía crear p. ej. un indicador apuntando al proceso de la empresa B, y
--  en sus listados (que hacen JOIN con el padre) ver datos de B.
--
--  Solución: un trigger genérico que, al insertar o cambiar una referencia,
--  exige que el padre tenga el mismo tenant_id que el hijo. Protege todas las
--  rutas actuales y las futuras, sin tocar el código de cada una.
--
--  Compatibilidad con datos existentes:
--   - Solo se valida al INSERTAR o al CAMBIAR la referencia; un registro
--     antiguo con una referencia cruzada se puede seguir editando mientras
--     no cambie esa referencia ni su tenant_id.
--   - Si el padre no existe, el trigger no interviene (la FK, si existe,
--     sigue haciendo su trabajo; las referencias "blandas" se comportan
--     igual que antes).
--   - Al aplicar la migración se REPORTAN (RAISE NOTICE) las referencias
--     cruzadas ya existentes, sin modificarlas.
--
--  Idempotente: se puede ejecutar varias veces.
-- ============================================================

CREATE OR REPLACE FUNCTION gx_verificar_tenant_padre() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_col         text := TG_ARGV[0];   -- columna FK en la tabla hija
  v_padre       text := TG_ARGV[1];   -- tabla padre
  v_padre_col   text := TG_ARGV[2];   -- columna clave en la tabla padre
  v_tipo        text := TG_ARGV[3];   -- tipo SQL de esa clave (para usar el índice)
  v_nuevo       jsonb := to_jsonb(NEW);
  v_ref         text := v_nuevo ->> v_col;
  v_tenant_padre integer;
  v_filas       integer;
BEGIN
  IF v_ref IS NULL THEN
    RETURN NEW;
  END IF;

  -- Registro existente cuya referencia y tenant no cambian: no se revalida
  -- (no bloquea la edición de datos antiguos).
  IF TG_OP = 'UPDATE'
     AND (to_jsonb(OLD) ->> v_col) IS NOT DISTINCT FROM v_ref
     AND (to_jsonb(OLD) ->> 'tenant_id') IS NOT DISTINCT FROM (v_nuevo ->> 'tenant_id') THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT tenant_id FROM %I WHERE %I = CAST($1 AS %s)', v_padre, v_padre_col, v_tipo)
    INTO v_tenant_padre
    USING v_ref;
  -- Ojo: EXECUTE no actualiza FOUND en PL/pgSQL; se usa ROW_COUNT.
  GET DIAGNOSTICS v_filas = ROW_COUNT;

  IF v_filas > 0 AND v_tenant_padre IS DISTINCT FROM (v_nuevo ->> 'tenant_id')::integer THEN
    RAISE EXCEPTION 'Referencia entre empresas no permitida: %.% = % pertenece a otra empresa',
                    TG_TABLE_NAME, v_col, v_ref
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r            record;
  v_trigger    text;
  v_cruzadas   bigint;
  v_total      integer := 0;
BEGIN
  FOR r IN
    -- 1) Todas las FK de una sola columna entre tablas que tienen tenant_id
    SELECT c.conrelid::regclass::text  AS hija,
           a.attname::text             AS col,
           c.confrelid::regclass::text AS padre,
           pa.attname::text            AS padre_col,
           format_type(pa.atttypid, pa.atttypmod) AS tipo
    FROM pg_constraint c
    JOIN pg_attribute a  ON a.attrelid  = c.conrelid  AND a.attnum  = c.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND a.attname <> 'tenant_id'
      AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = c.conrelid  AND x.attname = 'tenant_id' AND NOT x.attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = c.confrelid AND x.attname = 'tenant_id' AND NOT x.attisdropped)
    UNION
    -- 2) Referencias "blandas" (sin FK declarada) usadas por las rutas
    SELECT v.hija, v.col, v.padre, 'id', format_type(pa.atttypid, pa.atttypmod)
    FROM (VALUES
            ('requerimientos_ps',      'ficha_tecnica_id', 'fichas_tecnicas_ps'),
            ('fichas_tecnicas_compra', 'proveedor_id',     'proveedores'),
            ('riesgos',                'actividad_id',     'actividades_empresa'),
            ('proyectos_diseno',       'actividad_id',     'actividades_empresa')
         ) AS v(hija, col, padre)
    JOIN pg_attribute pa ON pa.attrelid = to_regclass(v.padre) AND pa.attname = 'id' AND NOT pa.attisdropped
    WHERE to_regclass(v.hija) IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = to_regclass(v.hija)  AND x.attname = v.col       AND NOT x.attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = to_regclass(v.hija)  AND x.attname = 'tenant_id' AND NOT x.attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = to_regclass(v.padre) AND x.attname = 'tenant_id' AND NOT x.attisdropped)
  LOOP
    v_trigger := left(format('gx_tenant_%s_%s', r.hija, r.col), 63);

    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = v_trigger AND tgrelid = to_regclass(r.hija)) THEN
      EXECUTE format('DROP TRIGGER %I ON %I', v_trigger, r.hija);
    END IF;
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I, tenant_id ON %I
         FOR EACH ROW EXECUTE FUNCTION gx_verificar_tenant_padre(%L, %L, %L, %L)',
      v_trigger, r.col, r.hija, r.col, r.padre, r.padre_col, r.tipo);
    v_total := v_total + 1;

    -- Diagnóstico de datos existentes (no se modifican)
    EXECUTE format(
      'SELECT count(*) FROM %I h JOIN %I p ON p.%I = h.%I WHERE p.tenant_id IS DISTINCT FROM h.tenant_id',
      r.hija, r.padre, r.padre_col, r.col)
      INTO v_cruzadas;
    IF v_cruzadas > 0 THEN
      RAISE NOTICE 'ATENCIÓN: % fila(s) existentes en %.% referencian un % de otra empresa (revisar manualmente).',
                   v_cruzadas, r.hija, r.col, r.padre;
    END IF;
  END LOOP;

  RAISE NOTICE 'Integridad multi-tenant: % trigger(s) de referencia padre→hijo instalados.', v_total;
END;
$$;
