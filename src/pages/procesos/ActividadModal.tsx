/**
 * ActividadModal.tsx — Governex · ISO 9001:2015 §4.1 / §8.1
 *
 * Modal para registrar actividades propias de la empresa.
 * v3: Objetivo e Indicador se generan via /api/gemini/generar-objetivo-indicador
 *     (ya no se llama directamente a Anthropic desde el frontend).
 */

import React, { useState, useCallback } from 'react'
import { ActividadEmpresa, EntradaSalida } from '../../context/AIAnalysisContext'
import './ActividadModal.css'
import { api } from '../../services/api'

/* ── Helpers ─────────────────────────────────────────────────── */
function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
function newItem(): EntradaSalida {
  return { id: newId(), valor: '' }
}

/* ── Props ───────────────────────────────────────────────────── */
interface Props {
  procesosDisponibles?: string[]
  onGuardar: (actividad: ActividadEmpresa) => void
  onCerrar:  () => void
}

/* ── Fila editable de entrada/salida ─────────────────────────── */
interface ItemRowProps {
  item:        EntradaSalida
  placeholder: string
  onChange:    (id: string, valor: string) => void
  onRemove:    (id: string) => void
  canRemove:   boolean
}

const ItemRow: React.FC<ItemRowProps> = ({ item, placeholder, onChange, onRemove, canRemove }) => (
  <div className="act-modal__item-row">
    <input
      className="act-modal__item-input"
      placeholder={placeholder}
      value={item.valor}
      onChange={e => onChange(item.id, e.target.value)}
      maxLength={200}
    />
    {canRemove && (
      <button
        type="button"
        className="act-modal__item-del"
        onClick={() => onRemove(item.id)}
        title="Eliminar"
      >
        ✕
      </button>
    )}
  </div>
)

/* ── Llamada al backend Gemini ───────────────────────────────── */
async function generarObjetivoEIndicador(
  nombre:      string,
  proceso:     string,
  entradas:    string[],
  salidas:     string[],
  responsable: string,
): Promise<{ objetivo: string; indicador: string }> {
  return api.post('/api/gemini/generar-objetivo-indicador', {
    nombre, proceso, responsable, entradas, salidas,
  })
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════════ */
const ActividadModal: React.FC<Props> = ({ procesosDisponibles = [], onGuardar, onCerrar }) => {
  const [nombre,      setNombre]      = useState('')
  const [proceso,     setProceso]     = useState('')
  const [responsable, setResponsable] = useState('')
  const [entradas,    setEntradas]    = useState<EntradaSalida[]>([newItem()])
  const [salidas,     setSalidas]     = useState<EntradaSalida[]>([newItem()])
  const [error,       setError]       = useState('')

  /* IA: objetivo e indicador generados */
  const [objetivo,    setObjetivo]    = useState('')
  const [indicador,   setIndicador]   = useState('')
  const [aiLoading,   setAiLoading]   = useState(false)
  const [aiGenerated, setAiGenerated] = useState(false)

  /* ── Entradas ──────────────────────────────────────────────── */
  const addEntrada    = useCallback(() => setEntradas(prev => [...prev, newItem()]), [])
  const updateEntrada = useCallback((id: string, valor: string) =>
    setEntradas(prev => prev.map(e => e.id === id ? { ...e, valor } : e)), [])
  const removeEntrada = useCallback((id: string) =>
    setEntradas(prev => prev.filter(e => e.id !== id)), [])

  /* ── Salidas ───────────────────────────────────────────────── */
  const addSalida    = useCallback(() => setSalidas(prev => [...prev, newItem()]), [])
  const updateSalida = useCallback((id: string, valor: string) =>
    setSalidas(prev => prev.map(s => s.id === id ? { ...s, valor } : s)), [])
  const removeSalida = useCallback((id: string) =>
    setSalidas(prev => prev.filter(s => s.id !== id)), [])

  /* ── Generar con IA ────────────────────────────────────────── */
  const handleGenerarIA = useCallback(async () => {
    if (!nombre.trim())      { setError('Ingresa el nombre de la actividad antes de generar con IA.'); return }
    if (!responsable.trim()) { setError('Ingresa el responsable antes de generar con IA.'); return }
    const entradasValidas = entradas.filter(e => e.valor.trim()).map(e => e.valor)
    const salidasValidas  = salidas.filter(s => s.valor.trim()).map(s => s.valor)
    if (entradasValidas.length === 0 && salidasValidas.length === 0) {
      setError('Agrega al menos una entrada o salida antes de generar con IA.')
      return
    }
    setError('')
    setAiLoading(true)
    try {
      const result = await generarObjetivoEIndicador(
        nombre.trim(), proceso.trim(), entradasValidas, salidasValidas, responsable.trim()
      )
      setObjetivo(result.objetivo)
      setIndicador(result.indicador)
      setAiGenerated(true)
    } catch (e: any) {
      setError(
        e?.message
          ? `No se pudo generar con IA: ${e.message}. Puedes ingresar el objetivo e indicador manualmente.`
          : 'No se pudo generar con IA. Puedes ingresar el objetivo e indicador manualmente.'
      )
      setAiGenerated(false)
    } finally {
      setAiLoading(false)
    }
  }, [nombre, proceso, responsable, entradas, salidas])

  /* ── Guardar ───────────────────────────────────────────────── */
  const handleGuardar = () => {
    if (!nombre.trim())      { setError('El nombre de la actividad es obligatorio.'); return }
    if (!responsable.trim()) { setError('El responsable es obligatorio.'); return }
    const entradasLimpias = entradas.filter(e => e.valor.trim())
    const salidasLimpias  = salidas.filter(s => s.valor.trim())
    if (entradasLimpias.length === 0 && salidasLimpias.length === 0) {
      setError('Agrega al menos una entrada o una salida.'); return
    }
    setError('')
    onGuardar({
      id:          newId(),
      nombre:      nombre.trim(),
      proceso:     proceso.trim(),
      responsable: responsable.trim(),
      objetivo:    objetivo.trim(),
      indicador:   indicador.trim(),
      entradas:    entradasLimpias,
      salidas:     salidasLimpias,
      creadaEn:    new Date().toISOString(),
    })
  }

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="act-modal__overlay" onClick={onCerrar}>
      <div
        className="act-modal__dialog"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="act-modal-title"
        style={{
          display:       'flex',
          flexDirection: 'column',
        }}
      >
        {/* Encabezado — fijo, no hace scroll */}
        <div className="act-modal__header" style={{ flexShrink: 0 }}>
          <div className="act-modal__header-left">
            <span className="act-modal__header-icon">⚙️</span>
            <div>
              <h3 id="act-modal-title" className="act-modal__title">
                Registrar Actividad de la Empresa
              </h3>
              <p className="act-modal__subtitle">
                4.1 Caracterización · Las entradas y salidas se propagarán a 6.1 y 8.1
              </p>
            </div>
          </div>
          <button className="act-modal__close" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        {/* Cuerpo — scrolleable */}
        <div className="act-modal__body">
          {/* Info box */}
          <div className="act-modal__info-box">
            <span>💡</span>
            <span>
              Cada <strong>entrada</strong> genera un <em>Riesgo</em> en la Matriz 6.1.
              Cada <strong>salida</strong> genera una <em>Oportunidad</em>.
              El <strong>Objetivo</strong> e <strong>Indicador</strong> se generan automáticamente con IA.
            </span>
          </div>

          {/* Nombre */}
          <div className="act-modal__field">
            <label className="act-modal__label" htmlFor="act-nombre">
              Nombre de la actividad <span className="act-modal__required">*</span>
            </label>
            <input
              id="act-nombre"
              className="act-modal__input"
              placeholder="Ej: Fabricación de piezas metálicas, Atención al cliente…"
              value={nombre}
              onChange={e => { setNombre(e.target.value); setError(''); setAiGenerated(false) }}
              maxLength={120}
            />
          </div>

          {/* Proceso asociado */}
          <div className="act-modal__field">
            <label className="act-modal__label" htmlFor="act-proceso">
              Proceso asociado <span className="act-modal__optional">(opcional)</span>
            </label>
            {procesosDisponibles.length > 0 ? (
              <select
                id="act-proceso"
                className="act-modal__select"
                value={proceso}
                onChange={e => setProceso(e.target.value)}
              >
                <option value="">— Sin proceso asociado —</option>
                {procesosDisponibles.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input
                id="act-proceso"
                className="act-modal__input"
                placeholder="Ej: Producción, Ventas, Gestión de Talento Humano…"
                value={proceso}
                onChange={e => setProceso(e.target.value)}
                maxLength={100}
              />
            )}
          </div>

          {/* Responsable */}
          <div className="act-modal__field">
            <label className="act-modal__label" htmlFor="act-responsable">
              Responsable <span className="act-modal__required">*</span>
            </label>
            <input
              id="act-responsable"
              className="act-modal__input"
              placeholder="Ej: Jefe de Producción, Coordinador de Calidad, Gerente Comercial…"
              value={responsable}
              onChange={e => { setResponsable(e.target.value); setError('') }}
              maxLength={100}
            />
          </div>

          {/* Entradas y Salidas */}
          <div className="act-modal__io-grid">
            {/* Entradas */}
            <div className="act-modal__io-col act-modal__io-col--entradas">
              <div className="act-modal__io-header">
                <span className="act-modal__io-icon">📥</span>
                <div>
                  <div className="act-modal__io-title">Entradas</div>
                  <div className="act-modal__io-desc">
                    Recursos, información o materiales que la actividad necesita
                  </div>
                </div>
              </div>
              <div className="act-modal__items">
                {entradas.map(e => (
                  <ItemRow
                    key={e.id}
                    item={e}
                    placeholder="Ej: Orden de compra, Materia prima…"
                    onChange={updateEntrada}
                    onRemove={removeEntrada}
                    canRemove={entradas.length > 1}
                  />
                ))}
              </div>
              <button
                type="button"
                className="act-modal__add-btn act-modal__add-btn--entrada"
                onClick={addEntrada}
              >
                + Agregar entrada
              </button>
            </div>

            {/* Divisor */}
            <div className="act-modal__io-divider">
              <div className="act-modal__io-divider-line" />
              <span className="act-modal__io-divider-icon">⟶</span>
              <div className="act-modal__io-divider-line" />
            </div>

            {/* Salidas */}
            <div className="act-modal__io-col act-modal__io-col--salidas">
              <div className="act-modal__io-header">
                <span className="act-modal__io-icon">📤</span>
                <div>
                  <div className="act-modal__io-title">Salidas</div>
                  <div className="act-modal__io-desc">
                    Productos, servicios o resultados que genera la actividad
                  </div>
                </div>
              </div>
              <div className="act-modal__items">
                {salidas.map(s => (
                  <ItemRow
                    key={s.id}
                    item={s}
                    placeholder="Ej: Producto terminado, Informe, Factura…"
                    onChange={updateSalida}
                    onRemove={removeSalida}
                    canRemove={salidas.length > 1}
                  />
                ))}
              </div>
              <button
                type="button"
                className="act-modal__add-btn act-modal__add-btn--salida"
                onClick={addSalida}
              >
                + Agregar salida
              </button>
            </div>
          </div>

          {/* Sección IA: Objetivo e Indicador */}
          <div style={{
            border:       '1.5px solid #e0eaff',
            borderRadius: '0.75rem',
            overflow:     'hidden',
            background:   '#f8fbff',
          }}>
            {/* Header sección IA */}
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        '0.75rem 1rem',
              background:     'linear-gradient(135deg, #eff6ff, #e8f0fe)',
              borderBottom:   '1px solid #dbeafe',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>✨</span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>
                    Objetivo e Indicador — Generados por IA
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                    Completa el formulario y pulsa el botón para generar automáticamente
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerarIA}
                disabled={aiLoading}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '0.4rem',
                  background:   aiLoading ? '#e5e7eb' : 'linear-gradient(135deg, #1a6ebd, #1a5a9e)',
                  color:        aiLoading ? '#9ca3af' : '#fff',
                  border:       'none',
                  borderRadius: '0.5rem',
                  padding:      '0.45rem 1rem',
                  fontSize:     '0.8rem',
                  fontWeight:   700,
                  cursor:       aiLoading ? 'not-allowed' : 'pointer',
                  fontFamily:   'inherit',
                  transition:   'all 0.15s',
                  boxShadow:    aiLoading ? 'none' : '0 2px 8px rgba(26,110,189,0.25)',
                  flexShrink:   0,
                }}
              >
                {aiLoading ? (
                  <>
                    <span style={{
                      width: 14, height: 14,
                      border: '2px solid #9ca3af',
                      borderTop: '2px solid #6b7280',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'act-spin 0.8s linear infinite',
                    }} />
                    Generando…
                  </>
                ) : (
                  <>✨ {aiGenerated ? 'Regenerar con IA' : 'Generar con IA'}</>
                )}
              </button>
            </div>

            {/* Campos objetivo e indicador */}
            <div style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Objetivo */}
              <div className="act-modal__field">
                <label className="act-modal__label" htmlFor="act-objetivo">
                  Objetivo
                  {aiGenerated && (
                    <span style={{
                      marginLeft:   '0.4rem',
                      background:   '#eff6ff',
                      color:        '#1e40af',
                      fontSize:     '0.65rem',
                      fontWeight:   700,
                      padding:      '0.1rem 0.4rem',
                      borderRadius: 999,
                    }}>✨ IA</span>
                  )}
                  <span className="act-modal__optional"> (editable)</span>
                </label>
                <textarea
                  id="act-objetivo"
                  className="act-modal__input"
                  rows={2}
                  placeholder={aiLoading ? 'Generando objetivo…' : 'Se generará automáticamente al pulsar "Generar con IA"…'}
                  value={objetivo}
                  onChange={e => setObjetivo(e.target.value)}
                  maxLength={400}
                  style={{
                    resize:     'vertical',
                    fontFamily: 'inherit',
                    fontSize:   '0.87rem',
                    lineHeight: 1.5,
                    background: aiLoading ? '#f3f4f6' : '#fff',
                  }}
                />
              </div>

              {/* Indicador */}
              <div className="act-modal__field">
                <label className="act-modal__label" htmlFor="act-indicador">
                  Indicador de desempeño
                  {aiGenerated && (
                    <span style={{
                      marginLeft:   '0.4rem',
                      background:   '#f0fdf4',
                      color:        '#166534',
                      fontSize:     '0.65rem',
                      fontWeight:   700,
                      padding:      '0.1rem 0.4rem',
                      borderRadius: 999,
                    }}>✨ IA</span>
                  )}
                  <span className="act-modal__optional"> (editable)</span>
                </label>
                <input
                  id="act-indicador"
                  className="act-modal__input"
                  placeholder={aiLoading ? 'Generando indicador…' : 'Se generará automáticamente al pulsar "Generar con IA"…'}
                  value={indicador}
                  onChange={e => setIndicador(e.target.value)}
                  maxLength={300}
                  style={{ background: aiLoading ? '#f3f4f6' : '#fff' }}
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="act-modal__error">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Footer — fijo, no hace scroll */}
        <div className="act-modal__footer" style={{ flexShrink: 0 }}>
          <button type="button" className="act-modal__btn-cancel" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="act-modal__btn-save"
            onClick={handleGuardar}
            disabled={aiLoading}
          >
            Guardar actividad →
          </button>
        </div>
      </div>

      {/* Keyframe para spinner */}
      <style>{`@keyframes act-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default ActividadModal