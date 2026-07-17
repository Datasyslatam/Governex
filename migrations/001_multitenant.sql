-- ============================================================
--  GOVERNEX — Migración Multi-Tenant (fase 1)
--  Archivo: migrations/001_multitenant.sql
--  Ejecutar completo, dentro de UNA transacción, en este orden.
--  Requiere PostgreSQL. Idempotente donde es razonable (IF NOT EXISTS).
-- ============================================================

BEGIN;

-- ============================================================
-- PARTE 1: TABLA TENANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
	id SERIAL PRIMARY KEY,
	nombre VARCHAR(200) NOT NULL,
	nit VARCHAR(30) NOT NULL,
	estado VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Suspendido', 'Cancelado')),
	plan VARCHAR(30) NOT NULL DEFAULT 'Standard' CHECK (plan IN ('Standard', 'Pro', 'Enterprise')),
	fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tenants IS 'Empresas cliente de Governex. Cada fila es un Tenant aislado.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_nit ON tenants (nit);

-- Tenant inicial: representa la empresa que hoy usa Governex en producción (single-tenant).
-- Se reutiliza NOMBRE_EMPRESA de datos_empresa si existe; si no, un nombre por defecto.
DO $$
DECLARE
	v_nombre VARCHAR(200);
BEGIN
	IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = 1) THEN
		SELECT NOMBRE_EMPRESA INTO v_nombre FROM datos_empresa ORDER BY id LIMIT 1;
		INSERT INTO tenants (id, nombre, nit, estado, plan)
		VALUES (1, COALESCE(v_nombre, 'Empresa Inicial Governex'), 'PENDIENTE-ACTUALIZAR', 'Activo', 'Enterprise');
		-- Reinicia la secuencia para que el próximo tenant creado continúe después del 1
		PERFORM setval(pg_get_serial_sequence('tenants', 'id'), (SELECT MAX(id) FROM tenants));
	END IF;
END $$;

-- IMPORTANTE: actualizar manualmente tenants.nit y tenants.nombre con los datos reales
-- de la empresa antes de pasar a producción:
-- UPDATE tenants SET nombre = 'Nombre Real S.A.S.', nit = '900.xxx.xxx-x' WHERE id = 1;

-- ============================================================
-- PARTE 2: AGREGAR tenant_id A TABLAS CON UNIQUE GLOBAL
--  (se elimina el UNIQUE global y se reemplaza por UNIQUE compuesto)
-- ============================================================
-- ── usuarios ──────────────────────────────────────────
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE usuarios SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE usuarios ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant_id ON usuarios (tenant_id);

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_email_key;
ALTER TABLE usuarios ADD CONSTRAINT uq_usuarios_tenant_email UNIQUE (tenant_id, email);

-- ── procesos ──────────────────────────────────────────
ALTER TABLE procesos ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE procesos SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE procesos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE procesos ADD CONSTRAINT fk_procesos_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_procesos_tenant_id ON procesos (tenant_id);

ALTER TABLE procesos DROP CONSTRAINT IF EXISTS procesos_codigo_key;
ALTER TABLE procesos ADD CONSTRAINT uq_procesos_tenant_codigo UNIQUE (tenant_id, codigo);

-- ── tipos_proceso ──────────────────────────────────────────
ALTER TABLE tipos_proceso ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE tipos_proceso SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE tipos_proceso ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE tipos_proceso ADD CONSTRAINT fk_tipos_proceso_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_tipos_proceso_tenant_id ON tipos_proceso (tenant_id);

ALTER TABLE tipos_proceso DROP CONSTRAINT IF EXISTS tipos_proceso_nombre_key;
ALTER TABLE tipos_proceso ADD CONSTRAINT uq_tipos_proceso_tenant_nombre UNIQUE (tenant_id, nombre);

-- ── riesgos ──────────────────────────────────────────
ALTER TABLE riesgos ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE riesgos SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE riesgos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE riesgos ADD CONSTRAINT fk_riesgos_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_riesgos_tenant_id ON riesgos (tenant_id);

ALTER TABLE riesgos DROP CONSTRAINT IF EXISTS riesgos_codigo_key;
ALTER TABLE riesgos ADD CONSTRAINT uq_riesgos_tenant_codigo UNIQUE (tenant_id, codigo);

-- ── indicadores ──────────────────────────────────────────
ALTER TABLE indicadores ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE indicadores SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE indicadores ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE indicadores ADD CONSTRAINT fk_indicadores_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_indicadores_tenant_id ON indicadores (tenant_id);

ALTER TABLE indicadores DROP CONSTRAINT IF EXISTS indicadores_codigo_key;
ALTER TABLE indicadores ADD CONSTRAINT uq_indicadores_tenant_codigo UNIQUE (tenant_id, codigo);

-- ── documentos ──────────────────────────────────────────
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE documentos SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE documentos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE documentos ADD CONSTRAINT fk_documentos_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_documentos_tenant_id ON documentos (tenant_id);

ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_codigo_key;
ALTER TABLE documentos ADD CONSTRAINT uq_documentos_tenant_codigo UNIQUE (tenant_id, codigo);

-- ── proveedores ──────────────────────────────────────────
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE proveedores SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE proveedores ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE proveedores ADD CONSTRAINT fk_proveedores_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_proveedores_tenant_id ON proveedores (tenant_id);

ALTER TABLE proveedores DROP CONSTRAINT IF EXISTS proveedores_nit_key;
ALTER TABLE proveedores ADD CONSTRAINT uq_proveedores_tenant_nit UNIQUE (tenant_id, nit);

-- ── programas_auditoria ──────────────────────────────────────────
ALTER TABLE programas_auditoria ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE programas_auditoria SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE programas_auditoria ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE programas_auditoria ADD CONSTRAINT fk_programas_auditoria_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_programas_auditoria_tenant_id ON programas_auditoria (tenant_id);

ALTER TABLE programas_auditoria DROP CONSTRAINT IF EXISTS programas_auditoria_anio_key;
ALTER TABLE programas_auditoria ADD CONSTRAINT uq_programas_auditoria_tenant_anio UNIQUE (tenant_id, anio);

-- ── auditorias ──────────────────────────────────────────
ALTER TABLE auditorias ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE auditorias SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE auditorias ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE auditorias ADD CONSTRAINT fk_auditorias_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_auditorias_tenant_id ON auditorias (tenant_id);

ALTER TABLE auditorias DROP CONSTRAINT IF EXISTS auditorias_codigo_key;
ALTER TABLE auditorias ADD CONSTRAINT uq_auditorias_tenant_codigo UNIQUE (tenant_id, codigo);

-- ── hallazgos ──────────────────────────────────────────
ALTER TABLE hallazgos ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE hallazgos SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE hallazgos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE hallazgos ADD CONSTRAINT fk_hallazgos_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_hallazgos_tenant_id ON hallazgos (tenant_id);

ALTER TABLE hallazgos DROP CONSTRAINT IF EXISTS hallazgos_codigo_key;
ALTER TABLE hallazgos ADD CONSTRAINT uq_hallazgos_tenant_codigo UNIQUE (tenant_id, codigo);

-- ── no_conformidades ──────────────────────────────────────────
ALTER TABLE no_conformidades ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE no_conformidades SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE no_conformidades ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE no_conformidades ADD CONSTRAINT fk_no_conformidades_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_no_conformidades_tenant_id ON no_conformidades (tenant_id);

ALTER TABLE no_conformidades DROP CONSTRAINT IF EXISTS no_conformidades_codigo_key;
ALTER TABLE no_conformidades ADD CONSTRAINT uq_no_conformidades_tenant_codigo UNIQUE (tenant_id, codigo);

-- ── acciones_correctivas ──────────────────────────────────────────
ALTER TABLE acciones_correctivas ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE acciones_correctivas SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE acciones_correctivas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE acciones_correctivas ADD CONSTRAINT fk_acciones_correctivas_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_acciones_correctivas_tenant_id ON acciones_correctivas (tenant_id);

ALTER TABLE acciones_correctivas DROP CONSTRAINT IF EXISTS acciones_correctivas_codigo_key;
ALTER TABLE acciones_correctivas ADD CONSTRAINT uq_acciones_correctivas_tenant_codigo UNIQUE (tenant_id, codigo);

-- ── salidas_nc ──────────────────────────────────────────
ALTER TABLE salidas_nc ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE salidas_nc SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE salidas_nc ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE salidas_nc ADD CONSTRAINT fk_salidas_nc_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_salidas_nc_tenant_id ON salidas_nc (tenant_id);

ALTER TABLE salidas_nc DROP CONSTRAINT IF EXISTS salidas_nc_codigo_key;
ALTER TABLE salidas_nc ADD CONSTRAINT uq_salidas_nc_tenant_codigo UNIQUE (tenant_id, codigo);

-- ── mejoras_continuas ──────────────────────────────────────────
ALTER TABLE mejoras_continuas ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE mejoras_continuas SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE mejoras_continuas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE mejoras_continuas ADD CONSTRAINT fk_mejoras_continuas_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_mejoras_continuas_tenant_id ON mejoras_continuas (tenant_id);

ALTER TABLE mejoras_continuas DROP CONSTRAINT IF EXISTS mejoras_continuas_codigo_key;
ALTER TABLE mejoras_continuas ADD CONSTRAINT uq_mejoras_continuas_tenant_codigo UNIQUE (tenant_id, codigo);

-- ── objetivos_calidad ──────────────────────────────────────────
ALTER TABLE objetivos_calidad ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE objetivos_calidad SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE objetivos_calidad ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE objetivos_calidad ADD CONSTRAINT fk_objetivos_calidad_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_objetivos_calidad_tenant_id ON objetivos_calidad (tenant_id);

ALTER TABLE objetivos_calidad DROP CONSTRAINT IF EXISTS objetivos_calidad_codigo_key;
ALTER TABLE objetivos_calidad ADD CONSTRAINT uq_objetivos_calidad_tenant_codigo UNIQUE (tenant_id, codigo);

-- ── ordenes_produccion ──────────────────────────────────────────
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE ordenes_produccion SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE ordenes_produccion ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ordenes_produccion ADD CONSTRAINT fk_ordenes_produccion_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_ordenes_produccion_tenant_id ON ordenes_produccion (tenant_id);

ALTER TABLE ordenes_produccion DROP CONSTRAINT IF EXISTS ordenes_produccion_codigo_key;
ALTER TABLE ordenes_produccion ADD CONSTRAINT uq_ordenes_produccion_tenant_codigo UNIQUE (tenant_id, codigo);

-- ── planificacion_cambios ──────────────────────────────────────────
ALTER TABLE planificacion_cambios ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE planificacion_cambios SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE planificacion_cambios ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE planificacion_cambios ADD CONSTRAINT fk_planificacion_cambios_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_planificacion_cambios_tenant_id ON planificacion_cambios (tenant_id);

ALTER TABLE planificacion_cambios DROP CONSTRAINT IF EXISTS planificacion_cambios_codigo_key;
ALTER TABLE planificacion_cambios ADD CONSTRAINT uq_planificacion_cambios_tenant_codigo UNIQUE (tenant_id, codigo);

-- ============================================================
-- PARTE 3: AGREGAR tenant_id AL RESTO DE TABLAS DE NEGOCIO
-- ============================================================
-- ── pestel ──────────────────────────────────────────
ALTER TABLE pestel ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE pestel SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE pestel ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE pestel ADD CONSTRAINT fk_pestel_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_pestel_tenant_id ON pestel (tenant_id);


-- ── dofa ──────────────────────────────────────────
ALTER TABLE dofa ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE dofa SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE dofa ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE dofa ADD CONSTRAINT fk_dofa_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_dofa_tenant_id ON dofa (tenant_id);


-- ── politica_calidad ──────────────────────────────────────────
ALTER TABLE politica_calidad ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE politica_calidad SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE politica_calidad ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE politica_calidad ADD CONSTRAINT fk_politica_calidad_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_politica_calidad_tenant_id ON politica_calidad (tenant_id);


-- ── politica_lecturas ──────────────────────────────────────────
ALTER TABLE politica_lecturas ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE politica_lecturas SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE politica_lecturas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE politica_lecturas ADD CONSTRAINT fk_politica_lecturas_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_politica_lecturas_tenant_id ON politica_lecturas (tenant_id);


-- ── indicador_mediciones ──────────────────────────────────────────
ALTER TABLE indicador_mediciones ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE indicador_mediciones SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE indicador_mediciones ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE indicador_mediciones ADD CONSTRAINT fk_indicador_mediciones_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_indicador_mediciones_tenant_id ON indicador_mediciones (tenant_id);


-- ── documento_versiones ──────────────────────────────────────────
ALTER TABLE documento_versiones ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE documento_versiones SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE documento_versiones ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE documento_versiones ADD CONSTRAINT fk_documento_versiones_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_documento_versiones_tenant_id ON documento_versiones (tenant_id);


-- ── documento_aprobaciones ──────────────────────────────────────────
ALTER TABLE documento_aprobaciones ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE documento_aprobaciones SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE documento_aprobaciones ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE documento_aprobaciones ADD CONSTRAINT fk_documento_aprobaciones_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_documento_aprobaciones_tenant_id ON documento_aprobaciones (tenant_id);


-- ── personal ──────────────────────────────────────────
ALTER TABLE personal ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE personal SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE personal ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE personal ADD CONSTRAINT fk_personal_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_personal_tenant_id ON personal (tenant_id);


-- ── evaluaciones_competencia ──────────────────────────────────────────
ALTER TABLE evaluaciones_competencia ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE evaluaciones_competencia SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE evaluaciones_competencia ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE evaluaciones_competencia ADD CONSTRAINT fk_evaluaciones_competencia_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_evaluaciones_competencia_tenant_id ON evaluaciones_competencia (tenant_id);


-- ── plan_formacion ──────────────────────────────────────────
ALTER TABLE plan_formacion ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE plan_formacion SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE plan_formacion ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE plan_formacion ADD CONSTRAINT fk_plan_formacion_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_plan_formacion_tenant_id ON plan_formacion (tenant_id);


-- ── proveedor_evaluaciones ──────────────────────────────────────────
ALTER TABLE proveedor_evaluaciones ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE proveedor_evaluaciones SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE proveedor_evaluaciones ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE proveedor_evaluaciones ADD CONSTRAINT fk_proveedor_evaluaciones_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_proveedor_evaluaciones_tenant_id ON proveedor_evaluaciones (tenant_id);


-- ── rev_direccion ──────────────────────────────────────────
ALTER TABLE rev_direccion ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE rev_direccion SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE rev_direccion ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rev_direccion ADD CONSTRAINT fk_rev_direccion_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_rev_direccion_tenant_id ON rev_direccion (tenant_id);


-- ── objetivos_calidad_mediciones ──────────────────────────────────────────
ALTER TABLE objetivos_calidad_mediciones ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE objetivos_calidad_mediciones SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE objetivos_calidad_mediciones ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE objetivos_calidad_mediciones ADD CONSTRAINT fk_objetivos_calidad_mediciones_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_objetivos_calidad_mediciones_tenant_id ON objetivos_calidad_mediciones (tenant_id);


-- ── planes_operacion ──────────────────────────────────────────
ALTER TABLE planes_operacion ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE planes_operacion SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE planes_operacion ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE planes_operacion ADD CONSTRAINT fk_planes_operacion_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_planes_operacion_tenant_id ON planes_operacion (tenant_id);


-- ── requerimientos_ps ──────────────────────────────────────────
ALTER TABLE requerimientos_ps ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE requerimientos_ps SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE requerimientos_ps ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE requerimientos_ps ADD CONSTRAINT fk_requerimientos_ps_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_requerimientos_ps_tenant_id ON requerimientos_ps (tenant_id);


-- ── proyectos_diseno ──────────────────────────────────────────
ALTER TABLE proyectos_diseno ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE proyectos_diseno SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE proyectos_diseno ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE proyectos_diseno ADD CONSTRAINT fk_proyectos_diseno_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_proyectos_diseno_tenant_id ON proyectos_diseno (tenant_id);


-- ── ordenes_compra ──────────────────────────────────────────
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE ordenes_compra SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE ordenes_compra ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ordenes_compra ADD CONSTRAINT fk_ordenes_compra_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_tenant_id ON ordenes_compra (tenant_id);


-- ── liberaciones_ps ──────────────────────────────────────────
ALTER TABLE liberaciones_ps ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE liberaciones_ps SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE liberaciones_ps ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE liberaciones_ps ADD CONSTRAINT fk_liberaciones_ps_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_liberaciones_ps_tenant_id ON liberaciones_ps (tenant_id);


-- ── toma_consciencia ──────────────────────────────────────────
ALTER TABLE toma_consciencia ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE toma_consciencia SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE toma_consciencia ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE toma_consciencia ADD CONSTRAINT fk_toma_consciencia_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_toma_consciencia_tenant_id ON toma_consciencia (tenant_id);


-- ── comunicaciones ──────────────────────────────────────────
ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE comunicaciones SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE comunicaciones ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE comunicaciones ADD CONSTRAINT fk_comunicaciones_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_comunicaciones_tenant_id ON comunicaciones (tenant_id);


-- ── datos_empresa ──────────────────────────────────────────
ALTER TABLE datos_empresa ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE datos_empresa SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE datos_empresa ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE datos_empresa ADD CONSTRAINT fk_datos_empresa_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_datos_empresa_tenant_id ON datos_empresa (tenant_id);


-- ── matriz_roles ──────────────────────────────────────────
ALTER TABLE matriz_roles ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE matriz_roles SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE matriz_roles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE matriz_roles ADD CONSTRAINT fk_matriz_roles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_matriz_roles_tenant_id ON matriz_roles (tenant_id);


-- ── matriz_cargos ──────────────────────────────────────────
ALTER TABLE matriz_cargos ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE matriz_cargos SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE matriz_cargos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE matriz_cargos ADD CONSTRAINT fk_matriz_cargos_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_matriz_cargos_tenant_id ON matriz_cargos (tenant_id);


-- ── matriz_recursos ──────────────────────────────────────────
ALTER TABLE matriz_recursos ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE matriz_recursos SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE matriz_recursos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE matriz_recursos ADD CONSTRAINT fk_matriz_recursos_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_matriz_recursos_tenant_id ON matriz_recursos (tenant_id);


-- ── fichas_tecnicas_compra ──────────────────────────────────────────
ALTER TABLE fichas_tecnicas_compra ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE fichas_tecnicas_compra SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE fichas_tecnicas_compra ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE fichas_tecnicas_compra ADD CONSTRAINT fk_fichas_tecnicas_compra_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_fichas_tecnicas_compra_tenant_id ON fichas_tecnicas_compra (tenant_id);


-- ── evaluaciones_orden_compra ──────────────────────────────────────────
ALTER TABLE evaluaciones_orden_compra ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE evaluaciones_orden_compra SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE evaluaciones_orden_compra ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE evaluaciones_orden_compra ADD CONSTRAINT fk_evaluaciones_orden_compra_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_evaluaciones_orden_compra_tenant_id ON evaluaciones_orden_compra (tenant_id);


-- ── riesgo_evidencias ──────────────────────────────────────────
ALTER TABLE riesgo_evidencias ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE riesgo_evidencias SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE riesgo_evidencias ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE riesgo_evidencias ADD CONSTRAINT fk_riesgo_evidencias_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_riesgo_evidencias_tenant_id ON riesgo_evidencias (tenant_id);


-- ── pqrs_enfoque_cliente ──────────────────────────────────────────
ALTER TABLE pqrs_enfoque_cliente ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE pqrs_enfoque_cliente SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE pqrs_enfoque_cliente ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE pqrs_enfoque_cliente ADD CONSTRAINT fk_pqrs_enfoque_cliente_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_pqrs_enfoque_cliente_tenant_id ON pqrs_enfoque_cliente (tenant_id);


-- ── archivos_enfoque_cliente ──────────────────────────────────────────
ALTER TABLE archivos_enfoque_cliente ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE archivos_enfoque_cliente SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE archivos_enfoque_cliente ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE archivos_enfoque_cliente ADD CONSTRAINT fk_archivos_enfoque_cliente_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_archivos_enfoque_cliente_tenant_id ON archivos_enfoque_cliente (tenant_id);


-- ── respuestas_encuesta_satisfaccion ──────────────────────────────────────────
ALTER TABLE respuestas_encuesta_satisfaccion ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE respuestas_encuesta_satisfaccion SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE respuestas_encuesta_satisfaccion ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE respuestas_encuesta_satisfaccion ADD CONSTRAINT fk_respuestas_encuesta_satisfaccion_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_respuestas_encuesta_satisfaccion_tenant_id ON respuestas_encuesta_satisfaccion (tenant_id);


-- ============================================================
-- PARTE 4: TABLAS CON CLAVE PRIMARIA ESPECIAL (no id SERIAL)
-- ============================================================
-- formacion_asistentes: PK compuesta (plan_id, personal_id). Ambos ya
-- quedarán protegidos por el tenant_id de PLAN_FORMACION y PERSONAL, pero
-- se agrega tenant_id igual para permitir filtrar sin JOIN y por defensa en profundidad.

ALTER TABLE formacion_asistentes ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE formacion_asistentes SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE formacion_asistentes ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE formacion_asistentes ADD CONSTRAINT fk_formacion_asistentes_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_formacion_asistentes_tenant_id ON formacion_asistentes (tenant_id);


-- actividades_empresa: PK id VARCHAR(60) generado en frontend (timestamp+random).
-- Con múltiples tenants generando ids en paralelo la probabilidad de colisión
-- exacta es minúscula, pero para eliminarla del todo el índice único pasa a
-- ser compuesto (tenant_id, id) en vez de confiar solo en la PK global.

ALTER TABLE actividades_empresa ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE actividades_empresa SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE actividades_empresa ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE actividades_empresa ADD CONSTRAINT fk_actividades_empresa_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_actividades_empresa_tenant_id ON actividades_empresa (tenant_id);

ALTER TABLE actividades_empresa ADD CONSTRAINT uq_actividades_empresa_tenant_id UNIQUE (tenant_id, id);

-- fichas_tecnicas_ps: mismo caso que actividades_empresa (PK id VARCHAR(60), 'FT-timestamp').

ALTER TABLE fichas_tecnicas_ps ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE fichas_tecnicas_ps SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE fichas_tecnicas_ps ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE fichas_tecnicas_ps ADD CONSTRAINT fk_fichas_tecnicas_ps_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_fichas_tecnicas_ps_tenant_id ON fichas_tecnicas_ps (tenant_id);

ALTER TABLE fichas_tecnicas_ps ADD CONSTRAINT uq_fichas_tecnicas_ps_tenant_id UNIQUE (tenant_id, id);

-- riesgo_eficacia: PK actual es RIESGO_CODIGO (varchar), que NO es único entre
-- tenants (dos tenants pueden tener ambos un riesgo 'R-001'). Aquí SÍ hay que
-- re-clavar la tabla: la PK pasa a ser compuesta (tenant_id, riesgo_codigo).

ALTER TABLE riesgo_eficacia ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE riesgo_eficacia SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE riesgo_eficacia ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE riesgo_eficacia ADD CONSTRAINT fk_riesgo_eficacia_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;
ALTER TABLE riesgo_eficacia DROP CONSTRAINT IF EXISTS riesgo_eficacia_pkey;
ALTER TABLE riesgo_eficacia ADD CONSTRAINT riesgo_eficacia_pkey PRIMARY KEY (tenant_id, riesgo_codigo);

-- ============================================================
-- PARTE 5: ROLES — SE MANTIENE COMO CATÁLOGO GLOBAL (sin tenant_id)
-- ============================================================
-- Decisión: ROLES permanece global (Alta Dirección / Admin SGC / Usuario),
-- igual para todos los tenants. No se le agrega tenant_id.
-- Razón (ver justificación completa en el texto de la respuesta): los 3 roles
-- de Governex son roles de PLATAFORMA (qué tan alto es tu nivel de decisión en
-- el SGC), no conceptos propios de cada empresa; permitir que cada tenant edite
-- o duplique ese catálogo agrega complejidad de administración sin un requisito
-- de negocio que hoy la exija. La escalabilidad la aporta el nuevo modelo
-- PERMISOS / ROL_PERMISOS de abajo, no la duplicación del catálogo de roles.

-- Catálogo de permisos: recurso + acción (granularidad por módulo ISO 9001)
CREATE TABLE IF NOT EXISTS permisos (
	id SERIAL PRIMARY KEY,
	recurso VARCHAR(60) NOT NULL,   -- ej. 'procesos', 'riesgos', 'documentos', 'auditorias', 'no_conformidades', 'indicadores', 'proveedores', 'rev_direccion', 'competencias'
	accion VARCHAR(20) NOT NULL CHECK (accion IN ('leer', 'crear', 'editar', 'eliminar', 'aprobar')),
	CONSTRAINT uq_permisos_recurso_accion UNIQUE (recurso, accion)
);

COMMENT ON TABLE permisos IS 'Catálogo global de permisos (recurso + acción) disponibles en Governex.';

-- Asignación de permisos a roles (N:M). Global, igual que ROLES.
CREATE TABLE IF NOT EXISTS rol_permisos (
	rol_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
	permiso_id INTEGER NOT NULL REFERENCES permisos (id) ON DELETE CASCADE,
	PRIMARY KEY (rol_id, permiso_id)
);

COMMENT ON TABLE rol_permisos IS 'Matriz RBAC: qué puede hacer cada rol sobre cada recurso.';

-- Semilla de permisos por módulo (leer/crear/editar/eliminar; 'aprobar' solo en
-- los módulos donde existe un flujo de aprobación real: documentos, auditorías→hallazgos/NC, rev_direccion).
INSERT INTO permisos (recurso, accion)
SELECT r.recurso, a.accion
FROM (VALUES
	('procesos'), ('riesgos'), ('documentos'), ('auditorias'), ('no_conformidades'),
	('acciones_correctivas'), ('indicadores'), ('proveedores'), ('competencias'),
	('rev_direccion'), ('objetivos_calidad'), ('comunicaciones'), ('mejoras_continuas')
) AS r(recurso)
CROSS JOIN (VALUES ('leer'), ('crear'), ('editar'), ('eliminar')) AS a(accion)
ON CONFLICT DO NOTHING;

INSERT INTO permisos (recurso, accion) VALUES
	('documentos', 'aprobar'),
	('auditorias', 'aprobar'),
	('no_conformidades', 'aprobar'),
	('rev_direccion', 'aprobar')
ON CONFLICT DO NOTHING;

-- Asignación por defecto (ajustar según la política real de Governex):
-- 'Alta Dirección' (rol id 1 en el seed original) -> todo, incluye aprobar
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE NOMBRE = 'Alta Dirección'), p.id FROM permisos p
ON CONFLICT DO NOTHING;

-- 'Admin SGC' (rol id 2) -> todo excepto eliminar y aprobar rev_direccion
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE NOMBRE = 'Admin SGC'), p.id
FROM permisos p
WHERE NOT (p.accion = 'aprobar' AND p.recurso = 'rev_direccion')
ON CONFLICT DO NOTHING;

-- 'Usuario' (rol id 3) -> solo lectura y creación, sin editar/eliminar/aprobar
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE NOMBRE = 'Usuario'), p.id
FROM permisos p
WHERE p.accion IN ('leer', 'crear')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PARTE 6: ÍNDICES COMPUESTOS (tenant_id + filtro más usado)
--  tenant_id siempre va primero: es el filtro obligatorio en cada query.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_documentos_tenant_estado ON documentos (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_auditorias_tenant_estado ON auditorias (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_no_conformidades_tenant_estado ON no_conformidades (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_acciones_correctivas_tenant_estado ON acciones_correctivas (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_riesgos_tenant_nivel ON riesgos (tenant_id, nivel);
CREATE INDEX IF NOT EXISTS idx_riesgos_tenant_estado ON riesgos (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_indicadores_tenant_activo ON indicadores (tenant_id, activo);
CREATE INDEX IF NOT EXISTS idx_indicador_mediciones_tenant_fecha ON indicador_mediciones (tenant_id, fecha);
CREATE INDEX IF NOT EXISTS idx_proveedor_evaluaciones_tenant_fecha ON proveedor_evaluaciones (tenant_id, fecha);
CREATE INDEX IF NOT EXISTS idx_planes_operacion_tenant_estado ON planes_operacion (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_requerimientos_ps_tenant_estado ON requerimientos_ps (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_proyectos_diseno_tenant_etapa ON proyectos_diseno (tenant_id, etapa);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_tenant_estado ON ordenes_compra (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_produccion_tenant_etapa ON ordenes_produccion (tenant_id, etapa);
CREATE INDEX IF NOT EXISTS idx_liberaciones_ps_tenant_decision ON liberaciones_ps (tenant_id, decision);
CREATE INDEX IF NOT EXISTS idx_salidas_nc_tenant_estado ON salidas_nc (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_toma_consciencia_tenant_estado ON toma_consciencia (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_comunicaciones_tenant_tipo ON comunicaciones (tenant_id, tipo);
CREATE INDEX IF NOT EXISTS idx_mejoras_continuas_tenant_estado ON mejoras_continuas (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_objetivos_calidad_tenant_estado ON objetivos_calidad (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_planificacion_cambios_tenant_estado ON planificacion_cambios (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_pqrs_enfoque_cliente_tenant_estado ON pqrs_enfoque_cliente (tenant_id, estado);

-- Un índice único (tenant_id, email) ya cubre el login de USUARIOS (creado en Parte 2).

COMMIT;
