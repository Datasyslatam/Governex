import React from "react";
import { useAuth } from "../../hooks/useAuth";
import "./Topbar.css";

const Topbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="topbar__title">Governex · Sistema de Gestión de Calidad</div>
      </div>

      <div className="topbar__right">
        <span className="topbar__user">
          {user?.name ?? "Usuario"} · {user?.role ?? "Invitado"}
        </span>
        <button className="topbar__logout" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
};

export default Topbar;