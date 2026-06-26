import React, { useState } from 'react'
import '../iso-module.css'
import { useAIAnalysis } from '../../context/AIAnalysisContext'

/* ─────────────────── TIPOS ─────────────────── */
interface UnidadCurricular {
  nombre: string; contenidoProgramatico: string; intensidadHoraria: number
  nivelCurso: 'Preescolar' | 'Primaria' | 'Secundaria' | 'Media' | 'Técnico'
  gradoAnio: string; periodo: string; docente: string; metodologia: string
  recursosMateriales: string; criteriosEvaluacion: string; logros: string
}

interface FichaTecnica {
  id: string; tipo: 'educativa' | 'general'; generadaConIA: boolean
  cliente: string; productoServicio: string; version: string
  fechaElaboracion: string; elaboradoPor: string; aprobadoPor: string
  estado: 'Vigente' | 'En revisión' | 'Obsoleta'
  descripcion: string; especificacionesTecnicas: string
  normasAplicables: string; condicionesUso: string
  areaAsignatura: string; unidadesCurriculares: UnidadCurricular[]
  totalHorasSemana: number; objetivoGeneral: string
  competencias: string; observaciones: string
}

interface Requisito {
  id: number; cliente: string; productoServicio: string
  requisitosCliente: string; requisitosLegales: string; requisitosOrg: string
  fechaRevision: string; revisadoPor: string
  estado: 'Aprobado' | 'Pendiente' | 'Rechazado'
  fichaTecnicaId?: string; generadoConIA?: boolean
}

/* ═══ HELPERS ═══ */
const NIVEL_COLOR: Record<string, { bg: string; color: string }> = {
  Preescolar: { bg: '#fdf4ff', color: '#7e22ce' },
  Primaria:   { bg: '#eff6ff', color: '#1e40af' },
  Secundaria: { bg: '#f0fdf4', color: '#166534' },
  Media:      { bg: '#fefce8', color: '#854d0e' },
  Técnico:    { bg: '#fff7ed', color: '#9a3412' },
}

function esSectorEducativo(sector?: string) {
  if (!sector) return false
  const s = sector.toLowerCase()
  return ['educat','colegio','escuel','universid','instituc','académi','enseñanz','formaci'].some(k => s.includes(k))
}

const emptyUnidad = (): UnidadCurricular => ({
  nombre: '', contenidoProgramatico: '', intensidadHoraria: 2,
  nivelCurso: 'Primaria', gradoAnio: '', periodo: '',
  docente: '', metodologia: '', recursosMateriales: '',
  criteriosEvaluacion: '', logros: '',
})

const emptyReq = {
  cliente: '', productoServicio: '', requisitosCliente: '', requisitosLegales: '',
  requisitosOrg: '', fechaRevision: '', revisadoPor: '', estado: 'Pendiente' as const,
}

/* ── Spinner ── */
const Spinner: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(17,24,39,0.65)', zIndex:2000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1.25rem' }}>
    <div style={{ width:52, height:52, border:'5px solid rgba(255,255,255,0.2)', borderTopColor:'#fff', borderRadius:'50%', animation:'govSpin 0.75s linear infinite' }} />
    <p style={{ color:'#fff', fontWeight:600, fontSize:'1rem', margin:0, textAlign:'center', maxWidth:340 }}>{text}</p>
    <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.8rem', margin:0 }}>Analizando con Governex IA…</p>
    <style>{`@keyframes govSpin{to{transform:rotate(360deg)}}`}</style>
  </div>
)

/* ── Badges ── */
const AIBadge = () => (
  <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', background:'linear-gradient(90deg,#f5f3ff,#eff6ff)', border:'1px solid #c4b5fd', borderRadius:999, fontSize:'0.7rem', fontWeight:700, color:'#6d28d9', padding:'0.15rem 0.6rem' }}>✨ IA</span>
)

/* ── API helpers ── */
async function apiPost(path: string, body: object) {
  const token = localStorage.getItem('governex_token')
  const BASE  = (import.meta as any).env?.VITE_API_URL || ''
  const res   = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Error ${res.status}` }))
    throw new Error(err.error || `Error ${res.status}`)
  }
  return res.json()
}

/* ═══════════════ PANEL FICHA GENERAL ═══════════════ */
const PanelGeneral: React.FC<{ ficha: FichaTecnica; onChange: (f: FichaTecnica) => void }> = ({ ficha, onChange }) => {
  const set = (k: keyof FichaTecnica, v: any) => onChange({ ...ficha, [k]: v })
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
      <div className="iso-form-row">
        <div className="iso-field"><label>Cliente / Destinatario</label><input value={ficha.cliente} onChange={e => set('cliente', e.target.value)} /></div>
        <div className="iso-field"><label>Producto / Servicio</label><input value={ficha.productoServicio} onChange={e => set('productoServicio', e.target.value)} /></div>
      </div>
      <div className="iso-field"><label>Descripción general</label><textarea rows={2} value={ficha.descripcion} onChange={e => set('descripcion', e.target.value)} /></div>
      <div className="iso-field"><label>Especificaciones técnicas</label><textarea rows={3} value={ficha.especificacionesTecnicas} onChange={e => set('especificacionesTecnicas', e.target.value)} /></div>
      <div className="iso-form-row">
        <div className="iso-field"><label>Normas / Estándares aplicables</label><input value={ficha.normasAplicables} onChange={e => set('normasAplicables', e.target.value)} /></div>
        <div className="iso-field"><label>Condiciones de uso</label><input value={ficha.condicionesUso} onChange={e => set('condicionesUso', e.target.value)} /></div>
      </div>
      <div className="iso-field"><label>Observaciones</label><textarea rows={2} value={ficha.observaciones} onChange={e => set('observaciones', e.target.value)} /></div>
      <div className="iso-form-row">
        <div className="iso-field"><label>Elaborado por</label><input value={ficha.elaboradoPor} onChange={e => set('elaboradoPor', e.target.value)} /></div>
        <div className="iso-field"><label>Aprobado por</label><input value={ficha.aprobadoPor} onChange={e => set('aprobadoPor', e.target.value)} /></div>
      </div>
      <div className="iso-form-row">
        <div className="iso-field"><label>Versión</label><input value={ficha.version} onChange={e => set('version', e.target.value)} /></div>
        <div className="iso-field"><label>Fecha elaboración</label><input type="date" value={ficha.fechaElaboracion} onChange={e => set('fechaElaboracion', e.target.value)} /></div>
      </div>
      <div className="iso-field"><label>Estado</label>
        <select value={ficha.estado} onChange={e => set('estado', e.target.value as any)}>
          <option>En revisión</option><option>Vigente</option><option>Obsoleta</option>
        </select>
      </div>
    </div>
  )
}

/* ═══════════════ PANEL FICHA EDUCATIVA ═══════════════ */
const PanelEducativa: React.FC<{ ficha: FichaTecnica; onChange: (f: FichaTecnica) => void }> = ({ ficha, onChange }) => {
  const set = (k: keyof FichaTecnica, v: any) => onChange({ ...ficha, [k]: v })
  const setU = (idx: number, k: keyof UnidadCurricular, v: any) => {
    const us = ficha.unidadesCurriculares.map((u, i) => i === idx ? { ...u, [k]: v } : u)
    onChange({ ...ficha, unidadesCurriculares: us, totalHorasSemana: us.reduce((a, u) => a + (Number(u.intensidadHoraria) || 0), 0) })
  }
  const addU = () => onChange({ ...ficha, unidadesCurriculares: [...ficha.unidadesCurriculares, emptyUnidad()] })
  const removeU = (idx: number) => {
    if (ficha.unidadesCurriculares.length === 1) return
    const us = ficha.unidadesCurriculares.filter((_, i) => i !== idx)
    onChange({ ...ficha, unidadesCurriculares: us, totalHorasSemana: us.reduce((a, u) => a + (Number(u.intensidadHoraria) || 0), 0) })
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
      <div style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:'0.5rem', padding:'1rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
        <p style={{ margin:0, fontWeight:700, fontSize:'0.82rem', color:'#1b3a6b' }}>📂 Datos generales del área</p>
        <div className="iso-form-row">
          <div className="iso-field"><label>Institución / Cliente</label><input value={ficha.cliente} onChange={e => set('cliente', e.target.value)} /></div>
          <div className="iso-field"><label>Área / Asignatura</label><input value={ficha.areaAsignatura} onChange={e => set('areaAsignatura', e.target.value)} /></div>
        </div>
        <div className="iso-field"><label>Objetivo general</label><textarea rows={2} value={ficha.objetivoGeneral} onChange={e => set('objetivoGeneral', e.target.value)} /></div>
        <div className="iso-field"><label>Competencias a desarrollar</label><textarea rows={2} value={ficha.competencias} onChange={e => set('competencias', e.target.value)} /></div>
        <div className="iso-field"><label>Observaciones</label><textarea rows={2} value={ficha.observaciones} onChange={e => set('observaciones', e.target.value)} /></div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <p style={{ margin:0, fontWeight:700, fontSize:'0.82rem', color:'#1b3a6b' }}>
          📚 Cursos / Grados
          <span style={{ marginLeft:'0.5rem', background:'#dbeafe', color:'#1e40af', padding:'0.1rem 0.55rem', borderRadius:999, fontSize:'0.72rem', fontWeight:700 }}>{ficha.totalHorasSemana}h/semana</span>
        </p>
        <button className="iso-btn-primary" style={{ fontSize:'0.78rem', padding:'0.35rem 0.75rem' }} onClick={addU}>＋ Agregar curso</button>
      </div>
      {ficha.unidadesCurriculares.map((u, idx) => {
        const nc = NIVEL_COLOR[u.nivelCurso] || NIVEL_COLOR['Primaria']
        return (
          <div key={idx} style={{ border:`1.5px solid ${nc.color}35`, borderRadius:'0.6rem', padding:'1rem', background:nc.bg, display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:700, fontSize:'0.82rem', color:nc.color }}>📖 Curso #{idx+1}{u.gradoAnio && ` — ${u.gradoAnio}`}</span>
              {ficha.unidadesCurriculares.length > 1 && <button className="iso-btn-icon danger" onClick={() => removeU(idx)}>🗑️</button>}
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Nivel educativo</label>
                <select value={u.nivelCurso} onChange={e => setU(idx,'nivelCurso',e.target.value as any)}>
                  <option>Preescolar</option><option>Primaria</option><option>Secundaria</option><option>Media</option><option>Técnico</option>
                </select>
              </div>
              <div className="iso-field"><label>Grado / Año</label><input value={u.gradoAnio} onChange={e => setU(idx,'gradoAnio',e.target.value)} placeholder="3° Primaria, 10° Grado…" /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Nombre unidad / módulo</label><input value={u.nombre} onChange={e => setU(idx,'nombre',e.target.value)} /></div>
              <div className="iso-field"><label>Intensidad horaria (h/sem)</label><input type="number" min={1} max={40} value={u.intensidadHoraria} onChange={e => setU(idx,'intensidadHoraria',Number(e.target.value))} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Periodo académico</label><input value={u.periodo} onChange={e => setU(idx,'periodo',e.target.value)} /></div>
              <div className="iso-field"><label>Docente responsable</label><input value={u.docente} onChange={e => setU(idx,'docente',e.target.value)} /></div>
            </div>
            <div className="iso-field"><label>Contenido programático</label>
              <textarea rows={4} value={u.contenidoProgramatico} onChange={e => setU(idx,'contenidoProgramatico',e.target.value)} placeholder="Tema 1: …&#10;Tema 2: …" />
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Metodología</label><input value={u.metodologia} onChange={e => setU(idx,'metodologia',e.target.value)} /></div>
              <div className="iso-field"><label>Recursos y materiales</label><input value={u.recursosMateriales} onChange={e => setU(idx,'recursosMateriales',e.target.value)} /></div>
            </div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Criterios de evaluación</label><input value={u.criteriosEvaluacion} onChange={e => setU(idx,'criteriosEvaluacion',e.target.value)} /></div>
              <div className="iso-field"><label>Logros esperados</label><input value={u.logros} onChange={e => setU(idx,'logros',e.target.value)} /></div>
            </div>
          </div>
        )
      })}
      <div style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:'0.5rem', padding:'1rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
        <p style={{ margin:0, fontWeight:700, fontSize:'0.82rem', color:'#1b3a6b' }}>🗂️ Control del documento</p>
        <div className="iso-form-row">
          <div className="iso-field"><label>Elaborado por</label><input value={ficha.elaboradoPor} onChange={e => set('elaboradoPor', e.target.value)} /></div>
          <div className="iso-field"><label>Aprobado por</label><input value={ficha.aprobadoPor} onChange={e => set('aprobadoPor', e.target.value)} /></div>
        </div>
        <div className="iso-form-row">
          <div className="iso-field"><label>Versión</label><input value={ficha.version} onChange={e => set('version', e.target.value)} /></div>
          <div className="iso-field"><label>Fecha elaboración</label><input type="date" value={ficha.fechaElaboracion} onChange={e => set('fechaElaboracion', e.target.value)} /></div>
        </div>
        <div className="iso-field"><label>Estado</label>
          <select value={ficha.estado} onChange={e => set('estado', e.target.value as any)}>
            <option>En revisión</option><option>Vigente</option><option>Obsoleta</option>
          </select>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ MODAL EDITAR FICHA ═══════════════ */
const ModalFicha: React.FC<{ ficha: FichaTecnica; onChange: (f: FichaTecnica) => void; onClose: () => void; onGuardar: () => void; errorIA: string | null }> = ({ ficha, onChange, onClose, onGuardar, errorIA }) => (
  <div className="iso-modal-overlay" onClick={onClose}>
    <div className="iso-modal" style={{ maxWidth:720 }} onClick={e => e.stopPropagation()}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.5rem', flexWrap:'wrap' }}>
        <div>
          <h2 style={{ margin:0 }}>{ficha.tipo === 'educativa' ? '🎓' : '📋'} Ficha Técnica</h2>
          <p style={{ margin:'0.15rem 0 0', fontSize:'0.78rem', color:'#6b7280' }}>
            {ficha.tipo === 'educativa' ? ficha.areaAsignatura : ficha.productoServicio} · {ficha.cliente}
          </p>
        </div>
        <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', alignItems:'center' }}>
          {ficha.generadaConIA && <AIBadge />}
          <span className={`iso-badge ${ficha.estado === 'Vigente' ? 'verde' : ficha.estado === 'En revisión' ? 'amarillo' : 'gris'}`}>{ficha.estado}</span>
        </div>
      </div>
      {errorIA && <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:'0.5rem', padding:'0.65rem 1rem', fontSize:'0.82rem', color:'#991b1b' }}>❌ {errorIA}</div>}
      {ficha.tipo === 'educativa' ? <PanelEducativa ficha={ficha} onChange={onChange} /> : <PanelGeneral ficha={ficha} onChange={onChange} />}
      <div className="iso-modal__footer">
        <button className="iso-btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="iso-btn-primary" onClick={onGuardar}>💾 Guardar ficha</button>
      </div>
    </div>
  </div>
)

/* ═══════════════ MODAL VER FICHA ═══════════════ */
const ModalVerFicha: React.FC<{ ficha: FichaTecnica; onClose: () => void; onEditar: () => void }> = ({ ficha, onClose, onEditar }) => {
  const isEdu = ficha.tipo === 'educativa'
  return (
    <div className="iso-modal-overlay" onClick={onClose}>
      <div className="iso-modal" style={{ maxWidth:700 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h2 style={{ margin:0, fontSize:'1.1rem' }}>{isEdu ? '🎓' : '📋'} Ficha Técnica</h2>
            <p style={{ margin:'0.2rem 0 0', fontSize:'0.8rem', color:'#6b7280' }}>{ficha.id} · v{ficha.version} · {ficha.fechaElaboracion}</p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.3rem' }}>
            <span className={`iso-badge ${ficha.estado === 'Vigente' ? 'verde' : ficha.estado === 'En revisión' ? 'amarillo' : 'gris'}`}>{ficha.estado}</span>
            {ficha.generadaConIA && <AIBadge />}
          </div>
        </div>
        <hr style={{ border:'none', borderTop:'1px solid #e5e7eb', margin:'0.25rem 0' }} />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', fontSize:'0.82rem' }}>
          <div><span style={{ color:'#6b7280' }}>Cliente:</span> <strong>{ficha.cliente}</strong></div>
          <div><span style={{ color:'#6b7280' }}>{isEdu ? 'Área:' : 'Producto/Servicio:'}</span> <strong>{isEdu ? ficha.areaAsignatura : ficha.productoServicio}</strong></div>
          <div><span style={{ color:'#6b7280' }}>Elaborado por:</span> {ficha.elaboradoPor || '—'}</div>
          <div><span style={{ color:'#6b7280' }}>Aprobado por:</span> {ficha.aprobadoPor || '—'}</div>
        </div>
        {isEdu ? (
          <>
            {ficha.objetivoGeneral && <div style={{ background:'#f0f6ff', border:'1px solid #bfdbfe', borderRadius:'0.5rem', padding:'0.75rem', fontSize:'0.82rem' }}><strong style={{ color:'#1e40af' }}>🎯 Objetivo:</strong><p style={{ margin:'0.25rem 0 0', color:'#374151' }}>{ficha.objetivoGeneral}</p></div>}
            {ficha.competencias && <div style={{ fontSize:'0.82rem' }}><strong style={{ color:'#1b3a6b' }}>💡 Competencias:</strong> {ficha.competencias}</div>}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <strong style={{ fontSize:'0.85rem', color:'#1b3a6b' }}>📚 Cursos ({ficha.unidadesCurriculares.length})</strong>
              <span style={{ fontSize:'0.78rem', background:'#dbeafe', color:'#1e40af', padding:'0.15rem 0.6rem', borderRadius:999, fontWeight:700 }}>Total: {ficha.totalHorasSemana}h/semana</span>
            </div>
            {ficha.unidadesCurriculares.map((u, i) => {
              const nc = NIVEL_COLOR[u.nivelCurso] || NIVEL_COLOR['Primaria']
              return (
                <div key={i} style={{ border:`1px solid ${nc.color}40`, borderRadius:'0.5rem', padding:'0.9rem', background:nc.bg, fontSize:'0.82rem', display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                  <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
                    <span style={{ fontWeight:700, color:nc.color }}>{u.gradoAnio || `Curso #${i+1}`}</span>
                    <span style={{ background:nc.bg, color:nc.color, border:`1px solid ${nc.color}60`, fontSize:'0.7rem', fontWeight:700, padding:'0.1rem 0.45rem', borderRadius:999 }}>{u.nivelCurso}</span>
                    <span style={{ background:'#fff', border:'1px solid #e5e7eb', padding:'0.1rem 0.5rem', borderRadius:999, fontSize:'0.72rem', color:'#374151' }}>⏱ {u.intensidadHoraria}h/sem</span>
                    {u.periodo && <span style={{ color:'#6b7280' }}>· {u.periodo}</span>}
                  </div>
                  {u.nombre && <div><strong>Unidad:</strong> {u.nombre}</div>}
                  {u.contenidoProgramatico && <div><strong>Contenido:</strong><p style={{ margin:'0.2rem 0 0', whiteSpace:'pre-line', color:'#374151' }}>{u.contenidoProgramatico}</p></div>}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.4rem' }}>
                    {u.docente && <div><strong>Docente:</strong> {u.docente}</div>}
                    {u.metodologia && <div><strong>Metodología:</strong> {u.metodologia}</div>}
                    {u.criteriosEvaluacion && <div><strong>Evaluación:</strong> {u.criteriosEvaluacion}</div>}
                    {u.logros && <div><strong>Logros:</strong> {u.logros}</div>}
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          <>
            {ficha.descripcion && <div style={{ fontSize:'0.82rem' }}><strong>Descripción:</strong> {ficha.descripcion}</div>}
            {ficha.especificacionesTecnicas && <div style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:'0.5rem', padding:'0.75rem', fontSize:'0.82rem' }}><strong>Especificaciones técnicas:</strong><p style={{ margin:'0.25rem 0 0', whiteSpace:'pre-line', color:'#374151' }}>{ficha.especificacionesTecnicas}</p></div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', fontSize:'0.82rem' }}>
              {ficha.normasAplicables && <div><strong>Normas:</strong> {ficha.normasAplicables}</div>}
              {ficha.condicionesUso && <div><strong>Condiciones de uso:</strong> {ficha.condicionesUso}</div>}
            </div>
          </>
        )}
        {ficha.observaciones && <div style={{ fontSize:'0.82rem', color:'#6b7280', fontStyle:'italic' }}><strong style={{ color:'#374151', fontStyle:'normal' }}>Observaciones:</strong> {ficha.observaciones}</div>}
        <div className="iso-modal__footer">
          <button className="iso-btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="iso-btn-primary" onClick={onEditar}>✏️ Editar / Agregar</button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ PÁGINA PRINCIPAL ═══════════════ */
const RequerimientosPSPage: React.FC = () => {
  const { datosEmpresa } = useAIAnalysis()
  const esEducativo = esSectorEducativo(datosEmpresa?.sector)

  const [items, setItems] = useState<Requisito[]>(() => {
    const saved = sessionStorage.getItem('governex_reqs_items')
    return saved ? JSON.parse(saved) : []
  })
  const [fichas, setFichas] = useState<Record<string, FichaTecnica>>(() => {
    const saved = sessionStorage.getItem('governex_reqs_fichas')
    return saved ? JSON.parse(saved) : {}
  })

  React.useEffect(() => {
    sessionStorage.setItem('governex_reqs_items', JSON.stringify(items))
  }, [items])

  React.useEffect(() => {
    sessionStorage.setItem('governex_reqs_fichas', JSON.stringify(fichas))
  }, [fichas])

  // Modal nueva revisión manual
  const [showReqModal, setShowReqModal] = useState(false)
  const [form, setForm] = useState({ ...emptyReq })

  // Modal ficha técnica
  type ModalMode = 'ver' | 'editar'
  const [fichaModal, setFichaModal]   = useState<{ mode: ModalMode; fichaId: string; reqId?: number } | null>(null)
  const [fichaForm, setFichaForm]     = useState<FichaTecnica | null>(null)

  // Loading / error
  const [loadingMatriz, setLoadingMatriz] = useState(false)
  const [loadingFicha, setLoadingFicha]   = useState(false)
  const [errorMsg, setErrorMsg]           = useState<string | null>(null)

  /* ── 1. GENERAR MATRIZ DE REVISIONES CON IA ── */
  const generarMatrizConIA = async () => {
    if (!datosEmpresa) return
    setLoadingMatriz(true); setErrorMsg(null)
    try {
      const data = await apiPost('/api/gemini/generar-revisiones-requisitos', { datosEmpresa })
      if (!Array.isArray(data.revisiones) || data.revisiones.length === 0) throw new Error('La IA no devolvió revisiones válidas')
      const nuevas: Requisito[] = data.revisiones.map((r: any, i: number) => ({
        id: Date.now() + i,
        cliente:            r.cliente            || '',
        productoServicio:   r.productoServicio   || '',
        requisitosCliente:  r.requisitosCliente  || '',
        requisitosLegales:  r.requisitosLegales  || '',
        requisitosOrg:      r.requisitosOrg      || '',
        revisadoPor:        r.revisadoPor        || '',
        fechaRevision:      r.fechaRevision      || '',
        estado:             r.estado             || 'Pendiente',
        generadoConIA: true,
      }))
      setItems(nuevas)
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Error al generar la matriz con Governex IA')
    } finally {
      setLoadingMatriz(false)
    }
  }

  /* ── 2. AGREGAR REVISIÓN MANUAL ── */
  const guardarReq = () => {
    if (!form.cliente || !form.productoServicio) return
    const id = items.length > 0 ? Math.max(...items.map(r => r.id)) + 1 : 1
    setItems(prev => [...prev, { id, ...form, generadoConIA: false }])
    setShowReqModal(false); setForm({ ...emptyReq })
  }

  const eliminarReq = (id: number) => {
    if (window.confirm('¿Eliminar esta revisión?')) setItems(prev => prev.filter(r => r.id !== id))
  }

  /* ── 3. GENERAR FICHA TÉCNICA CON IA ── */
  const crearFichaConIA = async (req: Requisito) => {
    if (!datosEmpresa) return
    setLoadingFicha(true); setErrorMsg(null)
    try {
      const tipo: 'educativa' | 'general' = esEducativo ? 'educativa' : 'general'
      const data = await apiPost('/api/gemini/generar-ficha-tecnica', {
        datosEmpresa,
        cliente: req.cliente,
        productoServicio: req.productoServicio,
        tipo,
      })
      const fichaId = `FT-${Date.now()}`
      let fichaGenerada: FichaTecnica

      if (tipo === 'educativa') {
        const unidades: UnidadCurricular[] = Array.isArray(data.unidadesCurriculares) ? data.unidadesCurriculares : [emptyUnidad()]
        const totalHoras = unidades.reduce((a: number, u: any) => a + (Number(u.intensidadHoraria) || 0), 0)
        fichaGenerada = {
          id: fichaId, tipo, generadaConIA: true,
          cliente: req.cliente, productoServicio: req.productoServicio,
          version: '1.0', fechaElaboracion: new Date().toISOString().slice(0,10),
          elaboradoPor: data.elaboradoPor || '', aprobadoPor: data.aprobadoPor || '',
          estado: 'En revisión',
          descripcion: '', especificacionesTecnicas: '', normasAplicables: '', condicionesUso: '',
          areaAsignatura: data.areaAsignatura || req.productoServicio,
          objetivoGeneral: data.objetivoGeneral || '', competencias: data.competencias || '',
          observaciones: data.observaciones || '', unidadesCurriculares: unidades, totalHorasSemana: totalHoras,
        }
      } else {
        fichaGenerada = {
          id: fichaId, tipo, generadaConIA: true,
          cliente: req.cliente, productoServicio: req.productoServicio,
          version: '1.0', fechaElaboracion: new Date().toISOString().slice(0,10),
          elaboradoPor: data.elaboradoPor || '', aprobadoPor: data.aprobadoPor || '',
          estado: 'En revisión',
          descripcion: data.descripcion || '', especificacionesTecnicas: data.especificacionesTecnicas || '',
          normasAplicables: data.normasAplicables || '', condicionesUso: data.condicionesUso || '',
          observaciones: data.observaciones || '',
          areaAsignatura: '', objetivoGeneral: '', competencias: '',
          unidadesCurriculares: [emptyUnidad()], totalHorasSemana: 0,
        }
      }
      setFichas(prev => ({ ...prev, [fichaId]: fichaGenerada }))
      setItems(prev => prev.map(r => r.id === req.id ? { ...r, fichaTecnicaId: fichaId } : r))
      setFichaForm(fichaGenerada)
      setFichaModal({ mode: 'ver', fichaId, reqId: req.id })
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Error al generar la ficha técnica')
    } finally {
      setLoadingFicha(false)
    }
  }

  const abrirVerFicha  = (fichaId: string) => { setFichaForm({ ...fichas[fichaId] }); setFichaModal({ mode:'ver', fichaId }) }
  const abrirEditarFicha = (fichaId: string, reqId?: number) => { setFichaForm({ ...fichas[fichaId] }); setFichaModal({ mode:'editar', fichaId, reqId }) }
  const guardarFicha   = () => { if (!fichaForm) return; setFichas(prev => ({ ...prev, [fichaForm.id]: fichaForm })); setFichaModal(null); setFichaForm(null) }

  const cantFichas  = Object.keys(fichas).length
  const tieneItems  = items.length > 0
  const sinContexto = !datosEmpresa

  /* ══════════ RENDER ══════════ */
  return (
    <div className="iso-page">
      {(loadingMatriz || loadingFicha) && (
        <Spinner text={
          loadingMatriz
            ? `Generando matriz de requisitos para "${datosEmpresa?.nombreEmpresa}"…`
            : `Generando ficha técnica con IA…`
        } />
      )}

      {/* Header */}
      <div className="iso-page__header">
        <div className="iso-page__title-block">
          <h1>⚙️ Requerimientos para Productos y Servicios</h1>
          <p>Determinación, revisión y comunicación de requisitos — ISO 9001:2015 §8.2</p>
          <span className="iso-page__clause">Cláusula 8.2</span>
          {esEducativo && <span className="iso-page__clause" style={{ background:'#f0fdf4', color:'#166534', marginLeft:'0.5rem' }}>🎓 Institución Educativa</span>}
          {datosEmpresa && <span className="iso-page__clause" style={{ background:'#f5f3ff', color:'#6d28d9', marginLeft:'0.5rem' }}>✨ IA — {datosEmpresa.nombreEmpresa}</span>}
        </div>
      </div>

      {/* Info */}
      <div className="iso-info-box">
        <span className="iso-info-box__icon">📌</span>
        <span>
          <strong>Cláusula 8.2</strong> — Governex IA genera automáticamente la matriz de revisiones a partir de los productos y servicios ingresados en el módulo 4.1.
          Por cada revisión podrás generar su ficha técnica con un clic.
          {esEducativo ? ' Para instituciones educativas incluye contenido programático e intensidad horaria por grado.' : ''}
        </span>
      </div>

      {/* Aviso sin contexto */}
      {sinContexto && (
        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'0.6rem', padding:'1rem 1.25rem', fontSize:'0.82rem', color:'#92400e', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
          <span style={{ fontSize:'1.2rem', flexShrink:0 }}>⚠️</span>
          <span>
            <strong>Sin análisis de IA disponible.</strong> Ve al módulo <strong>Contexto de la Organización (4.1)</strong>,
            ingresa los datos de la {esEducativo ? 'institución' : 'empresa'} con sus productos y servicios,
            y haz clic en <strong>"Analizar con Governex IA"</strong>. La matriz de revisiones se generará automáticamente aquí.
          </span>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:'0.6rem', padding:'0.75rem 1rem', fontSize:'0.82rem', color:'#991b1b', display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <span>❌</span> {errorMsg}
          <button style={{ marginLeft:'auto', background:'none', border:'none', color:'#991b1b', cursor:'pointer', fontSize:'1rem' }} onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      {/* Stats — solo con datos */}
      {tieneItems && (
        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
          {[
            { label:'Revisiones', value:items.length, icon:'📝', color:'#1b3a6b' },
            { label:'Fichas técnicas', value:cantFichas, icon:'✨', color:'#6d28d9' },
            { label:'Aprobados', value:items.filter(r=>r.estado==='Aprobado').length, icon:'✅', color:'#059669' },
            { label:'Pendientes', value:items.filter(r=>r.estado==='Pendiente').length, icon:'⏳', color:'#d97706' },
          ].map(s => (
            <div key={s.label} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'0.6rem', padding:'0.75rem 1.25rem', flex:1, minWidth:120 }}>
              <div>{s.icon}</div>
              <div style={{ fontSize:'1.4rem', fontWeight:700, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:'0.75rem', color:'#6b7280' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Barra de acciones */}
      <div className="iso-topbar">
        <div className="iso-topbar__info">
          {tieneItems ? <>Revisiones: <strong>{items.length}</strong> · Fichas: <strong>{cantFichas}</strong></> : 'Sin revisiones generadas aún'}
        </div>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
          {/* Botón principal — generar con IA */}
          {!sinContexto && (
            <button
              className="iso-btn-primary"
              style={{ background:'linear-gradient(90deg,#7c3aed,#2e86de)', display:'flex', alignItems:'center', gap:'0.4rem' }}
              onClick={generarMatrizConIA}
              disabled={loadingMatriz}
            >
              ✨ {tieneItems ? 'Regenerar matriz con IA' : 'Generar matriz con IA'}
            </button>
          )}
          {/* Botón secundario — agregar manual (solo si ya hay matriz) */}
          {tieneItems && (
            <button className="iso-btn-secondary" onClick={() => setShowReqModal(true)}>
              ＋ Agregar revisión manual
            </button>
          )}
        </div>
      </div>

      {/* Estado vacío */}
      {!tieneItems ? (
        <div style={{ background:'#fff', border:'2px dashed #e5e7eb', borderRadius:'0.8rem', padding:'3.5rem 2rem', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.9rem' }}>
          <span style={{ fontSize:'3rem' }}>{esEducativo ? '🎓' : '📋'}</span>
          <p style={{ margin:0, fontWeight:700, fontSize:'1.05rem', color:'#1b3a6b' }}>
            La matriz de revisiones se genera automáticamente con IA
          </p>
          <p style={{ margin:0, fontSize:'0.85rem', color:'#6b7280', maxWidth:460 }}>
            {sinContexto
              ? 'Primero completa el análisis del módulo 4.1 — Contexto de la Organización. Luego la IA creará aquí la matriz completa de revisiones de requisitos para cada producto o servicio.'
              : `Haz clic en "✨ Generar matriz con IA" para que Governex IA analice los productos y servicios de ${datosEmpresa!.nombreEmpresa} y genere la matriz completa.`
            }
          </p>
          {!sinContexto && (
            <button
              className="iso-btn-primary"
              style={{ marginTop:'0.5rem', background:'linear-gradient(90deg,#7c3aed,#2e86de)', fontSize:'0.95rem', padding:'0.6rem 1.5rem' }}
              onClick={generarMatrizConIA}
              disabled={loadingMatriz}
            >
              ✨ Generar matriz con IA
            </button>
          )}
        </div>
      ) : (
        /* Tabla */
        <div className="iso-table-wrapper">
          <table className="iso-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>{esEducativo ? 'Área / Asignatura' : 'Producto / Servicio'}</th>
                <th>Requisitos del cliente</th>
                <th>Req. legales</th>
                <th>Req. organización</th>
                <th>Revisado por</th>
                <th>Fecha</th>
                <th>Ficha técnica</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r, i) => {
                const fichaVinculada = r.fichaTecnicaId ? fichas[r.fichaTecnicaId] : null
                return (
                  <tr key={r.id}>
                    <td style={{ color:'#9ca3af' }}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.15rem' }}>
                        <span>{i+1}</span>
                        {r.generadoConIA && <AIBadge />}
                      </div>
                    </td>
                    <td style={{ fontWeight:600, color:'#1b3a6b' }}>{r.cliente}</td>
                    <td>{r.productoServicio}</td>
                    <td style={{ fontSize:'0.78rem', color:'#6b7280' }}>{r.requisitosCliente}</td>
                    <td style={{ fontSize:'0.78rem', color:'#6b7280' }}>{r.requisitosLegales}</td>
                    <td style={{ fontSize:'0.78rem', color:'#6b7280' }}>{r.requisitosOrg}</td>
                    <td>{r.revisadoPor}</td>
                    <td>{r.fechaRevision}</td>
                    <td>
                      {fichaVinculada ? (
                        <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' }}>
                          <button className="iso-btn-icon" style={{ fontSize:'0.75rem', padding:'0.25rem 0.6rem', color:'#6d28d9', borderColor:'#ddd6fe', background:'#f5f3ff' }} onClick={() => abrirVerFicha(r.fichaTecnicaId!)}>👁️ Ver</button>
                          <button className="iso-btn-icon" style={{ fontSize:'0.75rem', padding:'0.25rem 0.6rem' }} onClick={() => abrirEditarFicha(r.fichaTecnicaId!, r.id)} title="Editar / Agregar">✏️</button>
                        </div>
                      ) : (
                        <button
                          className="iso-btn-icon"
                          style={{ fontSize:'0.75rem', padding:'0.25rem 0.7rem', fontWeight:600, color:'#6d28d9', borderColor:'#ddd6fe', background:'#f5f3ff' }}
                          onClick={() => crearFichaConIA(r)}
                          title="Generar ficha técnica con IA"
                        >
                          {esEducativo ? '🎓 ✨ FT' : '📋 ✨ FT'}
                        </button>
                      )}
                    </td>
                    <td>
                      <span className={`iso-badge ${r.estado==='Aprobado'?'verde':r.estado==='Pendiente'?'amarillo':'rojo'}`}>{r.estado}</span>
                    </td>
                    <td><button className="iso-btn-icon danger" onClick={() => eliminarReq(r.id)}>🗑️</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nueva revisión manual */}
      {showReqModal && (
        <div className="iso-modal-overlay" onClick={() => setShowReqModal(false)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2>➕ Agregar revisión manual</h2>
            <p style={{ margin:'-0.5rem 0 0.75rem', fontSize:'0.82rem', color:'#6b7280' }}>
              Completa los campos para agregar una revisión adicional a la matriz generada por IA.
            </p>
            <div className="iso-form-row">
              <div className="iso-field"><label>Cliente *</label><input value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente:e.target.value }))} /></div>
              <div className="iso-field"><label>{esEducativo ? 'Área / Asignatura *' : 'Producto / Servicio *'}</label><input value={form.productoServicio} onChange={e => setForm(p => ({ ...p, productoServicio:e.target.value }))} /></div>
            </div>
            <div className="iso-field"><label>Requisitos del cliente</label><textarea rows={2} value={form.requisitosCliente} onChange={e => setForm(p => ({ ...p, requisitosCliente:e.target.value }))} /></div>
            <div className="iso-field"><label>Requisitos legales y reglamentarios</label><textarea rows={2} value={form.requisitosLegales} onChange={e => setForm(p => ({ ...p, requisitosLegales:e.target.value }))} /></div>
            <div className="iso-field"><label>Requisitos de la organización</label><textarea rows={2} value={form.requisitosOrg} onChange={e => setForm(p => ({ ...p, requisitosOrg:e.target.value }))} /></div>
            <div className="iso-form-row">
              <div className="iso-field"><label>Revisado por</label><input value={form.revisadoPor} onChange={e => setForm(p => ({ ...p, revisadoPor:e.target.value }))} /></div>
              <div className="iso-field"><label>Fecha</label><input type="date" value={form.fechaRevision} onChange={e => setForm(p => ({ ...p, fechaRevision:e.target.value }))} /></div>
            </div>
            <div className="iso-field"><label>Estado</label>
              <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado:e.target.value as any }))}>
                <option>Pendiente</option><option>Aprobado</option><option>Rechazado</option>
              </select>
            </div>
            <div className="iso-modal__footer">
              <button className="iso-btn-secondary" onClick={() => setShowReqModal(false)}>Cancelar</button>
              <button className="iso-btn-primary" onClick={guardarReq} disabled={!form.cliente || !form.productoServicio}>＋ Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver ficha */}
      {fichaModal?.mode === 'ver' && fichaForm && (
        <ModalVerFicha ficha={fichaForm} onClose={() => { setFichaModal(null); setFichaForm(null) }} onEditar={() => setFichaModal(m => m ? { ...m, mode:'editar' } : null)} />
      )}

      {/* Modal Editar ficha */}
      {fichaModal?.mode === 'editar' && fichaForm && (
        <ModalFicha ficha={fichaForm} onChange={setFichaForm} onClose={() => { setFichaModal(null); setFichaForm(null) }} onGuardar={guardarFicha} errorIA={errorMsg} />
      )}
    </div>
  )
}

export default RequerimientosPSPage