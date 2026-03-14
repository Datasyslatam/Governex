import React, { useState } from "react";
import "./ProveedoresPage.css";

interface Proveedor {
  nit: string;
  razon: string;
  tipo: string;
  ult_eval: string;
  puntaje: number;
  estado: "Aprobado" | "Condicional" | "Suspendido";
  prox_eval: string;
}

interface Evaluacion {
  prov: string;
  fecha: string;
  evaluador: string;
  cal: number;
  ent: number;
  pre: number;
  srv: number;
  total: number;
}

const proveedoresInicial: Proveedor[] = [
  { nit: "900.123.456-1", razon: "Distribuidora Nacional S.A.", tipo: "Materia Prima", ult_eval: "10/01/2026", puntaje: 92, estado: "Aprobado", prox_eval: "10/01/2027" },
  { nit: "800.789.012-3", razon: "Tech Solutions Ltda.", tipo: "Tecnología / Software", ult_eval: "15/02/2026", puntaje: 85, estado: "Aprobado", prox_eval: "15/02/2027" },
  { nit: "901.456.789-0", razon: "Logística Segura SAS", tipo: "Transporte", ult_eval: "05/03/2026", puntaje: 62, estado: "Condicional", prox_eval: "05/06/2026" },
  { nit: "860.111.222-9", razon: "Mantenimiento Industrial Col", tipo: "Servicios", ult_eval: "20/12/2025", puntaje: 55, estado: "Suspendido", prox_eval: "-" },
];

const evaluacionesInicial: Evaluacion[] = [
  { prov: "Logística Segura SAS", fecha: "05/03/2026", evaluador: "M. Vargas", cal: 80, ent: 50, pre: 70, srv: 50, total: 62 },
  { prov: "Tech Solutions Ltda.", fecha: "15/02/2026", evaluador: "S. Martínez", cal: 90, ent: 90, pre: 80, srv: 80, total: 85 },
];

const ProveedoresPage: React.FC = () => {
  const [proveedores, setProveedores] = useState<Proveedor[]>(proveedoresInicial);
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>(evaluacionesInicial);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [showModalNuevo, setShowModalNuevo] = useState(false);
  const [showModalEvaluar, setShowModalEvaluar] = useState(false);
  const [editingNit, setEditingNit] = useState<string | null>(null);
  const [evalNit, setEvalNit] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nit: "",
    razon: "",
    tipo: "",
    ult_eval: "",
    puntaje: 0,
    estado: "Aprobado" as "Aprobado" | "Condicional" | "Suspendido",
    prox_eval: "",
  });

  const [evalData, setEvalData] = useState({
    cal: 0,
    ent: 0,
    pre: 0,
    srv: 0,
  });

  const proveedoresFiltrados = proveedores.filter((prov) => {
    const coincideBusqueda = prov.razon.toLowerCase().includes(busqueda.toLowerCase()) || 
                            prov.nit.includes(busqueda);
    const coincideEstado = !filtroEstado || prov.estado === filtroEstado;
    return coincideBusqueda && coincideEstado;
  });

  const calcularPuntajeTotal = (cal: number, ent: number, pre: number, srv: number) => {
    return Math.round((cal + ent + pre + srv) / 4);
  };

  const determinarEstado = (puntaje: number) => {
    if (puntaje >= 80) return "Aprobado";
    if (puntaje >= 60) return "Condicional";
    return "Suspendido";
  };

  const abrirModalNuevo = () => {
    setEditingNit(null);
    setFormData({ nit: "", razon: "", tipo: "", ult_eval: "", puntaje: 0, estado: "Aprobado", prox_eval: "" });
    setShowModalNuevo(true);
  };

  const abrirModalEvaluar = (nit: string) => {
    setEvalNit(nit);
    setEvalData({ cal: 0, ent: 0, pre: 0, srv: 0 });
    setShowModalEvaluar(true);
  };

  const editarProveedor = (prov: Proveedor) => {
    setEditingNit(prov.nit);
    setFormData(prov);
    setShowModalNuevo(true);
  };

  const guardarProveedor = () => {
    if (!formData.nit || !formData.razon || !formData.tipo) {
      alert("Completa todos los campos requeridos");
      return;
    }

    if (editingNit) {
      setProveedores(proveedores.map(p => 
        p.nit === editingNit ? formData : p
      ));
    } else {
      const existente = proveedores.find(p => p.nit === formData.nit);
      if (existente) {
        alert("Ya existe un proveedor con este NIT");
        return;
      }
      setProveedores([...proveedores, formData]);
    }

    setShowModalNuevo(false);
  };

  const eliminarProveedor = (nit: string) => {
    if (confirm("¿Confirmar eliminación del proveedor?")) {
      setProveedores(proveedores.filter(p => p.nit !== nit));
    }
  };

  const guardarEvaluacion = () => {
    if (!evalNit) return;

    const puntajeTotal = calcularPuntajeTotal(evalData.cal, evalData.ent, evalData.pre, evalData.srv);
    const estadoNuevo = determinarEstado(puntajeTotal);
    const hoy = new Date().toLocaleDateString("es-CO");
    const proximaEval = new Date();
    proximaEval.setMonth(proximaEval.getMonth() + 12);

    setProveedores(proveedores.map(p =>
      p.nit === evalNit 
        ? { 
            ...p, 
            puntaje: puntajeTotal, 
            estado: estadoNuevo, 
            ult_eval: hoy, 
            prox_eval: proximaEval.toLocaleDateString("es-CO")
          }
        : p
    ));

    const provEvaluado = proveedores.find(p => p.nit === evalNit);
    if (provEvaluado) {
      setEvaluaciones([
        {
          prov: provEvaluado.razon,
          fecha: hoy,
          evaluador: "Usuario Actual",
          cal: evalData.cal,
          ent: evalData.ent,
          pre: evalData.pre,
          srv: evalData.srv,
          total: puntajeTotal,
        },
        ...evaluaciones,
      ]);
    }

    setShowModalEvaluar(false);
  };

  const provSuspendido = proveedores.find(p => p.estado === "Suspendido");

  return (
    <div className="page prov-page">
      <header className="page__header prov-page__header">
        <div className="prov-page__header-left">
          <nav className="prov-page__breadcrumb">
            <span>Governex</span>
            <span className="prov-page__bc-sep">›</span>
            <span>Cap. 8.4</span>
            <span className="prov-page__bc-sep">›</span>
            <span className="prov-page__bc-active">Control de Proveedores</span>
          </nav>
          <h2>Gestión y Evaluación de Proveedores</h2>
          <p className="prov-page__subtitle">Selección, evaluación y reevaluación de proveedores externos</p>
        </div>
        <div className="prov-page__actions">
          <button className="btn btn--primary" onClick={abrirModalNuevo}>+ Nuevo Proveedor</button>
        </div>
      </header>

      <div className="prov-layout">
        <div className="prov-main-col panel">
          <div className="prov-toolbar">
            <div className="prov-search">
              <input 
                type="text" 
                className="input prov-search__input" 
                placeholder="Buscar por Razón Social o NIT..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div className="prov-filters">
              <select 
                className="input prov-filter"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="">Todos los Estados</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Condicional">Condicional</option>
                <option value="Suspendido">Suspendido</option>
              </select>
            </div>
          </div>

          <table className="table prov-table">
            <thead>
              <tr>
                <th>NIT</th>
                <th>Razón Social</th>
                <th>Tipo Suministro</th>
                <th>Última Evaluación</th>
                <th>Puntaje</th>
                <th>Estado</th>
                <th>Próx. Evaluación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proveedoresFiltrados.map((prov, i) => (
                <tr key={prov.nit} className={i % 2 === 1 ? "table__row--alt" : ""}>
                  <td className="prov-table__code">{prov.nit}</td>
                  <td className="prov-table__title">{prov.razon}</td>
                  <td className="prov-table__type">{prov.tipo}</td>
                  <td className="prov-table__date">{prov.ult_eval}</td>
                  <td>
                    <div className="prov-score">
                      <div className={`prov-score-circle ${
                        prov.puntaje >= 80 ? 'score-good' : prov.puntaje >= 60 ? 'score-warn' : 'score-bad'
                      }`}>
                        {prov.puntaje}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${
                      prov.estado === "Aprobado" ? "pill--success" :
                      prov.estado === "Condicional" ? "pill--warning" :
                      "pill--danger"
                    }`}>
                      {prov.estado}
                    </span>
                  </td>
                  <td className="prov-table__next">{prov.prox_eval}</td>
                  <td className="prov-table__actions">
                    <button 
                      className="prov-action-btn btn-evaluar" 
                      title="Realizar Evaluación"
                      onClick={() => abrirModalEvaluar(prov.nit)}
                    >
                      ⭐ Evaluar
                    </button>
                    <button 
                      className="prov-action-btn" 
                      title="Editar"
                      onClick={() => editarProveedor(prov)}
                    >
                      ✏️
                    </button>
                    <button 
                      className="prov-action-btn" 
                      title="Eliminar"
                      onClick={() => eliminarProveedor(prov.nit)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {proveedoresFiltrados.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
              No hay proveedores que coincidan con los filtros
            </div>
          )}
        </div>

        <div className="prov-side-col panel">
          <div className="prov-side-header">
            <h3>Evaluaciones Recientes</h3>
          </div>
          <div className="prov-eval-list">
            {evaluaciones.slice(0, 5).map((ev, i) => (
              <div key={i} className="prov-eval-card">
                <div className="prov-eval-card-header">
                  <strong>{ev.prov}</strong>
                  <span className="prov-eval-total">Total: {ev.total}/100</span>
                </div>
                <div className="prov-eval-details">
                  <div className="prov-eval-item"><span>Calidad:</span>{ev.cal}</div>
                  <div className="prov-eval-item"><span>Entrega:</span>{ev.ent}</div>
                  <div className="prov-eval-item"><span>Precio:</span>{ev.pre}</div>
                  <div className="prov-eval-item"><span>Servicio:</span>{ev.srv}</div>
                </div>
                <div className="prov-eval-footer">
                  <span className="prov-eval-date">{ev.fecha}</span>
                  <span className="prov-eval-user">por {ev.evaluador}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="prov-alerts mt-4">
            <h3 className="mb-2" style={{fontSize: '1rem', color: '#1a2b45'}}>Alertas</h3>
            {provSuspendido && (
              <div className="prov-alert-item">
                <span className="prov-alert-icon">⚠️</span>
                <div>
                  <strong>{provSuspendido.razon}</strong>
                  <span>Suspendido por baja calificación ({provSuspendido.puntaje}). Generar NC de proveedor.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: NUEVO/EDITAR PROVEEDOR */}
      {showModalNuevo && (
        <div className="modal-overlay" onClick={() => setShowModalNuevo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingNit ? "Editar Proveedor" : "Nuevo Proveedor"}</h3>
              <button className="modal-close" onClick={() => setShowModalNuevo(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label>NIT *</label>
              <input 
                type="text" 
                disabled={!!editingNit}
                value={formData.nit}
                onChange={(e) => setFormData({...formData, nit: e.target.value})}
                className="input"
              />
              <label>Razón Social *</label>
              <input 
                type="text"
                value={formData.razon}
                onChange={(e) => setFormData({...formData, razon: e.target.value})}
                className="input"
              />
              <label>Tipo de Suministro *</label>
              <select 
                value={formData.tipo}
                onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                className="input"
              >
                <option value="">Seleccionar</option>
                <option value="Materia Prima">Materia Prima</option>
                <option value="Tecnología / Software">Tecnología / Software</option>
                <option value="Transporte">Transporte</option>
                <option value="Servicios">Servicios</option>
              </select>
              <label>Última Evaluación</label>
              <input 
                type="date"
                value={formData.ult_eval}
                onChange={(e) => setFormData({...formData, ult_eval: e.target.value})}
                className="input"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalNuevo(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={guardarProveedor}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EVALUAR PROVEEDOR */}
      {showModalEvaluar && evalNit && (
        <div className="modal-overlay" onClick={() => setShowModalEvaluar(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Evaluar Proveedor</h3>
              <button className="modal-close" onClick={() => setShowModalEvaluar(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{marginBottom: '1rem', color: '#666'}}>
                <strong>{proveedores.find(p => p.nit === evalNit)?.razon}</strong>
              </p>
              <label>Calidad (0-100): {evalData.cal}</label>
              <input 
                type="range"
                min="0"
                max="100"
                value={evalData.cal}
                onChange={(e) => setEvalData({...evalData, cal: parseInt(e.target.value)})}
              />
              <label>Entrega (0-100): {evalData.ent}</label>
              <input 
                type="range"
                min="0"
                max="100"
                value={evalData.ent}
                onChange={(e) => setEvalData({...evalData, ent: parseInt(e.target.value)})}
              />
              <label>Precio (0-100): {evalData.pre}</label>
              <input 
                type="range"
                min="0"
                max="100"
                value={evalData.pre}
                onChange={(e) => setEvalData({...evalData, pre: parseInt(e.target.value)})}
              />
              <label>Servicio (0-100): {evalData.srv}</label>
              <input 
                type="range"
                min="0"
                max="100"
                value={evalData.srv}
                onChange={(e) => setEvalData({...evalData, srv: parseInt(e.target.value)})}
              />
              <div style={{marginTop: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px'}}>
                <strong>Puntaje Total: {calcularPuntajeTotal(evalData.cal, evalData.ent, evalData.pre, evalData.srv)}/100</strong>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowModalEvaluar(false)}>Cancelar</button>
              <button className="btn btn--primary" onClick={guardarEvaluacion}>Guardar Evaluación</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProveedoresPage;
