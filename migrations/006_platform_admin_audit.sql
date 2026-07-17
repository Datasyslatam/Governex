-- ============================================================
--  GOVERNEX — Auditoría de acciones de super-administradores
--  Archivo: migrations/006_platform_admin_audit.sql
-- ============================================================
--  Registra cada acción sensible ejecutada por un platform_admin:
--  creación/suspensión de tenants, creación/desactivación de otros
--  platform_admins, etc. Es un registro append-only — no se expone
--  ningún endpoint de UPDATE/DELETE sobre esta tabla.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS platform_admin_audit_log (
	id SERIAL PRIMARY KEY,
	actor_admin_id INTEGER REFERENCES platform_admins (id) ON DELETE SET NULL,
	actor_email VARCHAR(150) NOT NULL,   -- snapshot: se conserva aunque el autor sea borrado/desactivado
	accion VARCHAR(50) NOT NULL,
	entidad_tipo VARCHAR(30) NOT NULL,   -- 'tenant' | 'platform_admin'
	entidad_id VARCHAR(30),
	detalle JSONB NOT NULL DEFAULT '{}',
	creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_admin_audit_log IS 'Bitácora append-only de acciones sensibles de super-administradores. actor_email es snapshot para conservar trazabilidad si el admin autor es desactivado o eliminado.';

CREATE INDEX IF NOT EXISTS idx_paal_actor   ON platform_admin_audit_log (actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_paal_entidad ON platform_admin_audit_log (entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_paal_creado  ON platform_admin_audit_log (creado_en DESC);

COMMIT;