-- ============================================================
--  Migración 023: bitácora de seguridad inmutable (Fase 3)
--  Archivo: migrations/023_bitacora_seguridad_inmutable.sql
-- ============================================================
--  V10 (trazabilidad), V19 (suplantación), V20 (separación de funciones).
--
--  1. auditoria_eventos: bitácora de seguridad de SOLO INSERCIÓN, con
--     cadena de hashes SHA-256 (cada fila incluye el hash de la anterior).
--     Modificar o borrar una fila rompe la cadena y se detecta con
--     gx_auditoria_verificar(). Sin llaves foráneas a propósito: el registro
--     sobrevive aunque se borre el usuario o la empresa.
--  2. Triggers que impiden UPDATE / DELETE / TRUNCATE en auditoria_eventos,
--     logs_actividad y platform_admin_audit_log.
--  3. logs_actividad: IP, ID de correlación y suplantación.
--  4. sesiones.motivo_suplantacion; platform_admins.rol.
--
--  LIMITACIÓN (documentada): el dueño de la tabla puede desactivar triggers.
--  La cadena de hashes lo hace DETECTABLE; para que sea inalterable de punta
--  a punta, enviar los eventos a un SIEM externo (ver docs/seguridad).
--
--  Aditiva e idempotente. Requiere PostgreSQL 11+ (función sha256).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS auditoria_eventos (
    id                   BIGSERIAL    PRIMARY KEY,
    fecha                TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    correlation_id       VARCHAR(64),
    tenant_id            INTEGER,
    actor_tipo           VARCHAR(16)  NOT NULL CHECK (actor_tipo IN ('usuario', 'platform_admin', 'anonimo', 'sistema')),
    actor_id             INTEGER,
    actor_email          VARCHAR(150),
    suplantado_por_admin INTEGER,
    categoria            VARCHAR(20)  NOT NULL CHECK (categoria IN ('autenticacion', 'acceso', 'usuarios', 'plataforma', 'datos', 'seguridad')),
    accion               VARCHAR(60)  NOT NULL,
    resultado            VARCHAR(10)  NOT NULL CHECK (resultado IN ('exito', 'fallo', 'denegado')),
    recurso              VARCHAR(100),
    recurso_id           VARCHAR(100),
    ip                   VARCHAR(64),
    user_agent           VARCHAR(300),
    metodo               VARCHAR(10),
    ruta                 VARCHAR(300),
    detalle              JSONB        NOT NULL DEFAULT '{}',
    hash_anterior        CHAR(64)     NOT NULL,
    hash                 CHAR(64)     NOT NULL
);
COMMENT ON TABLE auditoria_eventos IS
  'Bitácora de seguridad de solo inserción con cadena de hashes SHA-256. No modificar: ver gx_auditoria_verificar().';
CREATE INDEX IF NOT EXISTS idx_aud_tenant_fecha ON auditoria_eventos (tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_aud_categoria    ON auditoria_eventos (categoria, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_aud_actor        ON auditoria_eventos (actor_tipo, actor_id);

-- Hash de una fila: SHA-256 del hash anterior + todos los campos en forma canónica.
CREATE OR REPLACE FUNCTION gx_auditoria_hash(e auditoria_eventos, anterior TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(concat_ws('|',
           anterior, e.id::text,
           to_char(e.fecha AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
           coalesce(e.correlation_id, ''), coalesce(e.tenant_id::text, ''),
           e.actor_tipo, coalesce(e.actor_id::text, ''), coalesce(e.actor_email, ''),
           coalesce(e.suplantado_por_admin::text, ''), e.categoria, e.accion, e.resultado,
           coalesce(e.recurso, ''), coalesce(e.recurso_id, ''), coalesce(e.ip, ''),
           coalesce(e.user_agent, ''), coalesce(e.metodo, ''), coalesce(e.ruta, ''),
           e.detalle::text), 'UTF8')), 'hex')
$$;

CREATE OR REPLACE FUNCTION gx_auditoria_encadenar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_anterior TEXT;
BEGIN
  -- Serializa las inserciones para que la cadena no se bifurque.
  PERFORM pg_advisory_xact_lock(727002);
  SELECT hash INTO v_anterior FROM auditoria_eventos ORDER BY id DESC LIMIT 1;
  NEW.fecha := clock_timestamp();
  NEW.hash_anterior := coalesce(v_anterior, repeat('0', 64));
  NEW.hash := gx_auditoria_hash(NEW, NEW.hash_anterior);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gx_auditoria_encadenar ON auditoria_eventos;
CREATE TRIGGER gx_auditoria_encadenar BEFORE INSERT ON auditoria_eventos
  FOR EACH ROW EXECUTE FUNCTION gx_auditoria_encadenar();

-- Limpieza previa a la inmutabilidad: entre la Fase 2 y la Fase 3 el
-- registro genérico de actividad podía guardar como "Elemento" el código
-- MFA (6 dígitos) o un código de recuperación (XXXXX-XXXXX) enviado a
-- /api/auth/mfa/*. Se reemplazan antes de volver la tabla de solo inserción.
DO $$
BEGIN
  IF to_regclass('logs_actividad') IS NOT NULL THEN
    UPDATE logs_actividad
       SET detalle = regexp_replace(detalle, 'Elemento: "([0-9]{6}|[A-Z2-7]{5}-?[A-Z2-7]{5})"', 'Elemento: "[código omitido]"', 'g')
     WHERE recurso = 'auth'
       AND detalle ~ 'Elemento: "([0-9]{6}|[A-Z2-7]{5}-?[A-Z2-7]{5})"';
  END IF;
END $$;

-- Solo inserción: cualquier UPDATE / DELETE / TRUNCATE se rechaza.
CREATE OR REPLACE FUNCTION gx_bitacora_solo_insercion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción (bitácora de auditoría): % no permitido', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['auditoria_eventos', 'logs_actividad', 'platform_admin_audit_log'] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS gx_solo_insercion ON %I', t);
      EXECUTE format('CREATE TRIGGER gx_solo_insercion BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION gx_bitacora_solo_insercion()', t);
      EXECUTE format('DROP TRIGGER IF EXISTS gx_sin_truncate ON %I', t);
      EXECUTE format('CREATE TRIGGER gx_sin_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION gx_bitacora_solo_insercion()', t);
    END IF;
  END LOOP;
END;
$$;

-- Verificación de integridad: devuelve las filas cuya cadena no cuadra
-- (vacío = íntegra). Uso: SELECT * FROM gx_auditoria_verificar();
CREATE OR REPLACE FUNCTION gx_auditoria_verificar()
RETURNS TABLE (id BIGINT, problema TEXT)
LANGUAGE sql STABLE AS $$
  SELECT x.id,
         CASE WHEN x.hash_anterior <> x.esperado_anterior THEN 'eslabón roto: falta o se alteró la fila anterior'
              ELSE 'contenido alterado' END
  FROM (
    SELECT e.id, e.hash, e.hash_anterior,
           coalesce(lag(e.hash) OVER (ORDER BY e.id), repeat('0', 64)) AS esperado_anterior,
           gx_auditoria_hash(e, e.hash_anterior) AS recalculado
    FROM auditoria_eventos e
  ) x
  WHERE x.hash_anterior <> x.esperado_anterior OR x.hash <> x.recalculado
  ORDER BY x.id
$$;

-- logs_actividad: trazabilidad técnica
ALTER TABLE logs_actividad ADD COLUMN IF NOT EXISTS ip                   VARCHAR(64);
ALTER TABLE logs_actividad ADD COLUMN IF NOT EXISTS correlation_id       VARCHAR(64);
ALTER TABLE logs_actividad ADD COLUMN IF NOT EXISTS suplantado_por_admin INTEGER;

-- Suplantación con motivo obligatorio
ALTER TABLE sesiones ADD COLUMN IF NOT EXISTS motivo_suplantacion VARCHAR(300);

-- Separación de funciones en la plataforma (los admins existentes quedan como propietarios)
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'propietario';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_platform_admins_rol') THEN
    ALTER TABLE platform_admins ADD CONSTRAINT ck_platform_admins_rol CHECK (rol IN ('propietario', 'operador'));
  END IF;
END $$;

COMMIT;
