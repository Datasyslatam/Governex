-- ============================================================
--  Datos de prueba para tests/security.test.mjs
--  Se cargan sobre una BD NUEVA (ver tests/setup-db.sh). Ids altos (9000+)
--  para no chocar con los datos semilla de schema.sql.
--  Contraseña de todos los usuarios de prueba: Prueba123*  (solo pruebas)
-- ============================================================

INSERT INTO tenants (id, nombre, nit, estado) VALUES
  (9001, 'Empresa A (prueba)',          'T-9001', 'Activo'),
  (9002, 'Empresa B (prueba)',          'T-9002', 'Activo'),
  (9003, 'Empresa Suspendida (prueba)', 'T-9003', 'Suspendido');

-- roles: 1 = Superusuario, 3 = Operativo
INSERT INTO usuarios (id, nombre, email, password_hash, rol_id, tenant_id, tiene_permisos_personalizados) VALUES
  (90101, 'Super A',   'supera@a.test', '$2a$10$yF5qx.jxP2B5Bny8qRrP8ea2l8jOGya3OvPOHRv7o2PrvJMqD8ABy', 1, 9001, false),
  (90102, 'Oper A1',   'opa1@a.test',   '$2a$10$yF5qx.jxP2B5Bny8qRrP8ea2l8jOGya3OvPOHRv7o2PrvJMqD8ABy', 3, 9001, true),
  (90103, 'Oper A2',   'opa2@a.test',   '$2a$10$yF5qx.jxP2B5Bny8qRrP8ea2l8jOGya3OvPOHRv7o2PrvJMqD8ABy', 3, 9001, false),
  (90201, 'Super B',   'superb@b.test', '$2a$10$yF5qx.jxP2B5Bny8qRrP8ea2l8jOGya3OvPOHRv7o2PrvJMqD8ABy', 1, 9002, false),
  (90301, 'User Susp', 'susp@c.test',   '$2a$10$yF5qx.jxP2B5Bny8qRrP8ea2l8jOGya3OvPOHRv7o2PrvJMqD8ABy', 1, 9003, false);

-- Oper A1 tiene permisos personalizados: TODO sobre riesgos (incluye eliminar).
-- Oper A2 usa los permisos del rol Operativo (sin riesgos:eliminar).
INSERT INTO usuario_permisos (usuario_id, permiso_id)
  SELECT 90102, id FROM permisos WHERE recurso = 'riesgos';

INSERT INTO tipos_proceso (id, nombre, tenant_id) VALUES
  (9101, 'Estratégico', 9001),
  (9102, 'Estratégico', 9002);

INSERT INTO procesos (id, codigo, nombre, tipo_id, tenant_id) VALUES
  (9201, 'GX-A-01', 'Proceso de A',          9101, 9001),
  (9202, 'GX-B-01', 'SECRETO-B proceso',     9102, 9002);

-- Recursos de la empresa B. Todos llevan el marcador "SECRETO-B" para
-- detectar si aparecen en respuestas a la empresa A.
INSERT INTO riesgos (id, codigo, descripcion, probabilidad, impacto, proceso_id, tenant_id)
  VALUES (9301, 'R-B-01', 'SECRETO-B riesgo', 3, 3, 9202, 9002);
INSERT INTO indicadores (id, codigo, titulo, frecuencia, meta, proceso_id, tenant_id)
  VALUES (9302, 'I-B-01', 'SECRETO-B indicador', 'Mensual', '90', 9202, 9002);
INSERT INTO proveedores (id, nit, razon, tenant_id)
  VALUES (9303, 'NIT-B-01', 'SECRETO-B proveedor', 9002);
INSERT INTO comunicaciones (id, que, tenant_id)
  VALUES (9304, 'SECRETO-B comunicación', 9002);
INSERT INTO mejoras_continuas (id, codigo, titulo, origen, tenant_id)
  VALUES (9305, 'M-B-01', 'SECRETO-B mejora', 'Sugerencia', 9002);
INSERT INTO no_conformidades (id, codigo, origen, descripcion, gravedad, tenant_id)
  VALUES (9306, 'NC-B-01', 'Otro', 'SECRETO-B no conformidad', 'Menor', 9002);
INSERT INTO salidas_nc (id, codigo, descripcion, detectado_en, disposicion, tenant_id)
  VALUES (9307, 'S-B-01', 'SECRETO-B salida', 'Producción', 'Reparar', 9002);
INSERT INTO plan_formacion (id, tema, tenant_id)
  VALUES (9308, 'SECRETO-B plan de formación', 9002);

-- Archivo heredado (clave sin prefijo de empresa) registrado para la empresa A.
INSERT INTO registro_cargas_r2 (tenant_id, usuario_id, nombre_archivo, key_r2, mime_type, tamano_bytes)
  VALUES (9001, 90101, 'legado.pdf', 'legacy_flat_key.pdf', 'application/pdf', 10);
