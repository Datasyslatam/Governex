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
  getAll: () => api.get<any[]>('/api/objetivos-calidad'),
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