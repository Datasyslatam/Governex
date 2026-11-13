-- ============================================================
--  Migración 021: sesiones revocables, MFA, bloqueo de cuentas
--  Archivo: migrations/021_sesiones_mfa_bloqueo.sql
-- ============================================================
--  Fase 2 del plan de seguridad (V02, V06, V07, V08, V09).
--  Aditiva e idempotente: no modifica ni borra datos existentes.
--  Ejecutar ANTES de desplegar el código de la Fase 2.
-- ============================================================

BEGIN;

-- ── Usuarios de empresa ──────────────────────────────────────
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_habilitado        BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_secreto_cifrado   TEXT;          -- AES-256-GCM, nunca en claro
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_ultimo_paso       BIGINT;        -- anti-reutilización del código TOTP
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos     INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta       TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_cambiado_en  TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso_en      TIMESTAMPTZ;

-- ── Platform admins ──────────────────────────────────────────
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS mfa_habilitado        BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS mfa_secreto_cifrado   TEXT;
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS mfa_ultimo_paso       BIGINT;
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS intentos_fallidos     INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS bloqueado_hasta       TIMESTAMPTZ;
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS password_cambiado_en  TIMESTAMPTZ;
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS ultimo_acceso_en      TIMESTAMPTZ;

-- ── Códigos de recuperación MFA (un solo uso, se guarda solo el hash) ──
CREATE TABLE IF NOT EXISTS mfa_codigos_recuperacion (
    id                SERIAL      PRIMARY KEY,
    usuario_id        INTEGER     REFERENCES usuarios (id) ON DELETE CASCADE,
    platform_admin_id INTEGER     REFERENCES platform_admins (id) ON DELETE CASCADE,
    codigo_hash       TEXT        NOT NULL,
    usado_en          TIMESTAMPTZ,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_mfa_rec_titular CHECK ((usuario_id IS NULL) <> (platform_admin_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_mfa_rec_usuario  ON mfa_codigos_recuperacion (usuario_id);
CREATE INDEX IF NOT EXISTS idx_mfa_rec_platform ON mfa_codigos_recuperacion (platform_admin_id);

-- ── Sesiones del lado del servidor ───────────────────────────
-- El navegador solo guarda un identificador aleatorio en una cookie
-- HttpOnly; aquí se guarda su hash SHA-256. Revocar = marcar revocada_en.
CREATE TABLE IF NOT EXISTS sesiones (
    id                    UUID        PRIMARY KEY,
    token_hash            TEXT        NOT NULL UNIQUE,
    tipo                  VARCHAR(10) NOT NULL CHECK (tipo IN ('tenant', 'platform')),
    etapa                 VARCHAR(12) NOT NULL DEFAULT 'activa' CHECK (etapa IN ('mfa', 'enrolar_mfa', 'activa')),
    usuario_id            INTEGER     REFERENCES usuarios (id) ON DELETE CASCADE,
    platform_admin_id     INTEGER     REFERENCES platform_admins (id) ON DELETE CASCADE,
    tenant_id             INTEGER     REFERENCES tenants (id) ON DELETE CASCADE,
    suplantado_por_admin  INTEGER     REFERENCES platform_admins (id) ON DELETE SET NULL,
    csrf_token            TEXT        NOT NULL,
    ip                    VARCHAR(64),
    user_agent            VARCHAR(300),
    creada_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultimo_uso_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_en             TIMESTAMPTZ NOT NULL,
    revocada_en           TIMESTAMPTZ,
    motivo_revocacion     VARCHAR(60),
    CONSTRAINT ck_sesiones_titular CHECK (
        (tipo = 'tenant'   AND usuario_id IS NOT NULL AND platform_admin_id IS NULL) OR
        (tipo = 'platform' AND platform_admin_id IS NOT NULL AND usuario_id IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario  ON sesiones (usuario_id)        WHERE revocada_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_sesiones_platform ON sesiones (platform_admin_id) WHERE revocada_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_sesiones_expira   ON sesiones (expira_en);

COMMIT;
