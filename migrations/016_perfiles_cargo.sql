-- ============================================================
-- Migración 016 — Perfiles de Cargo por IA (§7.2 Competencias)
-- Agrega el flujo: Manual de Funciones (PDF) → Perfil de Cargo
-- → Listas de chequeo → Plan de Capacitación a la medida.
-- 100% aditivo: no toca personal, evaluaciones_competencia ni
-- plan_formacion salvo por columnas nuevas con IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS perfiles_cargo (
    id                    SERIAL       PRIMARY KEY,
    cargo                 VARCHAR(150) NOT NULL,
    proceso_id            INTEGER      REFERENCES procesos (id),
    archivo_key           TEXT,
    archivo_nombre        VARCHAR(255),
    educacion             TEXT,
    formacion             TEXT,
    experiencia           TEXT,
    checklist_desempeno   JSONB        NOT NULL DEFAULT '[]',
    checklist_conocimiento JSONB       NOT NULL DEFAULT '[]',
    necesidades_adicionales JSONB      NOT NULL DEFAULT '[]',
    generado_con_ia       BOOLEAN      NOT NULL DEFAULT FALSE,
    creado_en             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id             INTEGER      NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT
);
COMMENT ON TABLE perfiles_cargo IS
    'ISO 9001:2015 §7.2 — Perfil de cargo (educación, formación, experiencia) extraído por IA desde el Manual de Funciones en PDF, con listas de chequeo de desempeño/conocimiento generadas por IA.';
COMMENT ON COLUMN perfiles_cargo.archivo_key IS 'Key en R2 del PDF del Manual de Funciones (vía /api/uploads)';
COMMENT ON COLUMN perfiles_cargo.checklist_desempeno IS 'Array JSON de strings: ítems de checklist de evaluación de desempeño para este perfil';
COMMENT ON COLUMN perfiles_cargo.checklist_conocimiento IS 'Array JSON de strings: ítems de checklist de evaluación de conocimientos para este perfil';
COMMENT ON COLUMN perfiles_cargo.necesidades_adicionales IS 'Array JSON de strings: necesidades de conocimiento/tecnológicas agregadas manualmente para retroalimentar el plan de capacitación';
CREATE INDEX IF NOT EXISTS idx_perfiles_cargo_tenant_id ON perfiles_cargo (tenant_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_cargo_proceso   ON perfiles_cargo (proceso_id);

-- Vincula el Plan de Formación existente con el perfil de cargo que lo originó
ALTER TABLE plan_formacion
  ADD COLUMN IF NOT EXISTS perfil_cargo_id INTEGER REFERENCES perfiles_cargo (id),
  ADD COLUMN IF NOT EXISTS generado_con_ia BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN plan_formacion.perfil_cargo_id IS 'Si la actividad de formación fue generada a partir de un perfil de cargo (IA), referencia al perfil origen';
COMMENT ON COLUMN plan_formacion.generado_con_ia IS 'Indica si esta actividad fue sugerida por IA a partir del perfil de cargo';
CREATE INDEX IF NOT EXISTS idx_plan_formacion_perfil_cargo ON plan_formacion (perfil_cargo_id);
