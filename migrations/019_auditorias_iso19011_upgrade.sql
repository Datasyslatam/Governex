-- Migración 019: Ampliación de Auditorías y Programas según directrices ISO 19011:2018

-- 1. Ampliar programas_auditoria
ALTER TABLE programas_auditoria
  ADD COLUMN IF NOT EXISTS numero VARCHAR(50),
  ADD COLUMN IF NOT EXISTS alcance TEXT,
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(100) DEFAULT 'Auditoría Interna de Sistema de Gestión',
  ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(255),
  ADD COLUMN IF NOT EXISTS calendario TEXT,
  ADD COLUMN IF NOT EXISTS criterio TEXT,
  ADD COLUMN IF NOT EXISTS metodo TEXT,
  ADD COLUMN IF NOT EXISTS equipo_auditores TEXT,
  ADD COLUMN IF NOT EXISTS recursos TEXT,
  ADD COLUMN IF NOT EXISTS riesgos TEXT,
  ADD COLUMN IF NOT EXISTS tipo_informe VARCHAR(255);

-- 2. Ampliar auditorias
ALTER TABLE auditorias
  ADD COLUMN IF NOT EXISTS requisito_norma TEXT,
  ADD COLUMN IF NOT EXISTS auditado VARCHAR(255),
  ADD COLUMN IF NOT EXISTS observacion TEXT;
