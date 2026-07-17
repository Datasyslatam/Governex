-- ============================================================
--  GOVERNEX — Corrección sobre 001_multitenant.sql
--  Archivo: migrations/003_fix_email_unique_global.sql
-- ============================================================
--  El login (POST /api/auth/login) solo recibe email + password, SIN
--  selección de tenant (requisito explícito del proyecto). Con
--  UNIQUE(tenant_id, email), dos tenants distintos podrían tener cada
--  uno un usuario con el mismo email, y la consulta del login
--  (`WHERE email = $1`) devolvería más de una fila, sin ninguna forma
--  de determinar a qué tenant pertenece la persona que se autentica.
--
--  Por eso el email de USUARIOS vuelve a ser único a nivel PLATAFORMA
--  (global), no compuesto con tenant_id. El aislamiento entre tenants
--  para todo lo demás (datos de negocio) no se ve afectado: solo se
--  ajusta la unicidad de esta columna puntual.
-- ============================================================

BEGIN;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS uq_usuarios_tenant_email;
ALTER TABLE usuarios ADD CONSTRAINT uq_usuarios_email UNIQUE (email);

COMMIT;
