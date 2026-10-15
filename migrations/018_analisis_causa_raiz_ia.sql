-- Migración 018: Soporte para Análisis de Causa Raíz con IA y Trazabilidad de Hallazgos (9.2 -> 10.1 / 10.2 / 10.3)

-- 1. Ampliar el origen en no_conformidades para admitir Auditoría Externa
ALTER TABLE no_conformidades 
  DROP CONSTRAINT IF EXISTS no_conformidades_origen_check;

ALTER TABLE no_conformidades 
  ADD CONSTRAINT no_conformidades_origen_check 
  CHECK (origen IN (
    'Auditoría Interna', 'Auditoría Externa', 'Cliente (Queja)', 
    'Proceso Interno', 'Proveedor', 'Otro'
  ));

-- 2. Agregar soporte para correccion_inmediata y analisis_detalle (JSONB) en acciones_correctivas
ALTER TABLE acciones_correctivas
  ADD COLUMN IF NOT EXISTS correccion_inmediata TEXT,
  ADD COLUMN IF NOT EXISTS analisis_detalle JSONB DEFAULT '{}';

COMMENT ON COLUMN acciones_correctivas.analisis_detalle IS 
  'Estructura JSON con los pasos de 5 Porqués o ramas de Ishikawa (6M) generados por IA';

-- 3. Vincular Oportunidades de Mejora (10.1 / 10.3) con su hallazgo de origen
ALTER TABLE mejoras_continuas
  ADD COLUMN IF NOT EXISTS hallazgo_id INTEGER REFERENCES hallazgos (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mejoras_continuas_hallazgo_id ON mejoras_continuas (hallazgo_id);
CREATE INDEX IF NOT EXISTS idx_no_conformidades_hallazgo_id ON no_conformidades (hallazgo_id);
