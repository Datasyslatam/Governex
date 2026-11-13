import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "./Topbar.css";

const Topbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="topbar"> <div className="topbar__left"> <div className="topbar__title">Governex · Sistema de Gestión de Calidad</div>
        {user?.tenant?.nombre && (
          <span className="topbar__subtitle">{user.tenant.nombre}</span>
        )}
      </div> <div className="topbar__right"> <span className="topbar__user">
          {user?.name ?? "Usuario"} · {user?.role ?? "Invitado"}
        </span>
        <Link className="topbar__logout topbar__link" to="/cuenta/seguridad" title="Contraseña, verificación en dos pasos y sesiones activas">
          Mi seguridad
        </Link> <button className="topbar__logout" onClick={logout}>
          Cerrar sesión
        </button> </div> </header>
  );
};

export default Topbar;