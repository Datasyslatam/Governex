-- ============================================================
-- 011_mapa_manual_procedimiento.sql
-- Tablas para persistencia del Mapa de Procedimiento y el
-- Manual de Procedimiento (ISO 9001:2015 §8.1 / §4.4)
-- ============================================================

-- ── Mapa de Procedimiento ──────────────────────────────────
-- Cada fila corresponde a un proceso del mapa, con su tipo,
-- responsable, cláusula ISO aplicable y descripción de funciones.
-- Deriva de FilaMatriz (matrizRoles) generada por la IA.
CREATE TABLE IF NOT EXISTS mapa_procedimiento (
  id          SERIAL       PRIMARY KEY,
  tenant_id   INTEGER      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proceso     TEXT         NOT NULL,
  tipo        TEXT         NOT NULL DEFAULT 'misional'
                           CHECK (tipo IN ('estrategico', 'misional', 'apoyo')),
  responsable TEXT,
  clausula    TEXT,
  funciones   TEXT,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mapa_procedimiento_tenant
  ON mapa_procedimiento(tenant_id);

-- ── Manual de Procedimiento ────────────────────────────────
-- Cada fila documenta la ficha técnica completa de un proceso:
-- código, objetivo, entradas, salidas, indicador, responsable y
-- cláusula ISO. Deriva de CaracterizacionRow (tabla procesos).
CREATE TABLE IF NOT EXISTS manual_procedimiento (
  id          SERIAL       PRIMARY KEY,
  tenant_id   INTEGER      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo      TEXT         NOT NULL,
  proceso     TEXT         NOT NULL,
  objetivo    TEXT,
  entradas    TEXT,
  salidas     TEXT,
  indicador   TEXT,
  responsable TEXT,
  estado      TEXT         NOT NULL DEFAULT 'Activo',
  clausula    TEXT,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_procedimiento_tenant
  ON manual_procedimiento(tenant_id);
