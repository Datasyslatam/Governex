/**
 * EmpresaFormModal.tsx — CORREGIDO
 * Fix: los subcomponentes Field, Textarea, Select se definen FUERA
 * del componente principal para evitar que se re-monten en cada render,
 * causando pérdida de foco al escribir.
 */
import React, { useState, useCallback, memo } from 'react'
import { DatosEmpresa } from '../../context/AIAnalysisContext'
import './EmpresaFormModal.css'

/* ── Constantes ────────────────────────────────────────────── */
const TIPOS_EMPRESA = [
  'S.A.S.', 'S.A.', 'Ltda.', 'E.U.', 'S.C.A.',
  'Cooperativa', 'Fundación / ONG', 'Empresa Pública', 'Otra',
]
const TAMANIOS = [
  'Micro (1–10 empleados)', 'Pequeña (11–50 empleados)',
  'Mediana (51–200 empleados)', 'Grande (>200 empleados)',
]
const SECTORES = [
  'Manufactura / Industria', 'Construcción', 'Comercio al por mayor',
  'Comercio al por menor', 'Servicios profesionales', 'Salud y bienestar',
  'Educación', 'Tecnología / Software', 'Agropecuario',
  'Transporte y logística', 'Alimentos y bebidas', 'Energía y utilities',
  'Financiero / Seguros', 'Turismo y hotelería', 'Telecomunicaciones', 'Otro',
]

const EMPTY: DatosEmpresa = {
  nombreEmpresa: '', sector: '', tipoEmpresa: '', tamano: '',
  ubicacion: '', anoFundacion: '', mision: '', vision: '',
  politicaCalidad: '', productosServicios: '', mercadoObjetivo: '',
  cantidadEmpleados: '', alcanceSGC: '', certificaciones: '', parteInteresadas: '',
}

type Seccion = 'identidad' | 'direccionamiento' | 'operacion' | 'sgc'
const ORDER: Seccion[] = ['identidad', 'direccionamiento', 'operacion', 'sgc']

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTES — definidos FUERA para evitar re-montaje
   ══════════════════════════════════════════════════════════════ */

interface FieldProps {
  label:       string
  value:       string
  onChange:    (v: string) => void
  placeholder?: string
  type?:        string
  hint?:        string
  error?:       string
}

const Field = memo(({ label, value, onChange, placeholder = '', type = 'text', hint, error }: FieldProps) => (
  <div className={`efm-field${error ? ' efm-field--error' : ''}`}>
    <label className="efm-label">{label}</label>
    <input
      className="efm-input"
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
    {hint  && <span className="efm-hint">{hint}</span>}
    {error && <span className="efm-error">{error}</span>}
  </div>
))

interface TextareaProps {
  label:       string
  value:       string
  onChange:    (v: string) => void
  placeholder?: string
  rows?:        number
  hint?:        string
  error?:       string
}

const Textarea = memo(({ label, value, onChange, placeholder = '', rows = 3, hint, error }: TextareaProps) => (
  <div className={`efm-field${error ? ' efm-field--error' : ''}`}>
    <label className="efm-label">{label}</label>
    <textarea
      className="efm-textarea"
      rows={rows}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
    {hint  && <span className="efm-hint">{hint}</span>}
    {error && <span className="efm-error">{error}</span>}
  </div>
))

interface SelectProps {
  label:    string
  value:    string
  onChange: (v: string) => void
  options:  string[]
  hint?:    string
  error?:   string
}

const Select = memo(({ label, value, onChange, options, hint, error }: SelectProps) => (
  <div className={`efm-field${error ? ' efm-field--error' : ''}`}>
    <label className="efm-label">{label}</label>
    <select
      className="efm-select"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">— Selecciona —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    {hint  && <span className="efm-hint">{hint}</span>}
    {error && <span className="efm-error">{error}</span>}
  </div>
))

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════════ */
interface Props {
  onConfirm: (datos: DatosEmpresa) => void
  onCancel:  () => void
  initial?:  Partial<DatosEmpresa>
}

const EmpresaFormModal: React.FC<Props> = ({ onConfirm, onCancel, initial }) => {
  const [form,    setForm]    = useState<DatosEmpresa>({ ...EMPTY, ...initial })
  const [seccion, setSeccion] = useState<Seccion>('identidad')
  const [errors,  setErrors]  = useState<Partial<Record<keyof DatosEmpresa, string>>>({})

  /* Setter estable con useCallback para no re-crear en cada render */
  const set = useCallback((k: keyof DatosEmpresa, v: string) => {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrors(prev => ({ ...prev, [k]: undefined }))
  }, [])

  /* Setters individuales estables para cada campo */
  const setNombreEmpresa      = useCallback((v: string) => set('nombreEmpresa', v), [set])
  const setTipoEmpresa        = useCallback((v: string) => set('tipoEmpresa', v), [set])
  const setSector             = useCallback((v: string) => set('sector', v), [set])
  const setTamano             = useCallback((v: string) => set('tamano', v), [set])
  const setUbicacion          = useCallback((v: string) => set('ubicacion', v), [set])
  const setAnoFundacion       = useCallback((v: string) => set('anoFundacion', v), [set])
  const setCantidadEmpleados  = useCallback((v: string) => set('cantidadEmpleados', v), [set])
  const setCertificaciones    = useCallback((v: string) => set('certificaciones', v), [set])
  const setMision             = useCallback((v: string) => set('mision', v), [set])
  const setVision             = useCallback((v: string) => set('vision', v), [set])
  const setPoliticaCalidad    = useCallback((v: string) => set('politicaCalidad', v), [set])
  const setProductosServicios = useCallback((v: string) => set('productosServicios', v), [set])
  const setMercadoObjetivo    = useCallback((v: string) => set('mercadoObjetivo', v), [set])
  const setParteInteresadas   = useCallback((v: string) => set('parteInteresadas', v), [set])
  const setAlcanceSGC         = useCallback((v: string) => set('alcanceSGC', v), [set])

  /* Navegación entre secciones */
  const validateAndNext = () => {
    const errs: typeof errors = {}
    if (seccion === 'identidad') {
      if (!form.nombreEmpresa.trim()) errs.nombreEmpresa = 'Requerido'
      if (!form.sector.trim())        errs.sector        = 'Requerido'
      if (!form.tipoEmpresa.trim())   errs.tipoEmpresa   = 'Requerido'
      if (!form.tamano.trim())        errs.tamano        = 'Requerido'
    }
    if (seccion === 'direccionamiento') {
      if (!form.mision.trim())             errs.mision             = 'Requerido'
      if (!form.vision.trim())             errs.vision             = 'Requerido'
      if (!form.productosServicios.trim()) errs.productosServicios = 'Requerido'
    }
    if (Object.keys(errs).length) { setErrors(errs); return }
    const idx = ORDER.indexOf(seccion)
    if (idx < ORDER.length - 1) setSeccion(ORDER[idx + 1])
    else handleSubmit()
  }

  const goBack = () => {
    const idx = ORDER.indexOf(seccion)
    if (idx > 0) setSeccion(ORDER[idx - 1])
  }

  const handleSubmit = () => {
    if (!form.nombreEmpresa.trim() || !form.sector.trim()) {
      setSeccion('identidad')
      setErrors({ nombreEmpresa: 'Requerido', sector: 'Requerido' })
      return
    }
    onConfirm(form)
  }

  const secciones = [
    { id: 'identidad'        as Seccion, label: 'Identidad',       icon: '🏢' },
    { id: 'direccionamiento' as Seccion, label: 'Direccionamiento', icon: '🧭' },
    { id: 'operacion'        as Seccion, label: 'Operación',        icon: '⚙️' },
    { id: 'sgc'              as Seccion, label: 'SGC',              icon: '📋' },
  ]
  const currentIdx = secciones.findIndex(s => s.id === seccion)
  const isLast     = currentIdx === secciones.length - 1

  return (
    <div className="efm-overlay" onClick={onCancel}>
      <div className="efm-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ────────────────────────────────────── */}
        <div className="efm-header">
          <div className="efm-header__title">
            <span className="efm-header__icon">🏢</span>
            <div>
              <h2>Contexto de la Organización</h2>
              <p>Completa la información de tu empresa para que la IA genere un análisis personalizado y preciso.</p>
            </div>
          </div>
          <button className="efm-close" onClick={onCancel}>✕</button>
        </div>

        {/* ── Stepper ───────────────────────────────────── */}
        <div className="efm-stepper">
          {secciones.map((s, i) => (
            <React.Fragment key={s.id}>
              <div
                className={`efm-step${i === currentIdx ? ' efm-step--active' : ''}${i < currentIdx ? ' efm-step--done' : ''}`}
                onClick={() => i < currentIdx && setSeccion(s.id)}
              >
                <div className="efm-step__circle">
                  {i < currentIdx ? '✓' : s.icon}
                </div>
                <span className="efm-step__label">{s.label}</span>
              </div>
              {i < secciones.length - 1 && (
                <div className={`efm-step__line${i < currentIdx ? ' efm-step__line--done' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Contenido ─────────────────────────────────── */}
        <div className="efm-body">

          {/* IDENTIDAD */}
          {seccion === 'identidad' && (
            <>
              <div className="efm-section-title"><span>🏢</span> Identidad de la Empresa</div>
              <div className="efm-row efm-row--2">
                <Field
                  label="Nombre de la empresa *"
                  value={form.nombreEmpresa}
                  onChange={setNombreEmpresa}
                  placeholder="Ej: Industrias XYZ S.A.S."
                  error={errors.nombreEmpresa}
                />
                <Select
                  label="Tipo de empresa *"
                  value={form.tipoEmpresa}
                  onChange={setTipoEmpresa}
                  options={TIPOS_EMPRESA}
                  error={errors.tipoEmpresa}
                />
              </div>
              <div className="efm-row efm-row--2">
                <Select
                  label="Sector / Industria *"
                  value={form.sector}
                  onChange={setSector}
                  options={SECTORES}
                  error={errors.sector}
                />
                <Select
                  label="Tamaño de la empresa *"
                  value={form.tamano}
                  onChange={setTamano}
                  options={TAMANIOS}
                  error={errors.tamano}
                />
              </div>
              <div className="efm-row efm-row--2">
                <Field
                  label="Ciudad / Ubicación"
                  value={form.ubicacion}
                  onChange={setUbicacion}
                  placeholder="Ej: Barranquilla, Atlántico, Colombia"
                />
                <Field
                  label="Año de fundación"
                  value={form.anoFundacion}
                  onChange={setAnoFundacion}
                  placeholder="Ej: 2010"
                />
              </div>
              <div className="efm-row efm-row--2">
                <Field
                  label="Número de empleados"
                  value={form.cantidadEmpleados}
                  onChange={setCantidadEmpleados}
                  placeholder="Ej: 45"
                />
                <Field
                  label="Certificaciones actuales"
                  value={form.certificaciones}
                  onChange={setCertificaciones}
                  placeholder="Ej: ISO 14001, OHSAS 18001..."
                />
              </div>
            </>
          )}

          {/* DIRECCIONAMIENTO */}
          {seccion === 'direccionamiento' && (
            <>
              <div className="efm-section-title"><span>🧭</span> Direccionamiento Estratégico</div>
              <Textarea
                label="Misión *"
                value={form.mision}
                onChange={setMision}
                placeholder="¿Qué hace la empresa, para quién y cómo lo hace?"
                hint="Describe el propósito fundamental de la organización."
                error={errors.mision}
              />
              <Textarea
                label="Visión *"
                value={form.vision}
                onChange={setVision}
                placeholder="¿Dónde quiere estar la empresa en 5–10 años?"
                hint="Describe el estado futuro deseado."
                error={errors.vision}
              />
              <Textarea
                label="Política de Calidad"
                value={form.politicaCalidad}
                onChange={setPoliticaCalidad}
                placeholder="Declaración formal del compromiso con la calidad..."
                hint="Si no la tienes definida, la IA puede ayudarte a construirla."
              />
              <Textarea
                label="Productos y/o Servicios que ofrece *"
                value={form.productosServicios}
                onChange={setProductosServicios}
                placeholder="Describe los principales productos y servicios..."
                error={errors.productosServicios}
              />
            </>
          )}

          {/* OPERACIÓN */}
          {seccion === 'operacion' && (
            <>
              <div className="efm-section-title"><span>⚙️</span> Contexto Operacional</div>
              <Textarea
                label="Mercado objetivo / Clientes principales"
                value={form.mercadoObjetivo}
                onChange={setMercadoObjetivo}
                placeholder="Describe a quiénes van dirigidos los productos/servicios: segmentos, geografías, tipos de cliente..."
              />
              <Textarea
                label="Partes interesadas relevantes"
                value={form.parteInteresadas}
                onChange={setParteInteresadas}
                placeholder="Ej: clientes, empleados, proveedores, accionistas, entes reguladores, comunidad..."
                hint="§4.2 — Identifica las partes interesadas y sus necesidades y expectativas."
              />
            </>
          )}

          {/* SGC */}
          {seccion === 'sgc' && (
            <>
              <div className="efm-section-title"><span>📋</span> Sistema de Gestión de Calidad</div>
              <Textarea
                label="Alcance del SGC"
                value={form.alcanceSGC}
                onChange={setAlcanceSGC}
                rows={4}
                placeholder={'Ej: "Diseño, desarrollo y comercialización de software para el sector financiero en Colombia."'}
                hint="§4.3 — El alcance determina los límites y la aplicabilidad del SGC."
              />
              <div className="efm-info-box">
                <span>✅</span>
                <div>
                  <strong>¡Todo listo para el análisis!</strong>
                  <p>
                    Con esta información, Governex generará PESTEL, DOFA, Caracterización de Procesos
                    y un <strong>análisis narrativo del contexto organizacional</strong> específico
                    para <strong>{form.nombreEmpresa || 'tu empresa'}</strong>.
                  </p>
                </div>
              </div>
            </>
          )}

        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div className="efm-footer">
          <button className="efm-btn efm-btn--secondary" onClick={currentIdx === 0 ? onCancel : goBack}>
            {currentIdx === 0 ? 'Cancelar' : '← Anterior'}
          </button>
          <div className="efm-footer__right">
            <span className="efm-progress-text">Paso {currentIdx + 1} de {secciones.length}</span>
            <button className="efm-btn efm-btn--primary" onClick={validateAndNext}>
              {isLast ? '🤖 Analizar con Governex →' : 'Siguiente →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default EmpresaFormModal