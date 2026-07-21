-- ============================================================
-- Migración 015 — Columnas faltantes en proveedores y evaluaciones
-- Agrega campos utilizados por el backend pero ausentes en la BD:
--   · proveedor_evaluaciones: debilidades, precio_mercado,
--     precio_proveedor, generada_con_ia
--   · proveedores: periodicidad_evaluacion, email
-- ============================================================

ALTER TABLE proveedor_evaluaciones
  ADD COLUMN IF NOT EXISTS debilidades TEXT,
  ADD COLUMN IF NOT EXISTS precio_mercado VARCHAR(50),
  ADD COLUMN IF NOT EXISTS precio_proveedor VARCHAR(50),
  ADD COLUMN IF NOT EXISTS generada_con_ia BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN proveedor_evaluaciones.debilidades IS 'Debilidades o comentarios cualitativos de la evaluación (opcionalmente generado con IA)';
COMMENT ON COLUMN proveedor_evaluaciones.precio_mercado IS 'Precio de referencia de mercado para comparativa (opcional)';
COMMENT ON COLUMN proveedor_evaluaciones.precio_proveedor IS 'Precio real cotizado por el proveedor (opcional)';
COMMENT ON COLUMN proveedor_evaluaciones.generada_con_ia IS 'Indica si la evaluación fue generada con asistencia de IA (Gemini)';

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS periodicidad_evaluacion VARCHAR(20) NOT NULL DEFAULT 'Anual',
  ADD COLUMN IF NOT EXISTS email VARCHAR(150);

COMMENT ON COLUMN proveedores.periodicidad_evaluacion IS 'Frecuencia de re-evaluación del proveedor (Semestral | Anual)';
COMMENT ON COLUMN proveedores.email IS 'Correo de contacto del proveedor';
