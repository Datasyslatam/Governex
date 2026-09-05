import React, { useState, useRef } from 'react'
import {
  perfilesCargoService,
  geminiCompetenciasService,
  uploadsService,
  PerfilCargo,
  competenciasService
} from '../../services'

interface ModalPerfilCargoProps {
  onClose: () => void
  onSaved: () => void
  procesos: { id: number; nombre: string }[]
  canEdit: boolean
}

export const ModalPerfilCargo: React.FC<ModalPerfilCargoProps> = ({ onClose, onSaved, procesos, canEdit }) => {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Data
  const [file, setFile] = useState<File | null>(null)
  const [cargo, setCargo] = useState('')
  const [procesoId, setProcesoId] = useState<number | ''>('')
  const [perfilId, setPerfilId] = useState<number | null>(null)
  
  // IA results
  const [requisitos, setRequisitos] = useState({ educacion: '', formacion: '', experiencia: '' })
  const [checklists, setChecklists] = useState({ desempeno: [] as string[], conocimiento: [] as string[] })
  const [temasPlan, setTemasPlan] = useState<string[]>([])
  
  const [necesidad, setNecesidad] = useState('')
  const [necesidadesGuardadas, setNecesidadesGuardadas] = useState<string[]>([])

  const fileRef = useRef<HTMLInputElement>(null)

  const handleAnalizarManual = async () => {
    if (!file || !cargo) {
      setError('Por favor ingresa el nombre del cargo y sube un PDF.')
      return
    }
    setError('')
    setLoading(true)
    try {
      // 1. Upload file
      const uploaded = await uploadsService.upload(file)
      
      // 2. Analizar PDF con IA
      const base64 = await toBase64(file)
      const resIA = await geminiCompetenciasService.analizarManual({ base64, mimeType: file.type })
      
      setRequisitos({
        educacion: resIA.educacion || '',
        formacion: resIA.formacion || '',
        experiencia: resIA.experiencia || ''
      })
      
      // 3. Crear perfil base
      const newPerfil = await perfilesCargoService.create({
        cargo,
        proceso_id: procesoId === '' ? undefined : Number(procesoId),
        archivo_key: uploaded.key,
        archivo_nombre: uploaded.nombre
      })
      
      setPerfilId(newPerfil.id)
      setStep(2)
    } catch (err: any) {
      setError(err.message || 'Error al analizar el manual')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerarChecklists = async () => {
    if (!perfilId) return
    setError('')
    setLoading(true)
    try {
      const base64 = file ? await toBase64(file) : undefined
      const resIA = await geminiCompetenciasService.generarChecklist({
        base64, mimeType: file?.type,
        educacion: requisitos.educacion, formacion: requisitos.formacion, experiencia: requisitos.experiencia
      })
      
      setChecklists({
        desempeno: resIA.desempeno || [],
        conocimiento: resIA.conocimiento || []
      })
      
      // Update perfil with checklists and requisitos
      await perfilesCargoService.update(perfilId, {
        ...requisitos,
        checklist_desempeno: resIA.desempeno || [],
        checklist_conocimiento: resIA.conocimiento || []
      })
      
      setStep(3)
    } catch (err: any) {
      setError(err.message || 'Error al generar checklists')
    } finally {
      setLoading(false)
    }
  }

  const handleAgregarNecesidad = async () => {
    if (!necesidad || !perfilId) return
    setLoading(true)
    try {
      await perfilesCargoService.addNecesidad(perfilId, necesidad)
      setNecesidadesGuardadas([...necesidadesGuardadas, necesidad])
      setNecesidad('')
    } catch (err: any) {
      setError(err.message || 'Error al agregar necesidad')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerarPlan = async () => {
    if (!perfilId) return
    setError('')
    setLoading(true)
    try {
      const resIA = await geminiCompetenciasService.generarPlan({
        cargo,
        checklistDesempeno: checklists.desempeno,
        checklistConocimiento: checklists.conocimiento,
        necesidades: necesidadesGuardadas
      })
      
      const temas: string[] = resIA.temas || []
      setTemasPlan(temas)
      
      // Auto-create plan de formacion entries
      for (const tema of temas) {
        await competenciasService.createPlan({
          tema,
          fecha: '',
          estado: 'Planificado',
          perfil_cargo_id: perfilId,
          generado_con_ia: true
        })
      }
      
      setStep(4)
    } catch (err: any) {
      setError(err.message || 'Error al generar plan')
    } finally {
      setLoading(false)
    }
  }

  const toBase64 = (f: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(f)
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = error => reject(error)
  })

  return (
    <div className="modal-overlay" onClick={onClose}> <div className="modal-card modal-perfil-cargo" onClick={e => e.stopPropagation()}> <div className="modal-header"> <h3> Asistente IA de Perfiles de Cargo</h3> <button className="modal-close" onClick={onClose}></button> </div> <div className="modal-body">
          {/* STEP PROGRESS */}
          <div className="step-progress"> <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Subida PDF</div> <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Requisitos</div> <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Listas de Chequeo</div> <div className={`step ${step >= 4 ? 'active' : ''}`}>4. Plan Sugerido</div> </div>
          
          {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}
          
          {/* STEP 1: Upload */}
          {step === 1 && (
            <div className="step-content"> <p>Sube el <strong>Manual de Funciones</strong> en PDF. La IA extraerá los requisitos necesarios.</p> <div className="form-group"> <label>Cargo *</label> <input type="text" className="form-control" value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ej. Operario de Máquina" /> </div> <div className="form-group"> <label>Proceso Asociado</label> <select className="form-control" value={procesoId} onChange={e => setProcesoId(e.target.value as any)}> <option value="">(Ninguno)</option>
                  {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select> </div> <div className="form-group modern-form-group"> <label>Manual de Funciones (PDF) *</label> <div className="custom-file-upload"> <input type="file" id="pdf-upload" accept="application/pdf" 
                         onChange={e => setFile(e.target.files?.[0] || null)} hidden /> <label htmlFor="pdf-upload" className={`file-dropzone ${file ? 'has-file' : ''}`}> <div className="file-icon">{file ? '' : ''}</div> <div className="file-text">
                      {file ? (
                        <> <span className="filename">{file.name}</span> <span className="file-change">Haz clic para cambiar de archivo</span> </>
                      ) : (
                        'Haz clic o arrastra aquí tu archivo PDF'
                      )}
                    </div> </label> </div> </div> </div>
          )}
          
          {/* STEP 2: Requisitos Extraídos */}
          {step === 2 && (
            <div className="step-content"> <p>Requisitos extraídos por IA. Puedes editarlos antes de continuar.</p> <div className="form-group"> <label>Educación</label> <textarea className="form-control" value={requisitos.educacion} onChange={e => setRequisitos({...requisitos, educacion: e.target.value})} rows={2} /> </div> <div className="form-group"> <label>Formación</label> <textarea className="form-control" value={requisitos.formacion} onChange={e => setRequisitos({...requisitos, formacion: e.target.value})} rows={2} /> </div> <div className="form-group"> <label>Experiencia</label> <textarea className="form-control" value={requisitos.experiencia} onChange={e => setRequisitos({...requisitos, experiencia: e.target.value})} rows={2} /> </div> </div>
          )}

          {/* STEP 3: Checklists y Necesidades */}
          {step === 3 && (
            <div className="step-content"> <p>Listas de chequeo generadas. Agrega necesidades adicionales del día a día para enriquecer el Plan de Capacitación.</p> <div className="checklists-container"> <div className="checklist-box"> <h4> Desempeño</h4> <ul>
                    {checklists.desempeno.map((item, i) => <li key={i}>{item}</li>)}
                  </ul> </div> <div className="checklist-box"> <h4> Conocimiento</h4> <ul>
                    {checklists.conocimiento.map((item, i) => <li key={i}>{item}</li>)}
                  </ul> </div> </div> <div className="necesidades-section"> <h4>Necesidades Adicionales Identificadas</h4> <ul>
                  {necesidadesGuardadas.map((n, i) => <li key={i}>{n}</li>)}
                </ul> <div className="add-necesidad"> <input type="text" className="form-control" value={necesidad} onChange={e => setNecesidad(e.target.value)} placeholder="Ej. Dificultad usando el nuevo ERP..." /> <button className="btn btn--secondary" onClick={handleAgregarNecesidad} disabled={!necesidad || loading}>Agregar</button> </div> </div> </div>
          )}

          {/* STEP 4: Plan Sugerido */}
          {step === 4 && (
            <div className="step-content"> <div className="success-banner">
                ¡Plan de capacitación generado y agregado a la barra lateral!
              </div> <h4>Temas Sugeridos por IA:</h4> <ul className="temas-list">
                {temasPlan.map((tema, i) => (
                  <li key={i}> {tema}</li>
                ))}
              </ul> </div>
          )}

        </div> <div className="modal-footer">
          {step === 1 && <button className="btn btn--secondary" onClick={onClose}>Cancelar</button>}
          {step === 1 && <button className="btn btn--primary" onClick={handleAnalizarManual} disabled={loading || !file || !cargo}>
            {loading ? 'Analizando...' : 'Siguiente: Extraer Requisitos '}
          </button>}
          
          {step === 2 && <button className="btn btn--primary" onClick={handleGenerarChecklists} disabled={loading}>
            {loading ? 'Generando...' : 'Siguiente: Generar Listas '}
          </button>}
          
          {step === 3 && <button className="btn btn--primary" onClick={handleGenerarPlan} disabled={loading}>
            {loading ? 'Generando Plan...' : 'Siguiente: Plan de Capacitación '}
          </button>}

          {step === 4 && <button className="btn btn--primary" onClick={() => { onSaved(); onClose() }}>
            Finalizar
          </button>}
        </div> </div> </div>
  )
}
