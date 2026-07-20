import React, { createContext, useState, useContext, useEffect } from 'react'
import { contextoEmpresaService, procesosService, planificacionControlService } from '../services'
import { disenoDesarrolloService } from '../services'
import { useAuthContext } from './AuthContext'


/* ── Datos del formulario de empresa ─────────────────────────── */
export interface DatosEmpresa {
  nombreEmpresa:      string
  sector:             string
  tipoEmpresa:        string
  tamano:             string
  ubicacion:          string
  anoFundacion:       string
  mision:             string
  vision:             string
  politicaCalidad:    string
  productosServicios: string
  mercadoObjetivo:    string
  cantidadEmpleados:  string
  alcanceSGC:         string
  certificaciones:    string
  parteInteresadas:   string
  contextoNarrativo?: string
  pdfFormularioUrl?: string
  pdfFormularioNombre?: string
  organigramaUrl?: string
  organigramaNombre?: string
}

export interface PestelRow {
  factor:      string
  categoria:   string
  descripcion: string
  impacto:     'Alto' | 'Medio' | 'Bajo'
  oportunidad: boolean
}

export interface DofaRow {
  tipo:        'Fortaleza' | 'Oportunidad' | 'Debilidad' | 'Amenaza'
  descripcion: string
}

export interface CaracterizacionRow {
  codigo:      string
  proceso:     string
  objetivo:    string
  entradas:    string
  salidas:     string
  indicador:   string
  responsable: string
  estado:      string
}

export type TipoProceso = 'estrategico' | 'misional' | 'apoyo'

export interface FilaMatriz {
  id:          number
  proceso:     string
  tipo:        TipoProceso
  responsable: string
  autoridad:   string
  funciones:   string
  recursos:    string
  rendicion:   string
  clausula:    string
}

export interface FilaMatrizCargos {
  id:              number
  proceso:         string
  tipo:            TipoProceso
  actividades:     string[]
  responsable:     string
  funciones:       string
  clausula:        string
  clausulaDetalle: string
}

export interface FilaMatrizRecursos {
  proceso:             string
  nPersonas:           string
  infraestructura:     string
  hardwareSoftware:    string
  transporte:          string
  ambienteSocial:      string
  ambientePsicologico: string
  ambienteFisico:      string
  varSocial:           number
  varPsicologica:      number
  varFisica:           number
  calificacionPromedio:number
  nivelRiesgoVerde:    string
  accionRequerida:     string
  recursoEvaluado:     string
  hallazgo:            string
  riesgo:              string
  impacto:             string
  probabilidad:        string
  nivelRiesgoAzul:     string
  oportunidad:         string
  accion:              string
}

/* ── Actividades propias de la empresa (§4.1 / §8.1) ─────────── */
export interface EntradaSalida {
  id:    string
  valor: string
}

export interface ActividadEmpresa {
  id:           string
  nombre:       string
  proceso:      string
  responsable:  string
  objetivo:     string
  indicador:    string
  entradas:     EntradaSalida[]
  salidas:      EntradaSalida[]
  creadaEn:     string
}

export interface ProyectoDiseno {
  id:           string
  actividadId?: string
  entradas:     string
  desarrollo:   string
  control:      string
  responsable:  string
  fechaInicio:  string
  fechaEntrega: string
  etapa:        'Planificación' | 'Desarrollo' | 'Verificación' | 'Validación' | 'Completado'
  estado:       'En tiempo' | 'En riesgo' | 'Retrasado'
}

export interface FilaMapaDB {
  id:          number
  proceso:     string
  tipo:        TipoProceso
  responsable: string
  clausula:    string
  funciones:   string
}

export interface FilaManualDB {
  id:          number
  codigo:      string
  proceso:     string
  objetivo:    string
  entradas:    string
  salidas:     string
  indicador:   string
  responsable: string
  estado:      string
  clausula:    string
}

export interface AIAnalysis {
  pestel:                PestelRow[]
  dofa:                  DofaRow[]
  caracterizacion:       CaracterizacionRow[]
  matrizRoles?:          FilaMatriz[]
  matrizCargos?:         FilaMatrizCargos[]
  matrizRecursos?:       FilaMatrizRecursos[]
  indicadores?:          any[]
  nombreEmpresa?:        string
  sector?:               string
  datosEmpresa?:         DatosEmpresa
  mapaProcedimiento?:    FilaMapaDB[]
  manualProcedimiento?:  FilaManualDB[]
}

/* ── Tipos derivados §6.1 ────────────────────────────────────── */
export interface RiesgoDerivado {
  codigo:          string
  descripcion:     string
  tipo:            'Riesgo' | 'Oportunidad'
  fuente:          'PESTEL' | 'DOFA' | 'Recursos' | 'ACTIVIDAD'
  /** Categoría visible en la matriz — para actividades usa etiqueta "Actividad Propia" */
  categoria:       string
  /** Nombre completo de la actividad de origen (solo para fuente ACTIVIDAD) */
  actividadNombre?: string
  /** ID de la actividad de origen (solo para fuente ACTIVIDAD) */
  actividadId?:    string
  probabilidad:    number
  impacto:         number
  nivel:           number
  estado:          'CRITICO' | 'TRATAMIENTO' | 'MONITOREO'
  responsable:     string
  acciones:        string
}

export type FrecuenciaMedicion =
  | 'Mensual' | 'Bimestral' | 'Trimestral'
  | 'Cuatrimestral' | 'Semestral' | 'Anual'

export interface ObjetivoDerivado {
  codigo:                    string
  objetivo:                  string
  proceso_relacionado:       string
  fuente_riesgo_oportunidad: string
  tipo_fuente:               'Riesgo' | 'Oportunidad'
  accion:                    string
  responsable:               string
  recursos:                  string
  frecuencia_medicion:       FrecuenciaMedicion
  meta:                      string
  indicador:                 string
  fecha_inicio:              string
  fecha_fin:                 string
  estado:                    'Pendiente'
  mediciones:                []
  _riesgoCodigo:             string
  _riesgoNivel:              number
}

/* ── Context ─────────────────────────────────────────────────── */
interface AIAnalysisContextValue {
  analysis:        AIAnalysis | null
  datosEmpresa:    DatosEmpresa | null
  actividades:     ActividadEmpresa[]
  proyectosDiseno: ProyectoDiseno[]
  setAnalysis:     (a: AIAnalysis) => void
  setDatosEmpresa: (d: DatosEmpresa) => void
  setActividades:  (list: ActividadEmpresa[]) => void
  setProyectosDiseno: (list: ProyectoDiseno[]) => void
  addActividad:    (a: ActividadEmpresa) => void
  removeActividad: (id: string) => void
  addProyectoDiseno: (p: ProyectoDiseno) => void
  updateProyectoDiseno: (id: string, p: ProyectoDiseno) => void
  removeProyectoDiseno: (id: string) => void
  clearAnalysis:   () => void
  updateFilaMatrizRoles:  (id: number, patch: Partial<FilaMatriz>) => void
  addFilaMatrizRoles:     (fila: Omit<FilaMatriz, 'id'>) => void
  removeFilaMatrizRoles:  (id: number) => void

  updateFilaMatrizCargos: (id: number, patch: Partial<FilaMatrizCargos>) => void
  addFilaMatrizCargos:    (fila: Omit<FilaMatrizCargos, 'id'>) => void
  removeFilaMatrizCargos: (id: number) => void

  // Mapa y Manual de Procedimiento
  addFilaMapaProcedimiento:    (fila: Omit<FilaMapaDB, 'id'>) => void
  updateFilaMapaProcedimiento: (id: number, patch: Partial<FilaMapaDB>) => void
  removeFilaMapaProcedimiento: (id: number) => void
  addFilaManualProcedimiento:    (fila: Omit<FilaManualDB, 'id'>) => void
  updateFilaManualProcedimiento: (id: number, patch: Partial<FilaManualDB>) => void
  removeFilaManualProcedimiento: (id: number) => void
}

const AIAnalysisContext = createContext<AIAnalysisContextValue | undefined>(undefined)

export const AIAnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthContext()
  
  const [analysis, setAnalysisState] = useState<AIAnalysis | null>(() => {
    try { const s = sessionStorage.getItem('governex_ai_analysis'); return s ? JSON.parse(s) : null }
    catch { return null }
  })

  const [datosEmpresa, setDatosEmpresaState] = useState<DatosEmpresa | null>(() => {
    try { const s = sessionStorage.getItem('governex_datos_empresa'); return s ? JSON.parse(s) : null }
    catch { return null }
  })

  const [actividades, setActividadesState] = useState<ActividadEmpresa[]>(() => {
    try { const s = sessionStorage.getItem('governex_actividades'); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })

  const [proyectosDiseno, setProyectosDisenoState] = useState<ProyectoDiseno[]>(() => {
    try { const s = sessionStorage.getItem('governex_proyectos_diseno'); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })

  /* ── Mapeo snake_case (BD) → camelCase (frontend) ─────────── */
  const mapMatrizRoles = (rows: any[]): FilaMatriz[] => rows.map(r => ({
    id: r.id, proceso: r.proceso, tipo: r.tipo, responsable: r.responsable ?? '',
    autoridad: r.autoridad ?? '', funciones: r.funciones ?? '', recursos: r.recursos ?? '',
    rendicion: r.rendicion ?? '', clausula: r.clausula ?? '',
  }))

  const mapPestelDB = (rows: any[]): PestelRow[] => rows.map(r => ({
  factor: r.factor, categoria: r.categoria, descripcion: r.descripcion,
  impacto: r.impacto, oportunidad: !!r.oportunidad,
}))

const mapDofaDB = (rows: any[]): DofaRow[] => rows.map(r => ({
  tipo: r.tipo, descripcion: r.descripcion,
}))

const mapCaracterizacionDB = (rows: any[]): CaracterizacionRow[] => rows.map(r => ({
  codigo: r.codigo, proceso: r.nombre, objetivo: r.objetivo ?? '',
  entradas: r.entradas ?? '', salidas: r.salidas ?? '',
  indicador: r.indicador_kpi ?? '', responsable: r.responsable ?? '',
  estado: r.estado ?? 'Activo',
}))

  const mapMatrizCargos = (rows: any[]): FilaMatrizCargos[] => rows.map(r => ({
    id: r.id, proceso: r.proceso, tipo: r.tipo,
    actividades: Array.isArray(r.actividades) ? r.actividades : [],
    responsable: r.responsable ?? '', funciones: r.funciones ?? '',
    clausula: r.clausula ?? '', clausulaDetalle: r.clausula_detalle ?? '',
  }))

  const mapMatrizRecursos = (rows: any[]): FilaMatrizRecursos[] => rows.map(r => ({
    proceso: r.proceso, nPersonas: r.n_personas ?? '', infraestructura: r.infraestructura ?? '',
    hardwareSoftware: r.hardware_software ?? '', transporte: r.transporte ?? '',
    ambienteSocial: r.ambiente_social ?? '', ambientePsicologico: r.ambiente_psicologico ?? '',
    ambienteFisico: r.ambiente_fisico ?? '', varSocial: r.var_social ?? 0,
    varPsicologica: r.var_psicologica ?? 0, varFisica: r.var_fisica ?? 0,
    calificacionPromedio: Number(r.calificacion_promedio ?? 0), nivelRiesgoVerde: r.nivel_riesgo_verde ?? '',
    accionRequerida: r.accion_requerida ?? '', recursoEvaluado: r.recurso_evaluado ?? '',
    hallazgo: r.hallazgo ?? '', riesgo: r.riesgo ?? '', impacto: r.impacto ?? '',
    probabilidad: r.probabilidad ?? '', nivelRiesgoAzul: r.nivel_riesgo_azul ?? '',
    oportunidad: r.oportunidad ?? '', accion: r.accion ?? '',
  }))

  const mapDatosEmpresa = (r: any): DatosEmpresa => ({
    nombreEmpresa: r.nombre_empresa ?? '', sector: r.sector ?? '', tipoEmpresa: r.tipo_empresa ?? '',
    tamano: r.tamano ?? '', ubicacion: r.ubicacion ?? '', anoFundacion: r.ano_fundacion ?? '',
    mision: r.mision ?? '', vision: r.vision ?? '', politicaCalidad: r.politica_calidad ?? '',
    productosServicios: r.productos_servicios ?? '', mercadoObjetivo: r.mercado_objetivo ?? '',
    cantidadEmpleados: r.cantidad_empleados ?? '', alcanceSGC: r.alcance_sgc ?? '',
    certificaciones: r.certificaciones ?? '', parteInteresadas: r.parte_interesadas ?? '',
    contextoNarrativo: r.contexto_narrativo ?? '', pdfFormularioUrl:     r.pdf_formulario_url    ?? '',
    pdfFormularioNombre:  r.pdf_formulario_nombre ?? '',
    organigramaUrl:       r.organigrama_url       ?? '',organigramaNombre:    r.organigrama_nombre    ?? '',
  })

  const mapActividades = (rows: any[]): ActividadEmpresa[] => rows.map(r => ({
    id: r.id, nombre: r.nombre, proceso: r.proceso ?? '', responsable: r.responsable ?? '',
    objetivo: r.objetivo ?? '', indicador: r.indicador ?? '',
    entradas: Array.isArray(r.entradas) ? r.entradas : [],
    salidas: Array.isArray(r.salidas) ? r.salidas : [],
    creadaEn: r.creada_en,
  }))

  /* ── Mapeo BD → FilaMapaDB / FilaManualDB ─────────────────── */
  const mapMapaDB = (rows: any[]): FilaMapaDB[] => rows.map(r => ({
    id: r.id, proceso: r.proceso, tipo: r.tipo as TipoProceso,
    responsable: r.responsable ?? '', clausula: r.clausula ?? '',
    funciones: r.funciones ?? '',
  }))

  const mapManualDB = (rows: any[]): FilaManualDB[] => rows.map(r => ({
    id: r.id, codigo: r.codigo ?? '', proceso: r.proceso,
    objetivo: r.objetivo ?? '', entradas: r.entradas ?? '',
    salidas: r.salidas ?? '', indicador: r.indicador ?? '',
    responsable: r.responsable ?? '', estado: r.estado ?? 'Activo',
    clausula: r.clausula ?? '',
  }))

  /* ── Carga inicial desde la API (sessionStorage solo es fallback mientras carga) ── */
  useEffect(() => {
    if (!isAuthenticated) return
    (async () => {
      try {
        // 1. Agregamos la nueva petición al Promise.all con un .catch(() => []) integrado 
        // para evitar que si falla esta petición en específico, se caigan las demás.
        const [datos, roles, cargos, recursos, acts, projs, pestelRows, dofaRows, procesosRows, mapaRows, manualRows] = await Promise.all([
          contextoEmpresaService.getDatos(),
          contextoEmpresaService.getMatrizRoles(),
          contextoEmpresaService.getMatrizCargos(),
          contextoEmpresaService.getMatrizRecursos(),
          contextoEmpresaService.getActividades(),
          disenoDesarrolloService.getAll().catch(() => []),
          procesosService.getPestel().catch(() => []),
          procesosService.getDofa().catch(() => []),
          procesosService.getAll().catch(() => []),
          planificacionControlService.getMapaProcedimiento().catch(() => []),
          planificacionControlService.getManualProcedimiento().catch(() => []),
        ])
        
        // datosEmpresa: BD manda siempre, incluso si está vacía (null)
        if (datos) {
          const mapped = mapDatosEmpresa(datos)
          setDatosEmpresaState(mapped)
          sessionStorage.setItem('governex_datos_empresa', JSON.stringify(mapped))
        } else {
          setDatosEmpresaState(null)
          sessionStorage.removeItem('governex_datos_empresa')
        }

        // analysis: BD manda siempre, sin condicionar al length  
        setAnalysisState(prev => {
          const merged: AIAnalysis = {
            pestel:               mapPestelDB(pestelRows),
            dofa:                 mapDofaDB(dofaRows),
            caracterizacion:      mapCaracterizacionDB(procesosRows),
            matrizRoles:          mapMatrizRoles(roles),
            matrizCargos:         mapMatrizCargos(cargos),
            matrizRecursos:       mapMatrizRecursos(recursos),
            indicadores:          prev?.indicadores,
            nombreEmpresa:        prev?.nombreEmpresa,
            sector:               prev?.sector,
            datosEmpresa:         prev?.datosEmpresa,
            mapaProcedimiento:    mapMapaDB(mapaRows),
            manualProcedimiento:  mapManualDB(manualRows),
          }
          sessionStorage.setItem('governex_ai_analysis', JSON.stringify(merged))
          return merged
        })

        if (acts.length) {
          const mapped = mapActividades(acts)
          setActividadesState(mapped)
          sessionStorage.setItem('governex_actividades', JSON.stringify(mapped))
        }

        // 2. Insertamos la lógica de mapeo y persistencia para los proyectos de diseño
        if (projs && projs.length) {
          const mapped: ProyectoDiseno[] = projs.map((r: any) => ({
            id: String(r.id), 
            actividadId: r.actividad_id ?? undefined, // <-- Incluido control y actividadId
            entradas: r.entradas ?? '',
            desarrollo: r.nombre, 
            control: r.control ?? '',                  // <-- Incluido control y actividadId
            responsable: r.responsable ?? '',
            fechaInicio: r.fecha_inicio ?? '', 
            fechaEntrega: r.fecha_entrega ?? '',
            etapa: r.etapa, 
            estado: r.estado,
          }))
          setProyectosDisenoState(mapped)
          sessionStorage.setItem('governex_proyectos_diseno', JSON.stringify(mapped))
        }

      } catch (e) {
        console.warn('[AIAnalysisContext] No se pudo cargar contexto desde la API, usando caché local.', e)
      }
    })()
  }, [isAuthenticated])

  /* ── setAnalysis: guarda local + sincroniza matrices con la API ── */
  const setAnalysis = (a: AIAnalysis) => {
    setAnalysisState(a)
    try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(a)) } catch {}

    if (a.matrizRoles?.length) {
      contextoEmpresaService.postMatrizRoles(a.matrizRoles).catch(e =>
        console.warn('No se pudo guardar matrizRoles en BD:', e))
    }
    if (a.matrizCargos?.length) {
      contextoEmpresaService.postMatrizCargos(a.matrizCargos).catch(e =>
        console.warn('No se pudo guardar matrizCargos en BD:', e))
    }
    if (a.matrizRecursos?.length) {
      contextoEmpresaService.postMatrizRecursos(a.matrizRecursos).catch(e =>
        console.warn('No se pudo guardar matrizRecursos en BD:', e))
    }
    // Sincronizar Mapa y Manual de Procedimiento con la BD tras análisis IA
    if (a.matrizRoles?.length) {
      const mapaFilas = a.matrizRoles.map(f => ({
        proceso: f.proceso, tipo: f.tipo, responsable: f.responsable,
        clausula: f.clausula, funciones: f.funciones,
      }))
      planificacionControlService.postMapaProcedimiento(mapaFilas)
        .then(saved => {
          setAnalysisState(prev => {
            if (!prev) return prev
            const next = { ...prev, mapaProcedimiento: mapMapaDB(saved) }
            try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
            return next
          })
        })
        .catch(e => console.warn('No se pudo guardar mapa de procedimiento en BD:', e))
    }
    if (a.caracterizacion?.length) {
      const manualFilas = a.caracterizacion.map(r => ({
        codigo: r.codigo, proceso: r.proceso, objetivo: r.objetivo,
        entradas: r.entradas, salidas: r.salidas, indicador: r.indicador,
        responsable: r.responsable, estado: r.estado, clausula: '',
      }))
      planificacionControlService.postManualProcedimiento(manualFilas)
        .then(saved => {
          setAnalysisState(prev => {
            if (!prev) return prev
            const next = { ...prev, manualProcedimiento: mapManualDB(saved) }
            try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
            return next
          })
        })
        .catch(e => console.warn('No se pudo guardar manual de procedimiento en BD:', e))
    }
  }

  /* ── setDatosEmpresa: guarda local + PUT a la API ── */
  const setDatosEmpresa = (d: DatosEmpresa) => {
    setDatosEmpresaState(d)
    try { sessionStorage.setItem('governex_datos_empresa', JSON.stringify(d)) } catch {}
    contextoEmpresaService.putDatos(d).catch(e =>
      console.warn('No se pudo guardar datosEmpresa en BD:', e))
  }

  /* ── setActividades: guarda local (uso interno de addActividad/removeActividad) ── */
  const setActividades = (list: ActividadEmpresa[]) => {
    setActividadesState(list)
    try { sessionStorage.setItem('governex_actividades', JSON.stringify(list)) } catch {}
  }

  const setProyectosDiseno = (value: ProyectoDiseno[] | ((prev: ProyectoDiseno[]) => ProyectoDiseno[])) => {
    setProyectosDisenoState(prev => {
      const newList = typeof value === 'function' ? value(prev) : value
      try { sessionStorage.setItem('governex_proyectos_diseno', JSON.stringify(newList)) } catch {}
      return newList
    })
  }

  /* ── addActividad / removeActividad: ahora persisten en BD ── */
  const addActividad = (a: ActividadEmpresa) => {
    setActividades([...actividades, a])
    contextoEmpresaService.postActividad(a).catch(e =>
      console.warn('No se pudo guardar actividad en BD:', e))
  }

  const removeActividad = (id: string) => {
    setActividades(actividades.filter(a => a.id !== id))
    contextoEmpresaService.deleteActividad(id).catch(e =>
      console.warn('No se pudo eliminar actividad en BD:', e))
  }

  const addProyectoDiseno = (p: ProyectoDiseno) => {
    setProyectosDiseno(prev => [...prev, p])
    disenoDesarrolloService.create({
      nombre: p.desarrollo, cliente: undefined, entradas: p.entradas, salidas: undefined,
      responsable: p.responsable, fecha_inicio: p.fechaInicio, fecha_entrega: p.fechaEntrega,
      etapa: p.etapa, estado: p.estado, control: p.control, actividad_id: p.actividadId,
    }).then(saved => {
      setProyectosDiseno(prev => prev.map(x => x.id === p.id ? { ...x, id: String(saved.id) } : x))
    }).catch(e => console.warn('No se pudo guardar proyecto de diseño en BD:', e))
  }

  const updateProyectoDiseno = (id: string, p: ProyectoDiseno) => {
    setProyectosDiseno(prev => prev.map(x => x.id === id ? p : x))
    if (!isNaN(Number(id))) {
      disenoDesarrolloService.update(Number(id), {
        nombre: p.desarrollo, entradas: p.entradas, responsable: p.responsable,
        fecha_inicio: p.fechaInicio, fecha_entrega: p.fechaEntrega, etapa: p.etapa, estado: p.estado,
        control: p.control, actividad_id: p.actividadId,
      }).catch(e => console.warn('No se pudo actualizar proyecto de diseño en BD:', e))
    }
  }

  const removeProyectoDiseno = (id: string) => {
    setProyectosDiseno(prev => prev.filter(x => x.id !== id))
    if (!isNaN(Number(id))) {
      disenoDesarrolloService.delete(Number(id)).catch(() => {})
    }
  }

  const clearAnalysis = () => {
    setAnalysisState(null); setDatosEmpresaState(null); setActividadesState([]); setProyectosDisenoState([])
    try {
      sessionStorage.removeItem('governex_ai_analysis')
      sessionStorage.removeItem('governex_datos_empresa')
      sessionStorage.removeItem('governex_actividades')
      sessionStorage.removeItem('governex_proyectos_diseno')
    } catch {}
    contextoEmpresaService.deleteDatos().catch(() => {})
  }

  /* ── Matriz de Roles: edición granular por fila, persistida en BD ── */
const updateFilaMatrizRoles = (id: number, patch: Partial<FilaMatriz>) => {
  const prevAnalysis = analysis
  const filaActual = analysis?.matrizRoles?.find(f => f.id === id)
  if (!filaActual) return

  setAnalysisState(prev => {
    if (!prev) return prev
    const next = { ...prev, matrizRoles: (prev.matrizRoles || []).map(f => f.id === id ? { ...f, ...patch } : f) }
    try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
    return next
  })

  contextoEmpresaService.putMatrizRolesFila(id, { ...filaActual, ...patch }).catch(e => {
    console.warn('No se pudo actualizar fila de matrizRoles en BD:', e)
    setAnalysisState(prevAnalysis)
    try { if (prevAnalysis) sessionStorage.setItem('governex_ai_analysis', JSON.stringify(prevAnalysis)) } catch {}
  })
}

const addFilaMatrizRoles = (fila: Omit<FilaMatriz, 'id'>) => {
  contextoEmpresaService.postMatrizRolesNueva(fila).then(saved => {
    const nueva = mapMatrizRoles([saved])[0]
    setAnalysisState(prev => {
      const base: AIAnalysis = prev ?? { pestel: [], dofa: [], caracterizacion: [] }
      const next = { ...base, matrizRoles: [...(base.matrizRoles || []), nueva] }
      try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
      return next
    })
  }).catch(e => console.warn('No se pudo crear fila de matrizRoles en BD:', e))
}

const removeFilaMatrizRoles = (id: number) => {
  const prevAnalysis = analysis
  setAnalysisState(prev => {
    if (!prev) return prev
    const next = { ...prev, matrizRoles: (prev.matrizRoles || []).filter(f => f.id !== id) }
    try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
    return next
  })
  contextoEmpresaService.deleteMatrizRolesFila(id).catch(e => {
    console.warn('No se pudo eliminar fila de matrizRoles en BD:', e)
    setAnalysisState(prevAnalysis)
    try { if (prevAnalysis) sessionStorage.setItem('governex_ai_analysis', JSON.stringify(prevAnalysis)) } catch {}
  })
}

/* ── Matriz de Cargos: mismo patrón ── */
const updateFilaMatrizCargos = (id: number, patch: Partial<FilaMatrizCargos>) => {
  const prevAnalysis = analysis
  const filaActual = analysis?.matrizCargos?.find(f => f.id === id)
  if (!filaActual) return

  setAnalysisState(prev => {
    if (!prev) return prev
    const next = { ...prev, matrizCargos: (prev.matrizCargos || []).map(f => f.id === id ? { ...f, ...patch } : f) }
    try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
    return next
  })

  contextoEmpresaService.putMatrizCargosFila(id, { ...filaActual, ...patch }).catch(e => {
    console.warn('No se pudo actualizar fila de matrizCargos en BD:', e)
    setAnalysisState(prevAnalysis)
    try { if (prevAnalysis) sessionStorage.setItem('governex_ai_analysis', JSON.stringify(prevAnalysis)) } catch {}
  })
}

const addFilaMatrizCargos = (fila: Omit<FilaMatrizCargos, 'id'>) => {
  contextoEmpresaService.postMatrizCargosNueva(fila).then(saved => {
    const nueva = mapMatrizCargos([saved])[0]
    setAnalysisState(prev => {
      const base: AIAnalysis = prev ?? { pestel: [], dofa: [], caracterizacion: [] }
      const next = { ...base, matrizCargos: [...(base.matrizCargos || []), nueva] }
      try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
      return next
    })
  }).catch(e => console.warn('No se pudo crear fila de matrizCargos en BD:', e))
}

const removeFilaMatrizCargos = (id: number) => {
  const prevAnalysis = analysis
  setAnalysisState(prev => {
    if (!prev) return prev
    const next = { ...prev, matrizCargos: (prev.matrizCargos || []).filter(f => f.id !== id) }
    try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
    return next
  })
  contextoEmpresaService.deleteMatrizCargosFila(id).catch(e => {
    console.warn('No se pudo eliminar fila de matrizCargos en BD:', e)
    setAnalysisState(prevAnalysis)
    try { if (prevAnalysis) sessionStorage.setItem('governex_ai_analysis', JSON.stringify(prevAnalysis)) } catch {}
  })
}

  /* ── Mapa de Procedimiento: CRUD granular persistido en BD ──── */
  const addFilaMapaProcedimiento = (fila: Omit<FilaMapaDB, 'id'>) => {
    planificacionControlService.postMapaNueva(fila).then(saved => {
      const nueva = mapMapaDB([saved])[0]
      setAnalysisState(prev => {
        const base: AIAnalysis = prev ?? { pestel: [], dofa: [], caracterizacion: [] }
        const next = { ...base, mapaProcedimiento: [...(base.mapaProcedimiento || []), nueva] }
        try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
        return next
      })
    }).catch(e => console.warn('No se pudo crear fila de mapa de procedimiento en BD:', e))
  }

  const updateFilaMapaProcedimiento = (id: number, patch: Partial<FilaMapaDB>) => {
    const filaActual = analysis?.mapaProcedimiento?.find(f => f.id === id)
    if (!filaActual) return
    const updated = { ...filaActual, ...patch }
    setAnalysisState(prev => {
      if (!prev) return prev
      const next = { ...prev, mapaProcedimiento: (prev.mapaProcedimiento || []).map(f => f.id === id ? updated : f) }
      try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
      return next
    })
    planificacionControlService.putMapaFila(id, updated)
      .catch(e => console.warn('No se pudo actualizar fila de mapa de procedimiento en BD:', e))
  }

  const removeFilaMapaProcedimiento = (id: number) => {
    setAnalysisState(prev => {
      if (!prev) return prev
      const next = { ...prev, mapaProcedimiento: (prev.mapaProcedimiento || []).filter(f => f.id !== id) }
      try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
      return next
    })
    planificacionControlService.deleteMapaFila(id)
      .catch(e => console.warn('No se pudo eliminar fila de mapa de procedimiento en BD:', e))
  }

  /* ── Manual de Procedimiento: CRUD granular persistido en BD ── */
  const addFilaManualProcedimiento = (fila: Omit<FilaManualDB, 'id'>) => {
    planificacionControlService.postManualNueva(fila).then(saved => {
      const nueva = mapManualDB([saved])[0]
      setAnalysisState(prev => {
        const base: AIAnalysis = prev ?? { pestel: [], dofa: [], caracterizacion: [] }
        const next = { ...base, manualProcedimiento: [...(base.manualProcedimiento || []), nueva] }
        try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
        return next
      })
    }).catch(e => console.warn('No se pudo crear fila de manual de procedimiento en BD:', e))
  }

  const updateFilaManualProcedimiento = (id: number, patch: Partial<FilaManualDB>) => {
    const filaActual = analysis?.manualProcedimiento?.find(f => f.id === id)
    if (!filaActual) return
    const updated = { ...filaActual, ...patch }
    setAnalysisState(prev => {
      if (!prev) return prev
      const next = { ...prev, manualProcedimiento: (prev.manualProcedimiento || []).map(f => f.id === id ? updated : f) }
      try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
      return next
    })
    planificacionControlService.putManualFila(id, updated)
      .catch(e => console.warn('No se pudo actualizar fila de manual de procedimiento en BD:', e))
  }

  const removeFilaManualProcedimiento = (id: number) => {
    setAnalysisState(prev => {
      if (!prev) return prev
      const next = { ...prev, manualProcedimiento: (prev.manualProcedimiento || []).filter(f => f.id !== id) }
      try { sessionStorage.setItem('governex_ai_analysis', JSON.stringify(next)) } catch {}
      return next
    })
    planificacionControlService.deleteManualFila(id)
      .catch(e => console.warn('No se pudo eliminar fila de manual de procedimiento en BD:', e))
  }

  return (
  <AIAnalysisContext.Provider value={{
    analysis, datosEmpresa, actividades, proyectosDiseno,
    setAnalysis, setDatosEmpresa, setActividades, setProyectosDiseno,
    addActividad, removeActividad,
    addProyectoDiseno, updateProyectoDiseno, removeProyectoDiseno,
    updateFilaMatrizRoles, addFilaMatrizRoles, removeFilaMatrizRoles,
    updateFilaMatrizCargos, addFilaMatrizCargos, removeFilaMatrizCargos,
    addFilaMapaProcedimiento, updateFilaMapaProcedimiento, removeFilaMapaProcedimiento,
    addFilaManualProcedimiento, updateFilaManualProcedimiento, removeFilaManualProcedimiento,
    clearAnalysis,
  }}>
    {children}
  </AIAnalysisContext.Provider>
  )
}

export const useAIAnalysis = (): AIAnalysisContextValue => {
  const ctx = useContext(AIAnalysisContext)
  if (!ctx) throw new Error('useAIAnalysis must be used within AIAnalysisProvider')
  return ctx
}

/* ── Generador de acciones por tipo/fuente/categoría ─────────── */
function generarAccion(
  tipo:        'Riesgo' | 'Oportunidad',
  categoria:   string,
  fuente:      'PESTEL' | 'DOFA' | 'Recursos' | 'ACTIVIDAD',
  nivel:       number,
  descripcion: string
): string {
  const cat  = categoria.toLowerCase()
  const desc = descripcion.toLowerCase()

  if (tipo === 'Oportunidad') {
    if (cat.includes('tecnol') || desc.includes('tecnol') || desc.includes('digital') || desc.includes('software'))
      return 'Diseñar e implementar un plan de adopción tecnológica; asignar presupuesto para pilotos y formación del equipo en las nuevas herramientas.'
    if (cat.includes('mercado') || cat.includes('comercial') || desc.includes('mercado') || desc.includes('client'))
      return 'Desarrollar estrategia de expansión de mercado; fortalecer canales de distribución y elaborar propuesta de valor diferenciada para el segmento identificado.'
    if (cat.includes('social') || desc.includes('tendencia') || desc.includes('demograf'))
      return 'Adaptar portafolio de productos/servicios a las tendencias sociales detectadas; lanzar campaña de posicionamiento orientada al nuevo perfil de cliente.'
    if (cat.includes('político') || cat.includes('legal') || cat.includes('regulat') || desc.includes('normativ'))
      return 'Anticiparse al marco regulatorio favorable; solicitar certificaciones o habilitaciones que otorguen ventaja competitiva ante el cambio normativo.'
    if (cat.includes('económi') || desc.includes('financ') || desc.includes('inversión'))
      return 'Elaborar propuesta de inversión para capturar la oportunidad financiera; evaluar alianzas estratégicas o acceso a líneas de crédito para su aprovechamiento.'
    if (cat.includes('ambiental') || desc.includes('sostenib') || desc.includes('verde'))
      return 'Implementar prácticas de producción sostenible; certificar procesos bajo estándares ambientales y comunicar la ventaja a clientes con enfoque ESG.'
    if (fuente === 'ACTIVIDAD')
      return 'Capitalizar los resultados del proceso para generar nuevo valor; revisar si alguna salida puede convertirse en un producto o servicio diferenciador para el cliente.'
    if (fuente === 'DOFA')
      return 'Diseñar plan de aprovechamiento con responsable, fechas e indicadores; alinear la oportunidad con los objetivos estratégicos de la organización.'
    return 'Formular plan de acción para capitalizar la oportunidad; definir responsable, recursos, cronograma e indicador de seguimiento.'
  }

  const prefijo = nivel >= 15 ? 'ACCIÓN INMEDIATA: ' : nivel >= 9 ? 'PRIORITARIO: ' : ''

  if (fuente === 'ACTIVIDAD')
    return `${prefijo}Establecer controles preventivos sobre el proceso completo para garantizar la continuidad de las operaciones y la calidad de las salidas; documentar criterios de aceptación y verificación en cada etapa.`
  if (cat.includes('tecnol') || desc.includes('sistema') || desc.includes('software'))
    return `${prefijo}Establecer plan de continuidad tecnológica; implementar copias de seguridad, redundancia y protocolo de recuperación ante fallos de sistemas.`
  if (cat.includes('legal') || cat.includes('regulat') || cat.includes('normativ') || desc.includes('normativ'))
    return `${prefijo}Revisar y actualizar procedimientos para asegurar cumplimiento normativo; designar responsable de seguimiento regulatorio y programar auditorías internas periódicas.`
  if (cat.includes('económi') || desc.includes('financ') || desc.includes('costo'))
    return `${prefijo}Diversificar proveedores y fuentes de ingresos; establecer reserva financiera de contingencia y monitorear indicadores económicos mensualmente.`
  if (cat.includes('social') || desc.includes('personal') || desc.includes('talento'))
    return `${prefijo}Implementar plan de retención y desarrollo del talento humano; documentar conocimiento crítico y diseñar programa de sucesión para roles clave.`
  if (cat.includes('ambiental') || desc.includes('ambiental') || desc.includes('clima'))
    return `${prefijo}Desarrollar plan de gestión ambiental y protocolo de respuesta ante emergencias; asegurar cumplimiento de requisitos legales ambientales aplicables.`
  if (cat.includes('político') || desc.includes('político') || desc.includes('gobierno'))
    return `${prefijo}Monitorear el entorno político-legal; establecer planes de contingencia operativa y diversificar mercados para reducir dependencia del contexto local.`
  if (fuente === 'DOFA')
    return `${prefijo}Elaborar plan de mejora con acciones correctivas específicas; asignar responsable, recursos y fechas de verificación para eliminar o reducir la debilidad/amenaza.`
  if (fuente === 'Recursos')
    return `${prefijo}Implementar controles operativos sobre el recurso afectado; definir protocolo de inspección periódica y criterios de aceptación para reducir la probabilidad de ocurrencia.`

  return `${prefijo}Definir e implementar plan de tratamiento del riesgo con acciones preventivas y correctivas; asignar responsable y fecha límite de ejecución.`
}

/* ── Helpers ─────────────────────────────────────────────────── */
function impactoToNum(i: string) { return i === 'Alto' ? 4 : i === 'Medio' ? 3 : 2 }
function estadoDesdeNivel(n: number): 'CRITICO' | 'TRATAMIENTO' | 'MONITOREO' {
  return n >= 15 ? 'CRITICO' : n >= 8 ? 'TRATAMIENTO' : 'MONITOREO'
}

/* ── codigoEstable ────────────────────────────────────────────────
   Genera un código determinístico (hash djb2) a partir del contenido
   de origen de un riesgo/oportunidad, en vez de su POSICIÓN en el
   análisis. Esto evita que los códigos "se corran" (y por lo tanto
   pierdan su vínculo con `riesgo_eficacia`, `riesgo_evidencias` y la
   tabla `riesgos`) cuando el usuario edita o reordena filas de
   PESTEL/DOFA/Recursos que no tienen relación con este riesgo.
   El mismo contenido siempre produce el mismo código. Si el usuario
   edita el texto del riesgo, el código cambiará — eso es intencional,
   porque el contenido en sí es distinto. */
function codigoEstable(prefijo: string, ...partes: string[]): string {
  const contenido = partes.join('|').toLowerCase().trim()
  let hash = 5381
  for (let i = 0; i < contenido.length; i++) {
    hash = ((hash << 5) + hash + contenido.charCodeAt(i)) >>> 0 // djb2
  }
  const sufijo = hash.toString(36).toUpperCase().padStart(5, '0').slice(-5)
  return `${prefijo}-${sufijo}`
}

/* ── derivarRiesgosDeActividades ─────────────────────────────────
   Genera EXACTAMENTE 1 Riesgo + 1 Oportunidad por actividad.

   • El Riesgo consolida TODAS las entradas en una sola descripción
     (riesgo de fallo/indisponibilidad de los insumos del proceso).
   • La Oportunidad consolida TODAS las salidas en una sola descripción
     (potencial de mejora/escala de los resultados generados).
   • Si una actividad no tiene entradas registradas, no se genera Riesgo.
   • Si una actividad no tiene salidas registradas, no se genera Oportunidad.
   • Las descripciones aprovechan el campo `objetivo` e `indicador`
     guardados en la actividad para enriquecer el contexto.            */
export function derivarRiesgosDeActividades(
  actividades: ActividadEmpresa[]
): RiesgoDerivado[] {
  const resultado: RiesgoDerivado[] = []

  for (const act of actividades) {
    const categoria = 'Actividad Propia'
    const proc      = act.proceso ? ` en el proceso "${act.proceso}"` : ''
    const resp      = act.responsable || 'Responsable del proceso'

    /* ── 1 RIESGO por actividad (consolida todas las entradas) ── */
    const entradasValidas = act.entradas.filter(e => e.valor.trim())
    if (entradasValidas.length > 0) {
      const listaEntradas =
        entradasValidas.length === 1
          ? `"${entradasValidas[0].valor}"`
          : entradasValidas.map(e => `"${e.valor}"`).join(', ')

      const descripcion =
        `Riesgo de fallo, retraso o indisponibilidad de los insumos (${listaEntradas}) ` +
        `requeridos por la actividad "${act.nombre}"${proc}. ` +
        `Su ausencia o deficiencia puede comprometer la continuidad del proceso ` +
        `y el cumplimiento del objetivo: ${act.objetivo || 'no definido'}.`

      const prob  = 3
      const imp   = 3
      const nivel = prob * imp

      resultado.push({
        codigo:          codigoEstable('ACT-R', act.id),
        descripcion,
        tipo:            'Riesgo',
        fuente:          'ACTIVIDAD',
        categoria,
        actividadNombre: act.nombre,
        actividadId:     act.id,
        probabilidad:    prob,
        impacto:         imp,
        nivel,
        estado:          estadoDesdeNivel(nivel),
        responsable:     resp,
        acciones:        generarAccion('Riesgo', categoria, 'ACTIVIDAD', nivel, descripcion),
      })
    }

    /* ── 1 OPORTUNIDAD por actividad (consolida todas las salidas) ── */
    const salidasValidas = act.salidas.filter(s => s.valor.trim())
    if (salidasValidas.length > 0) {
      const listaSalidas =
        salidasValidas.length === 1
          ? `"${salidasValidas[0].valor}"`
          : salidasValidas.map(s => `"${s.valor}"`).join(', ')

      const descripcion =
        `Oportunidad de optimización y aprovechamiento de los resultados (${listaSalidas}) ` +
        `generados por la actividad "${act.nombre}"${proc}. ` +
        `Escalar, reutilizar o mejorar estas salidas puede incrementar el valor ` +
        `entregado al cliente y fortalecer la competitividad del proceso. ` +
        `Indicador de referencia: ${act.indicador || 'no definido'}.`

      const prob  = 2
      const imp   = 2
      const nivel = prob * imp

      resultado.push({
        codigo:          codigoEstable('ACT-OP', act.id),
        descripcion,
        tipo:            'Oportunidad',
        fuente:          'ACTIVIDAD',
        categoria,
        actividadNombre: act.nombre,
        actividadId:     act.id,
        probabilidad:    prob,
        impacto:         imp,
        nivel,
        estado:          estadoDesdeNivel(nivel),
        responsable:     resp,
        acciones:        generarAccion('Oportunidad', categoria, 'ACTIVIDAD', nivel, descripcion),
      })
    }
  }

  return resultado
}

/* ── derivarRiesgos ──────────────────────────────────────────── */
export function derivarRiesgos(
  analysis:    AIAnalysis,
  actividades: ActividadEmpresa[] = []
): RiesgoDerivado[] {
  const riesgos: RiesgoDerivado[] = []

  for (const row of analysis.pestel) {
    const prob  = row.oportunidad ? 2 : 3 + (row.impacto === 'Alto' ? 1 : 0)
    const imp   = impactoToNum(row.impacto)
    const nivel = prob * imp
    const tipo: 'Riesgo' | 'Oportunidad' = row.oportunidad ? 'Oportunidad' : 'Riesgo'
    riesgos.push({
      codigo:       codigoEstable(tipo === 'Oportunidad' ? 'OP' : 'R', 'PESTEL', row.categoria, row.descripcion),
      descripcion:  row.descripcion,
      tipo,
      fuente:       'PESTEL',
      categoria:    row.categoria,
      probabilidad: prob,
      impacto:      imp,
      nivel,
      estado:       estadoDesdeNivel(nivel),
      responsable:  'Director de Calidad',
      acciones:     generarAccion(tipo, row.categoria, 'PESTEL', nivel, row.descripcion),
    })
  }

  for (const row of analysis.dofa) {
    const esR   = row.tipo === 'Debilidad' || row.tipo === 'Amenaza'
    const tipo: 'Riesgo' | 'Oportunidad' = esR ? 'Riesgo' : 'Oportunidad'
    const prob  = esR ? 3 : 2
    const imp   = esR ? 3 : 2
    const nivel = prob * imp
    riesgos.push({
      codigo:       codigoEstable(esR ? 'R' : 'OP', 'DOFA', row.tipo, row.descripcion),
      descripcion:  row.descripcion,
      tipo,
      fuente:       'DOFA',
      categoria:    row.tipo,
      probabilidad: prob,
      impacto:      imp,
      nivel,
      estado:       estadoDesdeNivel(nivel),
      responsable:  'Director de Calidad',
      acciones:     generarAccion(tipo, row.tipo, 'DOFA', nivel, row.descripcion),
    })
  }

  if (analysis.matrizRecursos) {
    for (const row of analysis.matrizRecursos) {
      if (row.riesgo && row.riesgo.trim() !== '' && row.riesgo.toLowerCase() !== 'ninguno' && row.riesgo.toLowerCase() !== 'n/a') {
        const prob  = row.probabilidad ? impactoToNum(row.probabilidad) : 3
        const imp   = row.impacto      ? impactoToNum(row.impacto)      : 3
        const nivel = prob * imp
        riesgos.push({
          codigo:       codigoEstable('R', 'Recursos', row.proceso, row.riesgo),
          descripcion:  row.riesgo + (row.hallazgo ? ` (Hallazgo: ${row.hallazgo})` : ''),
          tipo:         'Riesgo',
          fuente:       'Recursos',
          categoria:    `Recursos - ${row.proceso}`,
          probabilidad: prob,
          impacto:      imp,
          nivel,
          estado:       estadoDesdeNivel(nivel),
          responsable:  'Director de Calidad',
          acciones:     generarAccion('Riesgo', `Recursos - ${row.proceso}`, 'Recursos', nivel, row.riesgo),
        })
      }
      if (row.oportunidad && row.oportunidad.trim() !== '' && row.oportunidad.toLowerCase() !== 'ninguna' && row.oportunidad.toLowerCase() !== 'n/a') {
        const prob = 2; const imp = 2; const nivel = prob * imp
        riesgos.push({
          codigo:       codigoEstable('OP', 'Recursos', row.proceso, row.oportunidad),
          descripcion:  row.oportunidad + (row.accion ? ` (Acción: ${row.accion})` : ''),
          tipo:         'Oportunidad',
          fuente:       'Recursos',
          categoria:    `Recursos - ${row.proceso}`,
          probabilidad: prob,
          impacto:      imp,
          nivel,
          estado:       estadoDesdeNivel(nivel),
          responsable:  'Director de Calidad',
          acciones:     generarAccion('Oportunidad', `Recursos - ${row.proceso}`, 'Recursos', nivel, row.oportunidad),
        })
      }
    }
  }

  if (actividades.length > 0) {
    const fromActividades = derivarRiesgosDeActividades(actividades)
    riesgos.push(...fromActividades)
  }

  return riesgos
}

/* ── derivarObjetivos ────────────────────────────────────────── */
function frecDesdeNivel(n: number): FrecuenciaMedicion {
  return n >= 15 ? 'Mensual' : n >= 9 ? 'Trimestral' : n >= 4 ? 'Semestral' : 'Anual'
}

export function derivarObjetivos(
  analysis:    AIAnalysis,
  actividades: ActividadEmpresa[] = []
): ObjetivoDerivado[] {
  const riesgos = derivarRiesgos(analysis, actividades)
  const objetivos: ObjetivoDerivado[] = []
  const ordenados = [...riesgos].sort((a, b) => {
    if (a.tipo === 'Riesgo' && b.tipo === 'Oportunidad') return -1
    if (a.tipo === 'Oportunidad' && b.tipo === 'Riesgo') return 1
    return b.nivel - a.nivel
  })
  for (const r of ordenados) {
    if (r.tipo === 'Riesgo' && r.nivel < 4) continue
    const frecuencia = frecDesdeNivel(r.nivel)
    const hoy = new Date(); const fin = new Date(hoy)
    const meses: Record<FrecuenciaMedicion, number> = { Mensual:1,Bimestral:2,Trimestral:3,Cuatrimestral:4,Semestral:6,Anual:12 }
    fin.setMonth(fin.getMonth() + meses[frecuencia])
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const desc = r.descripcion.length > 120 ? r.descripcion.slice(0, 117) + '...' : r.descripcion
    objetivos.push({
      /* Derivado del código YA estable del riesgo de origen (no de la
         posición en la lista ordenada), para que no se corra si se
         agrega/quita otro riesgo con el mismo nivel. */
      codigo: codigoEstable('OC', r.codigo),
      objetivo: r.tipo === 'Oportunidad'
        ? `Aprovechar la oportunidad en ${r.categoria.toLowerCase()}: ${desc}`
        : `Reducir el riesgo en ${r.categoria.toLowerCase()}: ${desc}`,
      proceso_relacionado:       '',
      fuente_riesgo_oportunidad: r.descripcion,
      tipo_fuente:               r.tipo,
      accion:                    r.acciones,
      responsable:               r.responsable,
      recursos:                  'Por definir',
      frecuencia_medicion:       frecuencia,
      meta: r.tipo === 'Oportunidad'
        ? '≥ 80% de cumplimiento'
        : r.nivel >= 15 ? '100% acciones ejecutadas' : '≥ 90% acciones ejecutadas',
      indicador: r.tipo === 'Oportunidad'
        ? `% aprovechamiento en ${r.categoria}`
        : `% reducción del riesgo en ${r.categoria}`,
      fecha_inicio:  fmt(hoy),
      fecha_fin:     fmt(fin),
      estado:        'Pendiente',
      mediciones:    [],
      _riesgoCodigo: r.codigo,
      _riesgoNivel:  r.nivel,
    })
  }
  return objetivos
}