-- ============================================================
-- 012_analisis_enfoque_cliente.sql
-- Tabla para persistencia del Análisis DOFA en Enfoque al Cliente
-- ============================================================

CREATE TABLE IF NOT EXISTS analisis_enfoque_cliente (
  id                    SERIAL       PRIMARY KEY,
  tenant_id             INTEGER      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resumen_ejecutivo     TEXT         NOT NULL,
  dofa                  JSONB        NOT NULL DEFAULT '[]',
  documentos_analizados JSONB        NOT NULL DEFAULT '[]',
  creado_por            INTEGER      REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analisis_enfoque_cliente_tenant
  ON analisis_enfoque_cliente(tenant_id);
