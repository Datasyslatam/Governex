-- ============================================================
-- Migración 014 — §8.7 Control de las salidas no conformes
-- Añade el registro de:
--   a) comunicación / información al cliente
--   b) concesiones y autorizaciones de aceptación (quién autoriza)
--   c) una disposición de "Separar / Aislar" para la corrección
--      inicial (evitar el uso o entrega no intencionados)
-- ============================================================

ALTER TABLE SALIDAS_NC
	ADD COLUMN IF NOT EXISTS CLIENTE_INFORMADO BOOLEAN NOT NULL DEFAULT FALSE,
	ADD COLUMN IF NOT EXISTS FECHA_NOTIFICACION_CLIENTE DATE,
	ADD COLUMN IF NOT EXISTS CONCESION_OTORGADA BOOLEAN NOT NULL DEFAULT FALSE,
	ADD COLUMN IF NOT EXISTS CONCESION_AUTORIZADA_POR VARCHAR(100),
	ADD COLUMN IF NOT EXISTS FECHA_CONCESION DATE,
	ADD COLUMN IF NOT EXISTS OBSERVACIONES_CONCESION TEXT;

-- Ampliar el catálogo de disposición para incluir "Separar / Aislar"
ALTER TABLE SALIDAS_NC DROP CONSTRAINT IF EXISTS salidas_nc_disposicion_check;
ALTER TABLE SALIDAS_NC ADD CONSTRAINT salidas_nc_disposicion_check CHECK (
	DISPOSICION IN (
		'Separar / Aislar',
		'Reparar',
		'Reprocesar',
		'Concesión al cliente',
		'Devolver al proveedor',
		'Desechar'
	)
);

COMMENT ON COLUMN SALIDAS_NC.CLIENTE_INFORMADO IS '§8.7.2 — indica si se informó al cliente de la no conformidad';
COMMENT ON COLUMN SALIDAS_NC.CONCESION_OTORGADA IS '§8.7.1 c) — indica si se obtuvo concesión/autorización para aceptar la salida no conforme';
COMMENT ON COLUMN SALIDAS_NC.CONCESION_AUTORIZADA_POR IS 'Persona/rol que autorizó la concesión o la aceptación bajo desviación';
