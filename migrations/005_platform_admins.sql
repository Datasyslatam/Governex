-- ============================================================
--  GOVERNEX — Super-administradores de plataforma
--  Archivo: migrations/005_platform_admins.sql
-- ============================================================
--  Tabla deliberadamente SIN tenant_id: un platform_admin no pertenece
--  a ningún tenant, administra la plataforma completa (onboarding de
--  clientes nuevos, suspensión de cuentas morosas, etc). Se mantiene
--  100% separada de USUARIOS para que sea estructuralmente imposible
--  que un token de esta tabla se confunda con un token de tenant.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS platform_admins (
	id SERIAL PRIMARY KEY,
	nombre VARCHAR(100) NOT NULL,
	email VARCHAR(150) NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	activo BOOLEAN NOT NULL DEFAULT TRUE,
	creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_admins IS 'Staff de Governex con acceso de administración de plataforma (crear/suspender tenants). No tiene relación con TENANTS ni USUARIOS.';

COMMIT;

INSERT INTO platform_admins (nombre, email, password_hash)
VALUES ('SuperAdmin', 'luismj.dev@gmail.com', '$2a$10$yDFtxb/PoBcbCU6HS5RTp.2gTbLGh0LiRkcdlFeSx6a.CTmV62c5y');

-- ============================================================
-- Alta del primer platform_admin (ejecutar manualmente, UNA vez).
-- No se siembra ninguna contraseña por defecto desde la migración.
--
-- 1) Generar el hash localmente (Node, con bcryptjs ya en el proyecto):
--
--      node -e "console.log(require('bcryptjs').hashSync('TU_PASSWORD_TEMPORAL', 10))"
--
-- 2) Insertar con el hash resultante:
--
--   INSERT INTO platform_admins (nombre, email, password_hash)
--   VALUES ('Tu Nombre', 'tu-email@governex.com', '<hash generado en el paso 1>');
--
-- 3) Inicia sesión con ese email/password en POST /api/platform-admin/login
--    y cambia la contraseña temporal cuanto antes (no hay endpoint de
--    "cambiar mi contraseña" para platform_admins todavía — es el
--    siguiente paso natural si quieres que lo agregue).
-- ============================================================