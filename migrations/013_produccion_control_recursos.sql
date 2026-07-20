-- ============================================================
--  MIGRACIÓN 013 — ISO 9001:2015 §8.5 Producción y Provisión
--  del Servicio: cierre de brechas de evidencia
--
--  Agrega a ORDENES_PRODUCCION los vínculos que exige el
--  requisito 8.5 y que antes solo existían como texto libre:
--    · ficha técnica del producto/servicio terminado (§8.5.1 a)
--    · instructivo de trabajo documentado    (§8.5.1 a)
--    · infraestructura y ambiente de operación (§8.5.1 c/d)
--    · personal asignado (competencia, §8.5.1 e / §7.2)
--    · seguimiento de postventa (§8.5.5 b)
--
--  Crea PUNTOS_CONTROL_PRODUCCION: el registro de seguimiento y
--  medición (§8.5.1 b) — la interfaz para ingresar los datos de
--  cada punto de control durante el proceso de transformación.
-- ============================================================

-- ── Vínculos y campos nuevos en ORDENES_PRODUCCION ──────────
ALTER TABLE ordenes_produccion
  ADD COLUMN IF NOT EXISTS ficha_tecnica_id VARCHAR(60)
    REFERENCES fichas_tecnicas_ps (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS documento_instructivo_id INTEGER
    REFERENCES documentos (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS infraestructura_ambiente TEXT,
  ADD COLUMN IF NOT EXISTS personal_asignado JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS seguimiento_postventa TEXT,
  ADD COLUMN IF NOT EXISTS fecha_postventa DATE;

COMMENT ON COLUMN ordenes_produccion.ficha_tecnica_id IS '§8.5.1 a) — ficha técnica del producto/servicio terminado (fichas_tecnicas_ps).';
COMMENT ON COLUMN ordenes_produccion.documento_instructivo_id IS '§8.5.1 a) — instructivo de trabajo documentado (documentos, tipo Instrucción).';
COMMENT ON COLUMN ordenes_produccion.infraestructura_ambiente IS '§8.5.1 c)/d) — infraestructura y ambiente apropiados para la transformación.';
COMMENT ON COLUMN ordenes_produccion.personal_asignado IS '§8.5.1 e) / §7.2 — array JSON [{id, nombre, cargo}] del personal competente asignado a la orden.';
COMMENT ON COLUMN ordenes_produccion.seguimiento_postventa IS '§8.5.5 b) — actividades de postventa (seguimiento posterior a la entrega).';

-- ── Puntos de control (seguimiento y medición) ──────────────
CREATE TABLE IF NOT EXISTS puntos_control_produccion (
  ID SERIAL PRIMARY KEY,
  ORDEN_PRODUCCION_ID INTEGER NOT NULL REFERENCES ordenes_produccion (ID) ON DELETE CASCADE,
  PUNTO_CONTROL VARCHAR(150) NOT NULL,
  PARAMETRO VARCHAR(150),
  CRITERIO_ACEPTACION TEXT,
  VALOR_MEDIDO VARCHAR(100),
  UNIDAD VARCHAR(30),
  INSTRUMENTO_MEDICION VARCHAR(150),
  RESULTADO VARCHAR(20) NOT NULL DEFAULT 'Pendiente' CHECK (
    RESULTADO IN ('Conforme', 'No conforme', 'Pendiente')
  ),
  RESPONSABLE VARCHAR(100),
  FECHA TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  OBSERVACIONES TEXT,
  REGISTRADO_POR INTEGER REFERENCES USUARIOS (ID),
  TENANT_ID INTEGER NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  CREADO_EN TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE puntos_control_produccion IS 'ISO 9001:2015 §8.5.1 b) — Seguimiento y medición durante la producción/prestación del servicio: puntos de control con criterios de aceptación, valor medido y resultado.';

CREATE INDEX IF NOT EXISTS idx_puntos_control_orden  ON puntos_control_produccion (orden_produccion_id);
CREATE INDEX IF NOT EXISTS idx_puntos_control_tenant ON puntos_control_produccion (tenant_id);
CREATE INDEX IF NOT EXISTS idx_puntos_control_result ON puntos_control_produccion (resultado);
