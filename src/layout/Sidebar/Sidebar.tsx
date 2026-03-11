import React from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <span className="sidebar__logo-main">Governex</span>
        <span className="sidebar__logo-sub">SGC · ISO 9001:2015</span>
      </div>

      <nav className="sidebar__nav">
        <NavLink to="/dashboard" className="sidebar__link">
          Dashboard
        </NavLink>
        <NavLink to="/procesos" className="sidebar__link">
          Procesos
        </NavLink>
        <NavLink to="/riesgos" className="sidebar__link">
          Riesgos
        </NavLink>
        <NavLink to="/documentos" className="sidebar__link">
          Documentos
        </NavLink>
        <NavLink to="/auditorias" className="sidebar__link">
          Auditorías
        </NavLink>
        <NavLink to="/nc-ac" className="sidebar__link">
          No Conformidades
        </NavLink>
        <NavLink to="/rev-direccion" className="sidebar__link">
          Rev. Dirección
        </NavLink>
        <NavLink to="/indicadores" className="sidebar__link">
          Indicadores
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
