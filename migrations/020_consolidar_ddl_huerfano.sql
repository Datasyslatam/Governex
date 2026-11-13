-- ============================================================
--  Migración 020: consolidar DDL "huérfano"
--  Archivo: migrations/020_consolidar_ddl_huerfano.sql
-- ============================================================
--  Hasta ahora estas tablas/columnas solo se creaban con scripts sueltos
--  (src/migrate.ts, scratch/migrate_user_perms.ts,
--  scratch/migrate_activity_logs.ts, scripts/migrate_r2_log.ts y un ALTER
--  automático en src/db.ts). Sin ellas, una BD construida con schema.sql +
--  migrations/ no funcionaba (p. ej. crear un proceso fallaba con 500).
--
--  Es 100% idempotente (IF NOT EXISTS): en una BD que ya tiene todo, no
--  cambia nada. Seguro de ejecutar en producción.
-- ============================================================

BEGIN;

-- Procesos: caracterización (antes en src/migrate.ts)
ALTER TABLE procesos ADD COLUMN IF NOT EXISTS actividades         TEXT;
ALTER TABLE procesos ADD COLUMN IF NOT EXISTS indicador_entrada   TEXT;
ALTER TABLE procesos ADD COLUMN IF NOT EXISTS indicador_actividad TEXT;
ALTER TABLE procesos ADD COLUMN IF NOT EXISTS indicador_salida    TEXT;
ALTER TABLE procesos ADD COLUMN IF NOT EXISTS riesgo_entrada      TEXT;
ALTER TABLE procesos ADD COLUMN IF NOT EXISTS op_entrada          TEXT;
ALTER TABLE procesos ADD COLUMN IF NOT EXISTS riesgo_actividad    TEXT;
ALTER TABLE procesos ADD COLUMN IF NOT EXISTS op_actividad        TEXT;
ALTER TABLE procesos ADD COLUMN IF NOT EXISTS riesgo_salida       TEXT;
ALTER TABLE procesos ADD COLUMN IF NOT EXISTS op_salida           TEXT;

-- Compras / evaluaciones (antes en src/migrate.ts)
ALTER TABLE fichas_tecnicas_compra    ADD COLUMN IF NOT EXISTS variables_criticas  TEXT;
ALTER TABLE fichas_tecnicas_compra    ADD COLUMN IF NOT EXISTS proveedor_id        INTEGER;
ALTER TABLE proveedor_evaluaciones    ADD COLUMN IF NOT EXISTS variables_evaluadas TEXT;
ALTER TABLE evaluaciones_orden_compra ADD COLUMN IF NOT EXISTS variables_evaluadas TEXT;

-- Competencias (antes un ALTER en cada arranque de src/db.ts)
ALTER TABLE plan_formacion ADD COLUMN IF NOT EXISTS guia_markdown TEXT;

-- RBAC por usuario (antes en scratch/migrate_user_perms.ts)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tiene_permisos_personalizados BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS usuario_permisos (
    usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    permiso_id INTEGER NOT NULL REFERENCES permisos (id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, permiso_id)
);

-- Bitácora de actividad (antes en scratch/migrate_activity_logs.ts)
CREATE TABLE IF NOT EXISTS logs_actividad (
    id             SERIAL PRIMARY KEY,
    tenant_id      INTEGER NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    usuario_id     INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
    usuario_nombre VARCHAR(150),
    usuario_email  VARCHAR(150),
    usuario_rol    VARCHAR(50),
    accion         VARCHAR(100) NOT NULL,
    recurso        VARCHAR(100),
    detalle        TEXT,
    fecha_hora     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_logs_actividad_tenant_fecha ON logs_actividad (tenant_id, fecha_hora DESC);

-- Registro de cargas a R2 (antes en scripts/migrate_r2_log.ts)
CREATE TABLE IF NOT EXISTS registro_cargas_r2 (
    id             SERIAL PRIMARY KEY,
    tenant_id      INTEGER NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    usuario_id     INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    key_r2         TEXT NOT NULL UNIQUE,
    mime_type      VARCHAR(100) NOT NULL,
    tamano_bytes   BIGINT NOT NULL,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
