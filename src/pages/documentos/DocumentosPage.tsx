import React, { useState } from "react";
import "./DocumentosPage.css";

interface Documento {
  codigo: string;
  titulo: string;
  tipo: "Manual" | "Política" | "Proceso" | "Instr." | "Formato";
  version: string;
  estado: "Aprobado" | "En Revision" | "Borrador" | "Obsoleto";
  proceso: string;
  hash?: string;
  elaborado_por?: string;
  fecha_elaboracion?: string;
}

const documentosInicial: Documento[] = [
  { codigo: "MAN-001", titulo: "Manual del SGC", tipo: "Manual", version: "v4.0", estado: "Aprobado", proceso: "Calidad" },
  { codigo: "POL-001", titulo: "Política de Calidad", tipo: "Política", version: "v3.1", estado: "Aprobado", proceso: "Calidad" },
  { codigo: "PRO-010", titulo: "Control de Documentos", tipo: "Proceso", version: "v5.2", estado: "Aprobado", proceso: "Calidad" },
  { codigo: "PRO-023", titulo: "Gestion de Proveedores", tipo: "Proceso", version: "v3.0", estado: "En Revision", proceso: "Compras" },
  { codigo: "PRO-031", titulo: "Auditoria Interna", tipo: "Proceso", version: "v2.1", estado: "Aprobado", proceso: "Calidad" },
  { codigo: "INS-007", titulo: "Calibracion de Equipos", tipo: "Instr.", version: "v1.3", estado: "Aprobado", proceso: "Produccion" },
  { codigo: "FOR-015", titulo: "Registro NC", tipo: "Formato", version: "v2.0", estado: "Aprobado", proceso: "Calidad" },
  { codigo: "PRO-044", titulo: "Diseno y Desarrollo", tipo: "Proceso", version: "v1.0", estado: "Borrador", proceso: "Ingenieria" },
  { codigo: "FOR-022", titulo: "Evaluacion Proveedores", tipo: "Formato", version: "v1.5", estado: "Aprobado", proceso: "Compras" },
];

const DocumentosPage: React.FC = () => {
  const [documentos, setDocumentos] = useState<Documento[]>(documentosInicial);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [showModalNuevo, setShowModalNuevo] = useState(false);
  const [editingCodigo, setEditingCodigo] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(documentosInicial[3]);

  const [formData, setFormData] = useState<Documento>({
    codigo: "",
    titulo: "",
    tipo: "Proceso",
    version: "v1.0",
    estado: "Borrador",
    proceso: "",
  });

  const documentosFiltrados = documentos.filter(doc => {
    const coincideBusqueda = doc.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
                            doc.titulo.toLowerCase().includes(busqueda.toLowerCase());
    const coincideTipo = !filtroTipo || doc.tipo === filtroTipo;
    const coincideEstado = !filtroEstado || doc.estado === filtroEstado;
    return coincideBusqueda && coincideTipo && coincideEstado;
  });

  const abrirModalNuevo = (doc?: Documento) => {
    if (doc) {
      setFormData(doc);
      setEditingCodigo(doc.codigo);
    } else {
      setFormData({
        codigo: `DOC-${String(documentos.length + 1).padStart(3, "0")}`,
        titulo: "",
        tipo: "Proceso",
        version: "v1.0",
        estado: "Borrador",
        proceso: "",
      });
      setEditingCodigo(null);
    }
    setShowModalNuevo(true);
  };

  const guardarDocumento = () => {
    if (!formData.titulo || !formData.proceso) {
      alert("Completa título y proceso");
      return;
    }

    if (editingCodigo) {
      const updated = documentos.map(d =>
        d.codigo === editingCodigo ? formData : d
      );
      setDocumentos(updated);
      setSelectedDoc(formData);
    } else {
      setDocumentos([...documentos, formData]);
      setSelectedDoc(formData);
    }
    setShowModalNuevo(false);
  };

  const eliminarDocumento = (codigo: string) => {
    if (confirm("¿Eliminar este documento?")) {
      setDocumentos(documentos.filter(d => d.codigo !== codigo));
      if (selectedDoc?.codigo === codigo) {
        setSelectedDoc(null);
      }
    }
  };

  const cambiarEstado = (codigo: string, nuevoEstado: Documento["estado"]) => {
    const updated = documentos.map(d =>
      d.codigo === codigo ? { ...d, estado: nuevoEstado } : d
    );
    setDocumentos(updated);
    if (selectedDoc?.codigo === codigo) {
      setSelectedDoc({ ...selectedDoc, estado: nuevoEstado });
    }
  };

  const tiposDisponibles = Array.from(new Set(documentos.map(d => d.tipo)));

  return (
    <div className="page docs-page">
      {/* ── Topbar ── */}
      <div className="docs-topbar">
        <div className="docs-topbar__left">
          <h2>Gestión Documental — Control de Versiones</h2>
          <span>Governex — Cap. 7.5 — Información Documentada</span>
        </div>
        <div className="docs-topbar__right">
          <button className="btn btn--primary" onClick={() => abrirModalNuevo()}>+ Nuevo Documento</button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="docs-filter-bar">
        <div className="docs-search-wrapper">
          <input 
            type="text" 
            className="docs-search-input" 
            placeholder="Buscar por código o título..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="docs-nav-tabs">
          <button 
            className={`docs-tab ${!filtroTipo ? "docs-tab--active" : ""}`}
            onClick={() => setFiltroTipo("")}
          >
            Todos ({documentos.length})
          </button>
          {tiposDisponibles.map(tipo => (
            <button 
              key={tipo}
              className={`docs-tab ${filtroTipo === tipo ? "docs-tab--active" : ""}`}
              onClick={() => setFiltroTipo(tipo)}
            >
              {tipo}
            </button>
          ))}
        </div>
        <div className="docs-status-filters">
          <select 
            className="docs-filter-select"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los Estados</option>
            <option value="Aprobado">Aprobado</option>
            <option value="En Revision">En Revision</option>
            <option value="Borrador">Borrador</option>
            <option value="Obsoleto">Obsoleto</option>
          </select>
        </div>
      </div>

      {/* ── Contenido Principal ── */}
      <div className="docs-main-grid">
        {/* Tabla Izquierda */}
        <div className="docs-table-container panel">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Título del Documento</th>
                <th>Tipo</th>
                <th>Proceso</th>
                <th>Versión</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documentosFiltrados.map((doc, i) => (
                <tr 
                  key={i} 
                  className={selectedDoc?.codigo === doc.codigo ? "row-active" : ""}
                  onClick={() => setSelectedDoc(doc)}
                >
                  <td className="doc-code text-blue">{doc.codigo}</td>
                  <td className="doc-title">{doc.titulo}</td>
                  <td>
                    <span className={`type-badge type-${doc.tipo.toLowerCase().replace('.', '')}`}>{doc.tipo}</span>
                  </td>
                  <td className="doc-process">{doc.proceso}</td>
                  <td className="doc-version">{doc.version}</td>
                  <td>
                    <span className={`status-pill ${
                      doc.estado === 'Aprobado' ? 'bg-light-green text-green' :
                      doc.estado === 'En Revision' ? 'bg-light-orange text-orange' :
                      doc.estado === 'Borrador' ? 'bg-light-blue text-blue' :
                      'bg-light-gray text-gray'
                    }`}>
                      {doc.estado}
                    </span>
                  </td>
                  <td style={{display: "flex", gap: "0.5rem"}}>
                    <button 
                      className="btn btn--small" 
                      style={{padding: "0.4rem 0.6rem", fontSize: "0.8rem"}}
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirModalNuevo(doc);
                      }}
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn btn--small" 
                      style={{padding: "0.4rem 0.6rem", fontSize: "0.8rem", background: "#ef4444", color: "white"}}
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminarDocumento(doc.codigo);
                      }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {documentosFiltrados.length === 0 && (
            <div style={{padding: "1rem", textAlign: "center", color: "#999"}}>
              No hay documentos que coincidan con los filtros
            </div>
          )}
        </div>

        {/* Panel Derecho de Detalles */}
        <div className="docs-detail-panel panel">
          {selectedDoc ? (
            <>
              {/* Header del panel derecho */}
              <div className="detail-header">
                <div className="detail-header-top">
                  <span className={`status-pill status-pill--large ${
                    selectedDoc.estado === 'Aprobado' ? 'bg-light-green text-green' :
                    selectedDoc.estado === 'En Revision' ? 'bg-light-orange text-orange' :
                    selectedDoc.estado === 'Borrador' ? 'bg-light-blue text-blue' :
                    'bg-light-gray text-gray'
                  }`}>
                    {selectedDoc.estado}
                  </span>
                  <h3 className="detail-title">{selectedDoc.codigo} — {selectedDoc.titulo}</h3>
                </div>
              </div>

              {/* Información del Documento */}
              <div className="detail-section">
                <h4 className="detail-section-title">Información</h4>
                <div style={{display: "grid", gap: "0.75rem"}}>
                  <div><strong>Tipo:</strong> {selectedDoc.tipo}</div>
                  <div><strong>Versión:</strong> {selectedDoc.version}</div>
                  <div><strong>Proceso:</strong> {selectedDoc.proceso}</div>
                </div>
              </div>

              <hr className="detail-divider" />

              {/* Cambiar Estado */}
              <div className="detail-section">
                <h4 className="detail-section-title">Cambiar Estado</h4>
                <div style={{display: "flex", gap: "0.5rem", flexWrap: "wrap"}}>
                  {(["Borrador", "En Revision", "Aprobado", "Obsoleto"] as const).map(estado => (
                    <button
                      key={estado}
                      className="btn btn--small"
                      style={{
                        background: selectedDoc.estado === estado ? "#1e40af" : "#e5e7eb",
                        color: selectedDoc.estado === estado ? "white" : "#1f2937",
                      }}
                      onClick={() => cambiarEstado(selectedDoc.codigo, estado)}
                    >
                      {estado}
                    </button>
                  ))}
                </div>
              </div>

              <hr className="detail-divider" />

              {/* Acciones */}
              <div style={{display: "flex", gap: "0.75rem"}}>
                <button 
                  className="btn btn--primary"
                  onClick={() => abrirModalNuevo(selectedDoc)}
                >
                  ✏️ Editar Documento
                </button>
                <button 
                  className="btn btn--secondary"
                  style={{background: "#ef4444", color: "white"}}
                  onClick={() => {
                    eliminarDocumento(selectedDoc.codigo);
                    setSelectedDoc(null);
                  }}
                >
                  🗑️ Eliminar
                </button>
              </div>
            </>
          ) : (
            <div style={{padding: "2rem", textAlign: "center", color: "#999"}}>
              Selecciona un documento de la lista para ver detalles
            </div>
          )}
        </div>
      </div>

      {/* ===== MODAL: NUEVO/EDITAR DOCUMENTO ===== */}
      {showModalNuevo && (
        <div className="modal-overlay" onClick={() => setShowModalNuevo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCodigo ? "Editar Documento" : "Nuevo Documento"}</h3>
              <button className="modal-close" onClick={() => setShowModalNuevo(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label>Código</label>
              <input type="text" disabled value={formData.codigo} className="input" />
              <label>Título *</label>
              <input 
                type="text"
                value={formData.titulo}
                onChange={(e) => setFormData({...formData, titulo: e.target.value})}
                className="input"
              />
              <label>Tipo de Documento *</label>
              <select 
                value={formData.tipo}
                onChange={(e) => setFormData({...formData, tipo: e.target.value as any})}
                className="input"
              >
                <option value="Manual">Manual</option>
                <option value="Política">Política</option>
                <option value="Proceso">Proceso</option>
                <option value="Instr.">Instructivo</option>
                <option value="Formato">Formato</option>
              </select>
              <label>Proceso *</label>
              <input 
                type="text"
                value={formData.proceso}
                onChange={(e) => setFormData({...formData, proceso: e.target.value})}
                className="input"
              />
              <label>Versión</label>
              <input 
                type="text"
                value={formData.version}
                onChange={(e) => setFormData({...formData, version: e.target.value})}
                className="input"
              />
              <label>Estado</label>
              <select 
                value={formData.estado}
                onChange={(e) => setFormData({...formData, estado: e.target.value as any})}
                className="input"
              >
                <option value="Borrador">Borrador</option>
                <option value="En Revision">En Revision</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Obsoleto">Obsoleto</option>
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalNuevo(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={guardarDocumento}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentosPage;
