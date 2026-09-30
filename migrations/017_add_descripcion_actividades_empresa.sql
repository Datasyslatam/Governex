-- Migración 017: Agregar columna descripcion a actividades_empresa
ALTER TABLE actividades_empresa ADD COLUMN IF NOT EXISTS descripcion TEXT;
COMMENT ON COLUMN actividades_empresa.descripcion IS 'Descripción detallada de la actividad de la empresa.';
