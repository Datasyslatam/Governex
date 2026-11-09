-- ============================================================
--  Migración 020: tablas y columnas que solo existían en scripts sueltos
--
--  Hasta ahora estas estructuras se creaban con scripts ad hoc
--  (scratch/migrate_user_perms.ts, scratch/migrate_activity_logs.ts,
--  scripts/migrate_r2_log.ts, scripts/add_guia_markdown.ts) o con un
--  ALTER TABLE que src/db.ts ejecutaba en cada arranque. Con esta migración,
--  schema.sql + migrations/ reconstruyen la base de datos completa.
--
--  Idempotente: en una BD donde ya existen (producción), no cambia nada.
-- ============================================================

-- Permisos personalizados por usuario (antes: scratch/migrate_user_perms.ts)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS tiene_permisos_personalizados BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS usuario_permisos (
  usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  permiso_id INTEGER NOT NULL REFERENCES permisos (id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, permiso_id)
);

-- Bitácora de actividad (antes: scratch/migrate_activity_logs.ts)
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

-- Registro de cargas a R2 (antes: scripts/migrate_r2_log.ts)
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
COMMENT ON TABLE registro_cargas_r2 IS 'Registro histórico de todas las cargas de documentos a R2.';

-- Guía de capacitación en Markdown (antes: ALTER automático en src/db.ts
-- y scripts/add_guia_markdown.ts)
ALTER TABLE plan_formacion ADD COLUMN IF NOT EXISTS guia_markdown TEXT;
