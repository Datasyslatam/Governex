import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "./Sidebar.css";

interface SectionItem {
  to:   string;
  icon: string;
  text: string;
}

interface Section {
  id:    string;
  label: string;
  items: SectionItem[];
}

const SECTIONS: Section[] = [
  {
    id: "s4",
    label: "4 · Contexto",
    items: [
      { to: "/procesos", icon: "🧭", text: "Contexto de la Organización" },
    ],
  },
  {
    id: "s5",
    label: "5 · Liderazgo",
    items: [
      { to: "/politica",            icon: "⚓", text: "Liderazgo y Política" },
      { to: "/roles",               icon: "⚓", text: "Roles, Responsabilidades y Autoridad" },
      { to: "/enfoque-cliente",  icon: "🤝", text: "Enfoque al Cliente" }, // ← NUEVO
    ],
  },
  {
    id: "s6",
    label: "6 · Planificación",
    items: [
      { to: "/riesgos",                icon: "🗺️", text: "Riesgos y Oportunidades" },
      { to: "/objetivos-calidad",      icon: "🎯", text: "Objetivos de Calidad" },
      { to: "/planificacion-cambios",  icon: "🔄", text: "Planificación de los Cambios" }, // ← NUEVO
    ],
  },
  {
    id: "s7",
    label: "7 · Apoyo",
    items: [
      { to: "/recursos",         icon: "🔋", text: "Recursos" },
      { to: "/competencias",     icon: "🔋", text: "Competencia" },
      { to: "/toma-consciencia", icon: "🔋", text: "Toma de Consciencia" },
      { to: "/comunicacion",     icon: "🔋", text: "Comunicación" },
      { to: "/documentos",       icon: "🔋", text: "Información Documentada" },
    ],
  },
  {
    id: "s8",
    label: "8 · Operación",
    items: [
      { to: "/planificacion-operacion", icon: "⚙️", text: "Planificación y Control" },
      { to: "/requerimientos-ps",       icon: "⚙️", text: "Requerimientos para Productos y Servicios" },
      { to: "/diseno-desarrollo",       icon: "⚙️", text: "Diseño y Desarrollo" },
      { to: "/compras",                 icon: "⚙️", text: "Compras" },
      { to: "/proveedores",             icon: "⚙️", text: "Control de Proveedores" },
      { to: "/produccion-servicio",     icon: "⚙️", text: "Producción y Provisión del Servicio" },
      { to: "/liberacion-ps",           icon: "⚙️", text: "Liberación de Productos y Servicios" },
      { to: "/salidas-nc",              icon: "⚙️", text: "Control de Salidas No Conformes" },
    ],
  },
  {
    id: "s9",
    label: "9 · Evaluación",
    items: [
      { to: "/auditorias",    icon: "🔬", text: "Auditorías Internas" },
      { to: "/indicadores",   icon: "🔬", text: "Indicadores de Desempeño" },
      { to: "/rev-direccion", icon: "🔬", text: "Revisión por la Dirección" },
    ],
  },
  {
    id: "s10",
    label: "10 · Mejora",
    items: [
      { to: "/nc-ac",           icon: "♾️", text: "No Conformidades y Acciones" },
      { to: "/mejora-continua", icon: "♾️", text: "Mejora Continua" },
    ],
  },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const activeSection = SECTIONS.find(s =>
    s.items.some(item => location.pathname.startsWith(item.to))
  )?.id ?? null;

  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(activeSection ? [activeSection] : [])
  );

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <span className="sidebar__logo-main">Governex</span>
        <span className="sidebar__logo-sub">Sistema de Gestión de Calidad</span>
      </div>

      <nav className="sidebar__nav">

        <NavLink to="/dashboard" className="sidebar__link">
          <span className="sidebar__icon">📊</span>
          <span className="sidebar__text">Dashboard</span>
        </NavLink>

        {user?.role === "Superusuario" && (
          <NavLink to="/usuarios" className="sidebar__link">
            <span className="sidebar__icon">👤</span>
            <span className="sidebar__text">Gestión de Usuarios</span>
          </NavLink>
        )}

        {SECTIONS.map(section => {
          const isOpen    = openSections.has(section.id);
          const hasActive = section.items.some(item =>
            location.pathname.startsWith(item.to)
          );

          return (
            <div key={section.id} className="sidebar__group">
              <button
                className={
                  "sidebar__section-toggle" +
                  (hasActive ? " sidebar__section-toggle--active" : "")
                }
                onClick={() => toggleSection(section.id)}
                aria-expanded={isOpen}
              >
                <span className="sidebar__section-toggle-label">{section.label}</span>
                <span className={
                  "sidebar__chevron" + (isOpen ? " sidebar__chevron--open" : "")
                }>›</span>
              </button>

              <div className={
                "sidebar__group-items" +
                (isOpen ? " sidebar__group-items--open" : "")
              }>
                {section.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className="sidebar__link sidebar__link--nested"
                  >
                    <span className="sidebar__icon">{item.icon}</span>
                    <span className="sidebar__text">{item.text}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}

      </nav>
    </aside>
  );
};

export default Sidebar;