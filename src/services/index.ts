import { api, saveToken, clearToken } from './api'

// ── TIPOS COMPARTIDOS ──────────────────────────────────────

export interface Proceso {
  id: number; codigo: string; nombre: string
  objetivo?: string; entradas?: string; salidas?: string
  indicador_kpi?: string; responsable?: string
  tipo_id: number; tipo_nombre?: string; estado: string
}

export interface Riesgo {
  id: number; codigo: string; descripcion: string
  proceso_id?: number; proceso_nombre?: string
  probabilidad: number; impacto: number; nivel: number
  estado: 'CRITICO' | 'TRATAMIENTO' | 'MONITOREO'
  responsable?: string; tipo: 'Riesgo' | 'Oportunidad'
  /* §6.1 — persistidos desde la Matriz de Riesgos y Oportunidades */
  fuente?: 'PESTEL' | 'DOFA' | 'Recursos' | 'ACTIVIDAD'
  categoria?: string
  actividad_id?: string
  tratamiento?: string   // texto de "acciones" generado/editado para el riesgo
}

export interface Auditoria {
  id: number; codigo: string; programa_id?: number
  proceso_id?: number; proceso_nombre?: string
  fecha_inicio: string; duracion_dias: number
  auditor_lider?: string
  estado: 'Planificada' | 'En Ejecución' | 'Cerrada'
  hallazgos: number
}

export interface Hallazgo {
  id: number; codigo: string; auditoria_id: number; auditoria_codigo?: string
  tipo: string; descripcion: string; clausula?: string; estado: string
}

export interface NoConformidad {
  id: number; codigo: string; fecha: string; origen: string
  proceso_id?: number; proceso_nombre?: string
  descripcion: string; gravedad: string; estado: string
}

export interface AccionCorrectiva {
  id: number; codigo: string; nc_id: number; nc_codigo?: string
  metodo_analisis?: string; accion: string; responsable?: string
  fecha_fin?: string; estado: string; eficacia: string
}

export interface Documento {
  id: number; codigo: string; titulo: string; tipo: string
  proceso_id?: number; proceso_nombre?: string
  version: string; estado: string; archivo_url?: string; hash_sha256?: string
}

export interface Indicador {
  id: number; codigo: string; titulo: string
  proceso_id?: number; proceso_nombre?: string
  frecuencia: string; meta: string; activo: boolean
  ultima_medicion?: { valor: string; tendencia: string; estado: string; fecha: string }
}

export interface Proveedor {
  id: number; nit: string; razon: string; tipo?: string
  estado: 'Aprobado' | 'Condicional' | 'Suspendido'; prox_eval?: string
  ultima_evaluacion?: { total: number; fecha: string }
}

export interface PersonalItem {
  id: number; nombre: string; cargo?: string
  proceso_id?: number; proceso_nombre?: string
  ultima_evaluacion?: { brecha_pct: number; estado: string; fecha: string }
}

export interface PlanFormacion {
  id: number; tema: string; fecha?: string; estado: string
  asistentes_nombres?: string[]
}

// ── AUTH ───────────────────────────────────────────────────

export const authService = {
  login: async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: { nombre: string; rol: string } }>(
      '/api/auth/login', { email, password }
    )
    saveToken(data.token)
    return data.user
  },
  logout: () => clearToken(),
}

// ── RIESGOS ────────────────────────────────────────────────

export const riesgosService = {
  getAll:  ()                     => api.get<Riesgo[]>('/api/riesgos'),
  create:  (body: Partial<Riesgo>) => api.post<Riesgo>('/api/riesgos', body),
  update:  (id: number, body: Partial<Riesgo>) => api.put<Riesgo>(`/api/riesgos/${id}`, body),
  delete:  (id: number)           => api.delete<void>(`/api/riesgos/${id}`),
  /** Crea o actualiza (por `codigo`) un riesgo/oportunidad derivado de la
   *  Matriz de Riesgos y Oportunidades §6.1. */
  upsert:  (body: Partial<Riesgo>) => api.post<Riesgo>('/api/riesgos/upsert', body),
}

// ── AUDITORÍAS ─────────────────────────────────────────────

export const auditoriasService = {
  getProgramas:   ()                                  => api.get<any[]>('/api/auditorias/programas'),
  createPrograma: (body: any)                         => api.post<any>('/api/auditorias/programas', body),
  updatePrograma: (id: number, body: any)             => api.put<any>(`/api/auditorias/programas/${id}`, body),

  getAll:    ()                                       => api.get<Auditoria[]>('/api/auditorias'),
  create:    (body: Partial<Auditoria>)               => api.post<Auditoria>('/api/auditorias', body),
  update:    (id: number, body: Partial<Auditoria>)   => api.put<Auditoria>(`/api/auditorias/${id}`, body),

  getHallazgos:    ()                                 => api.get<Hallazgo[]>('/api/auditorias/hallazgos'),
  createHallazgo:  (body: Partial<Hallazgo>)          => api.post<Hallazgo>('/api/auditorias/hallazgos', body),
  updateHallazgo:  (id: number, body: Partial<Hallazgo>) => api.put<Hallazgo>(`/api/auditorias/hallazgos/${id}`, body),
}

// ── NC / AC ────────────────────────────────────────────────

export const ncAcService = {
  getNCs:      ()                                           => api.get<NoConformidad[]>('/api/nc-ac/no-conformidades'),
  createNC:    (body: Partial<NoConformidad>)               => api.post<NoConformidad>('/api/nc-ac/no-conformidades', body),
  updateNC:    (id: number, body: Partial<NoConformidad>)   => api.put<NoConformidad>(`/api/nc-ac/no-conformidades/${id}`, body),

  getACs:      ()                                               => api.get<AccionCorrectiva[]>('/api/nc-ac/acciones-correctivas'),
  createAC:    (body: Partial<AccionCorrectiva>)                => api.post<AccionCorrectiva>('/api/nc-ac/acciones-correctivas', body),
  updateAC:    (id: number, body: Partial<AccionCorrectiva>)    => api.put<AccionCorrectiva>(`/api/nc-ac/acciones-correctivas/${id}`, body),
}

// ── DOCUMENTOS ─────────────────────────────────────────────

export const documentosService = {
  getAll:      ()                                         => api.get<Documento[]>('/api/documentos'),
  getVersiones:(id: number)                               => api.get<any[]>(`/api/documentos/${id}/versiones`),
  create:      (body: Partial<Documento>)                 => api.post<Documento>('/api/documentos', body),
  update:      (id: number, body: Partial<Documento>)     => api.put<Documento>(`/api/documentos/${id}`, body),
}

// ── INDICADORES ────────────────────────────────────────────

export const indicadoresService = {
  getAll:          ()                                         => api.get<Indicador[]>('/api/indicadores'),
  create:          (body: Partial<Indicador>)                 => api.post<Indicador>('/api/indicadores', body),
  update:          (id: number, body: Partial<Indicador>)     => api.put<Indicador>(`/api/indicadores/${id}`, body),
  delete:          (id: number)                               => api.delete<void>(`/api/indicadores/${id}`),
  deleteAll:       ()                                         => api.delete<void>('/api/indicadores'),
  getMediciones:   (id: number)                               => api.get<any[]>(`/api/indicadores/${id}/mediciones`),
  addMedicion:     (id: number, body: any)                    => api.post<any>(`/api/indicadores/${id}/mediciones`, body),
}

// ── PROVEEDORES ────────────────────────────────────────────

export const proveedoresService = {
  getAll:          ()                                         => api.get<Proveedor[]>('/api/proveedores'),
  create:          (body: Partial<Proveedor>)                 => api.post<Proveedor>('/api/proveedores', body),
  update:          (id: number, body: Partial<Proveedor>)     => api.put<Proveedor>(`/api/proveedores/${id}`, body),
  getEvaluaciones: (id: number)                               => api.get<any[]>(`/api/proveedores/${id}/evaluaciones`),
  addEvaluacion:   (id: number, body: any)                    => api.post<any>(`/api/proveedores/${id}/evaluaciones`, body),
}

// ── PROCESOS ───────────────────────────────────────────────

export const procesosService = {
  getAll:      ()                                         => api.get<Proceso[]>('/api/procesos'),
  create:      (body: Partial<Proceso>)                   => api.post<Proceso>('/api/procesos', body),
  update:      (id: number, body: Partial<Proceso>)       => api.put<Proceso>(`/api/procesos/${id}`, body),
  getPestel:   ()                                         => api.get<any[]>('/api/procesos/pestel'),
  addPestel:   (body: any)                                => api.post<any>('/api/procesos/pestel', body),
  getDofa:     ()                                         => api.get<any[]>('/api/procesos/dofa'),
  addDofa:     (body: any)                                => api.post<any>('/api/procesos/dofa', body),
}

// ── COMPETENCIAS ───────────────────────────────────────────

export const competenciasService = {
  getPersonal:      ()                                        => api.get<PersonalItem[]>('/api/competencias/personal'),
  createPersonal:   (body: any)                               => api.post<PersonalItem>('/api/competencias/personal', body),
  addEvaluacion:    (body: any)                               => api.post<any>('/api/competencias/evaluaciones', body),
  getPlanFormacion: ()                                        => api.get<PlanFormacion[]>('/api/competencias/plan-formacion'),
  createPlan:       (body: any)                               => api.post<PlanFormacion>('/api/competencias/plan-formacion', body),
  updatePlan:       (id: number, body: any)                   => api.put<PlanFormacion>(`/api/competencias/plan-formacion/${id}`, body),
}

// ── POLÍTICA ───────────────────────────────────────────────

export const politicaService = {
  getAll:       ()           => api.get<any[]>('/api/politica'),
  create:       (body: any)  => api.post<any>('/api/politica', body),
  update:       (id: number, body: any) => api.put<any>(`/api/politica/${id}`, body),
  getLecturas:  ()           => api.get<any[]>('/api/politica/lecturas'),
  addLectura:   (body: any)  => api.post<any>('/api/politica/lecturas', body),
}

// ── ANÁLISIS IA — REVISIÓN POR LA DIRECCIÓN ────────────────
// Extiende revDireccionService con el método de análisis IA
 
// Reemplaza el bloque revDireccionService existente con este:
export const revDireccionService = {
  getAll:    ()                      => api.get<any[]>('/api/rev-direccion'),
  create:    (body: any)             => api.post<any>('/api/rev-direccion', body),
  update:    (id: number, body: any) => api.put<any>(`/api/rev-direccion/${id}`, body),
  analizar:  (payload: any)          => api.post<RevDireccionAnalisis>('/api/gemini/analizar-rev-direccion', payload),
}


// ── OBJETIVOS DE CALIDAD ───────────────────────────────────
 
export const objetivosCalidadService = {
  getAll:      ()                              => api.get<any[]>('/api/objetivos-calidad'),
  create:      (body: any)                     => api.post<any>('/api/objetivos-calidad', body),
  update:      (id: number, body: any)         => api.put<any>(`/api/objetivos-calidad/${id}`, body),
  delete:      (id: number)                    => api.delete<void>(`/api/objetivos-calidad/${id}`),
  addMedicion: (id: number, medicion: any)     => api.post<any>(`/api/objetivos-calidad/${id}/mediciones`, medicion),
}

export interface SalidaRevision {
  titulo:          string
  justificacion:   string
  prioridad:       'Alta' | 'Media' | 'Baja'
  requisitoFuente: string
}
 
export interface RevDireccionAnalisis {
  resumenEjecutivo:     string
  oportunidadesMejora:  SalidaRevision[]
  necesidadesCambioSGC: SalidaRevision[]
  necesidadesRecursos:  SalidaRevision[]
  conclusionGeneral:    string
}

// ── ENFOQUE AL CLIENTE — ENCUESTAS DE SATISFACCIÓN (IA, sin persistencia) ──

export interface PreguntaEncuesta {
  id:    string
  texto: string
  tipo:  'escala' | 'abierta'
}

export interface CategoriaEncuesta {
  categoria:    string
  descripcion?: string
  preguntas:    PreguntaEncuesta[]
}

export interface EncuestaGenerada {
  titulo:        string
  introduccion:  string
  categorias:    CategoriaEncuesta[]
}

export interface EncuestasSatisfaccion {
  clientes:    EncuestaGenerada
  proveedores: EncuestaGenerada
}

// ── ENFOQUE AL CLIENTE — ENCUESTAS DE SATISFACCIÓN (IA, sin persistencia) ──

export interface PreguntaEncuesta {
  id:    string
  texto: string
  tipo:  'escala' | 'abierta'
}

export interface CategoriaEncuesta {
  categoria:    string
  descripcion?: string
  preguntas:    PreguntaEncuesta[]
}

export interface EncuestaGenerada {
  titulo:        string
  introduccion:  string
  categorias:    CategoriaEncuesta[]
}

export interface EncuestasSatisfaccion {
  clientes:    EncuestaGenerada
  proveedores: EncuestaGenerada
}

export interface DofaEncuestaItem {
  tipo:        'Fortaleza' | 'Oportunidad' | 'Debilidad' | 'Amenaza'
  descripcion: string
}

export interface AnalisisEncuestasResult {
  resumenEjecutivo: string
  dofa:             DofaEncuestaItem[]
}

export const enfoqueClienteService = {
  generarEncuestas: (datosEmpresa: any) =>
    api.post<EncuestasSatisfaccion>('/api/gemini/generar-encuestas-satisfaccion', { datosEmpresa }),

  analizarEncuestas: (payload: {
    datosEmpresa: any
    resumenClientes: any
    resumenProveedores: any
    pqrs: { tipo: string; descripcion: string; estado: string }[]
  }) => api.post<AnalisisEncuestasResult>('/api/gemini/analizar-encuestas-cliente', payload),
}

// ── CONTEXTO EMPRESA (§4.1, §5.3, §7.1) ─────────────────────

export const contextoEmpresaService = {
  getDatos:      () => api.get<any | null>('/api/contexto-empresa/datos'),
  putDatos:      (body: any) => api.put<any>('/api/contexto-empresa/datos', body),
  deleteDatos:   () => api.delete<void>('/api/contexto-empresa/datos'),

  getMatrizRoles:        () => api.get<any[]>('/api/contexto-empresa/matriz-roles'),
  postMatrizRoles:       (filas: any[]) => api.post<any[]>('/api/contexto-empresa/matriz-roles', { filas }),
  putMatrizRolesFila:    (id: number, body: any) => api.put<any>(`/api/contexto-empresa/matriz-roles/${id}`, body),
  deleteMatrizRolesFila: (id: number) => api.delete<void>(`/api/contexto-empresa/matriz-roles/${id}`),

  getMatrizCargos:        () => api.get<any[]>('/api/contexto-empresa/matriz-cargos'),
  postMatrizCargos:       (filas: any[]) => api.post<any[]>('/api/contexto-empresa/matriz-cargos', { filas }),
  postMatrizCargosNueva:  (fila: any) => api.post<any>('/api/contexto-empresa/matriz-cargos/nueva', fila),
  putMatrizCargosFila:    (id: number, body: any) => api.put<any>(`/api/contexto-empresa/matriz-cargos/${id}`, body),
  deleteMatrizCargosFila: (id: number) => api.delete<void>(`/api/contexto-empresa/matriz-cargos/${id}`),

  getMatrizRecursos:     () => api.get<any[]>('/api/contexto-empresa/matriz-recursos'),
  postMatrizRecursos:    (filas: any[]) => api.post<any[]>('/api/contexto-empresa/matriz-recursos', { filas }),
  putMatrizRecursosFila: (id: number, body: any) => api.put<any>(`/api/contexto-empresa/matriz-recursos/${id}`, body),

  getActividades:   () => api.get<any[]>('/api/contexto-empresa/actividades'),
  postActividad:    (body: any) => api.post<any>('/api/contexto-empresa/actividades', body),
  deleteActividad:  (id: string) => api.delete<void>(`/api/contexto-empresa/actividades/${id}`),
}

// ── EVIDENCIAS Y EFICACIA DE RIESGOS (§6.1) ─────────────────

export const riesgoEvidenciasService = {
  getByCodigo:      (codigo: string) => api.get<any[]>(`/api/riesgo-evidencias/${codigo}`),
  create:           (body: any) => api.post<any>('/api/riesgo-evidencias', body),
  delete:           (id: number) => api.delete<void>(`/api/riesgo-evidencias/${id}`),
  getEficaciaTodos: () => api.get<any[]>('/api/riesgo-evidencias/eficacia/todos'),
  putEficacia:      (codigo: string, body: any) => api.put<any>(`/api/riesgo-evidencias/eficacia/${codigo}`, body),
}

// ── SUBIDA DE ARCHIVOS A BUCKET EXTERNO ─────────────────────

export interface UploadResult {
  url: string; key: string; nombre: string; tipoMime: string; tamanoBytes: number
}

export const uploadsService = {
  upload: async (file: File): Promise<UploadResult> => {
    const token = localStorage.getItem('governex_token')
    const BASE  = import.meta.env.VITE_API_URL || ''
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${BASE}/api/uploads`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al subir archivo' }))
      throw new Error(err.error)
    }
    return res.json()
  },
}

// ── ENFOQUE AL CLIENTE — PQRS, archivos y respuestas ────────

export const pqrsBackendService = {
  getAll: () => api.get<any[]>('/api/enfoque-cliente/pqrs'),
  create: (body: any) => api.post<any>('/api/enfoque-cliente/pqrs', body),
  update: (id: number, body: any) => api.put<any>(`/api/enfoque-cliente/pqrs/${id}`, body),
  delete: (id: number) => api.delete<void>(`/api/enfoque-cliente/pqrs/${id}`),
}

export const archivosEnfoqueService = {
  getAll: () => api.get<any[]>('/api/enfoque-cliente/archivos'),
  create: (body: any) => api.post<any>('/api/enfoque-cliente/archivos', body),
  delete: (id: number) => api.delete<void>(`/api/enfoque-cliente/archivos/${id}`),
}

export const respuestasEncuestaService = {
  getAll: () => api.get<any[]>('/api/enfoque-cliente/respuestas'),
  create: (body: any) => api.post<any>('/api/enfoque-cliente/respuestas', body),
}

// ── COMPRAS — fichas técnicas y evaluaciones ─────────────────

export interface FichaTecnicaCompraDB {
  id: number; nombre: string; descripcion?: string; especificaciones?: string
  unidad_medida?: string; cantidad_minima?: string
  documentos_requeridos: { nombre: string; url: string }[]
  responsable?: string; fecha_creacion: string
}

export const fichasTecnicasService = {
  getAll: () => api.get<FichaTecnicaCompraDB[]>('/api/compras/fichas-tecnicas'),
  create: (body: any) => api.post<FichaTecnicaCompraDB>('/api/compras/fichas-tecnicas', body),
  update: (id: number, body: any) => api.put<FichaTecnicaCompraDB>(`/api/compras/fichas-tecnicas/${id}`, body),
  delete: (id: number) => api.delete<void>(`/api/compras/fichas-tecnicas/${id}`),
}

export const evaluacionesOrdenCompraService = {
  getAll: () => api.get<any[]>('/api/compras/evaluaciones'),
  create: (body: any) => api.post<any>('/api/compras/evaluaciones', body),
  delete: (id: number) => api.delete<void>(`/api/compras/evaluaciones/${id}`),
}

// ── LIBERACIÓN DE PRODUCTOS Y SERVICIOS (§8.6) ──────────────
export interface LiberacionPS {
  id: number; codigo_op?: string; producto_servicio: string; cliente?: string
  criterios_aceptacion?: string; inspeccion_realizada?: string; resultados?: string
  autorizado_por?: string; fecha: string
  decision: 'Liberado' | 'Retenido' | 'Rechazado'; observaciones?: string
}
export const liberacionPSService = {
  getAll: () => api.get<LiberacionPS[]>('/api/liberacion-ps'),
  create: (body: any) => api.post<LiberacionPS>('/api/liberacion-ps', body),
  update: (id: number, body: any) => api.put<LiberacionPS>(`/api/liberacion-ps/${id}`, body),
  delete: (id: number) => api.delete<void>(`/api/liberacion-ps/${id}`),
}

// ── TOMA DE CONSCIENCIA (§7.3) ───────────────────────────────
export interface TomaConsciencia {
  id: number; colaborador: string; cargo?: string; proceso?: string; tema: string
  fecha?: string; modalidad: string; evidencia?: string
  estado: 'Pendiente' | 'Completado' | 'Vencido'
}
export const tomaConscienciaService = {
  getAll: () => api.get<TomaConsciencia[]>('/api/toma-consciencia'),
  create: (body: any) => api.post<TomaConsciencia>('/api/toma-consciencia', body),
  update: (id: number, body: any) => api.put<TomaConsciencia>(`/api/toma-consciencia/${id}`, body),
  delete: (id: number) => api.delete<void>(`/api/toma-consciencia/${id}`),
}

// ── COMUNICACIÓN (§7.4) ──────────────────────────────────────
export interface ComunicacionItem {
  id: number; que: string; cuando?: string; quien: string; a_quien?: string
  como?: string; tipo: 'Interna' | 'Externa'; estado: 'Activo' | 'Revisión' | 'Inactivo'
}
export const comunicacionService = {
  getAll: () => api.get<ComunicacionItem[]>('/api/comunicacion'),
  create: (body: any) => api.post<ComunicacionItem>('/api/comunicacion', body),
  update: (id: number, body: any) => api.put<ComunicacionItem>(`/api/comunicacion/${id}`, body),
  delete: (id: number) => api.delete<void>(`/api/comunicacion/${id}`),
}

// ── MEJORA CONTINUA (§10.3) ───────────────────────────────────
export interface MejoraContinuaItem {
  id: number; codigo: string; titulo: string; origen: string; proceso?: string
  descripcion?: string; beneficio_esperado?: string; responsable?: string
  fecha_inicio?: string; fecha_cierre?: string; avance_pct: number; estado: string
}
export const mejoraContinuaService = {
  getAll: () => api.get<MejoraContinuaItem[]>('/api/mejora-continua'),
  create: (body: any) => api.post<MejoraContinuaItem>('/api/mejora-continua', body),
  update: (id: number, body: any) => api.put<MejoraContinuaItem>(`/api/mejora-continua/${id}`, body),
  delete: (id: number) => api.delete<void>(`/api/mejora-continua/${id}`),
}

// ── CONTROL DE SALIDAS NO CONFORMES (§8.7) ───────────────────
export interface SalidaNCItem {
  id: number; codigo?: string; descripcion: string; proceso?: string
  detectado_en: string; disposicion: string; responsable?: string; fecha: string
  accion_tomada?: string; verificado_por?: string; estado: string
}
export const salidasNCService = {
  getAll: () => api.get<SalidaNCItem[]>('/api/salidas-nc'),
  create: (body: any) => api.post<SalidaNCItem>('/api/salidas-nc', body),
  update: (id: number, body: any) => api.put<SalidaNCItem>(`/api/salidas-nc/${id}`, body),
  delete: (id: number) => api.delete<void>(`/api/salidas-nc/${id}`),
}

// ── PRODUCCIÓN Y PROVISIÓN DEL SERVICIO (§8.5) ────────────────
export interface OrdenProduccionItem {
  id: number; codigo: string; producto_servicio: string; cliente?: string
  cantidad?: string; instruccion_trabajo?: string; equipos?: string
  responsable?: string; fecha_inicio?: string; fecha_entrega?: string
  etapa: string; conformidad: string
}
export const produccionService = {
  getAll: () => api.get<OrdenProduccionItem[]>('/api/produccion'),
  create: (body: any) => api.post<OrdenProduccionItem>('/api/produccion', body),
  update: (id: number, body: any) => api.put<OrdenProduccionItem>(`/api/produccion/${id}`, body),
  delete: (id: number) => api.delete<void>(`/api/produccion/${id}`),
}

// ── REQUERIMIENTOS PARA PRODUCTOS Y SERVICIOS (§8.2) ─────────
export interface RequerimientoPSItem {
  id: number; cliente: string; producto_servicio: string
  requisitos_cliente?: string; requisitos_legales?: string; requisitos_org?: string
  fecha_revision?: string; revisado_por?: string; estado: string
  ficha_tecnica_id?: string; generado_con_ia?: boolean   // ← agregado
}
export const requerimientosPSService = {
  getAll: () => api.get<RequerimientoPSItem[]>('/api/requerimientos-ps'),
  create: (body: any) => api.post<RequerimientoPSItem>('/api/requerimientos-ps', body),
  update: (id: number, body: any) => api.put<RequerimientoPSItem>(`/api/requerimientos-ps/${id}`, body),
  delete: (id: number) => api.delete<void>(`/api/requerimientos-ps/${id}`),
}

// ── DISEÑO Y DESARROLLO (§8.3) ────────────────────────────────
export interface ProyectoDisenoDB {
  id: number; nombre: string; cliente?: string; entradas?: string; salidas?: string
  responsable?: string; fecha_inicio?: string; fecha_entrega?: string
  etapa: string; estado: string
}
export const disenoDesarrolloService = {
  getAll: () => api.get<ProyectoDisenoDB[]>('/api/diseno-desarrollo'),
  create: (body: any) => api.post<ProyectoDisenoDB>('/api/diseno-desarrollo', body),
  update: (id: number, body: any) => api.put<ProyectoDisenoDB>(`/api/diseno-desarrollo/${id}`, body),
  delete: (id: number) => api.delete<void>(`/api/diseno-desarrollo/${id}`),
}

// ── ÓRDENES DE COMPRA (§8.4) ──────────────────────────────────
export interface OrdenCompraDB {
  id: number; proveedor_id?: number; proveedor: string; producto: string
  cantidad?: string; unidad?: string; precio_unit?: string; total?: string
  fecha_emision?: string; fecha_entrega?: string; requisitos?: string
  responsable?: string; estado: string; observaciones?: string
}
export const ordenesCompraService = {
  getAll: () => api.get<OrdenCompraDB[]>('/api/compras'),
  create: (body: any) => api.post<OrdenCompraDB>('/api/compras', body),
  update: (id: number, body: any) => api.put<OrdenCompraDB>(`/api/compras/${id}`, body),
  delete: (id: number) => api.delete<void>(`/api/compras/${id}`),
}

export interface FichaTecnicaPSDB {
  id: string; tipo: 'educativa' | 'general'; generada_con_ia: boolean
  cliente?: string; producto_servicio?: string; version: string
  fecha_elaboracion?: string; elaborado_por?: string; aprobado_por?: string
  estado: string; descripcion?: string; especificaciones_tecnicas?: string
  normas_aplicables?: string; condiciones_uso?: string
  area_asignatura?: string; objetivo_general?: string; competencias?: string
  unidades_curriculares: any[]; total_horas_semana: number; observaciones?: string
}

export const fichasTecnicasPSService = {
  getAll:  () => api.get<FichaTecnicaPSDB[]>('/api/requerimientos-ps/fichas-tecnicas'),
  create:  (body: any) => api.post<FichaTecnicaPSDB>('/api/requerimientos-ps/fichas-tecnicas', body),
  update:  (id: string, body: any) => api.put<FichaTecnicaPSDB>(`/api/requerimientos-ps/fichas-tecnicas/${id}`, body),
  delete:  (id: string) => api.delete<void>(`/api/requerimientos-ps/fichas-tecnicas/${id}`),
}

// ── PLANIFICACIÓN DE LOS CAMBIOS (§6.3) ─────────────────────
export const planificacionCambiosService = {
  getAll: () => api.get<any[]>('/api/planificacion-cambios'),
  create: (body: any) => api.post<any>('/api/planificacion-cambios', body),
  update: (id: number, body: any) => api.put<any>(`/api/planificacion-cambios/${id}`, body),
  delete: (id: number) => api.delete<void>(`/api/planificacion-cambios/${id}`),
}