import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "./LoginPage.css";

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Alta Dirección" | "Admin SGC" | "Usuario">(
    "Alta Dirección"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ name: email || "Usuario Governex", role });
    navigate("/dashboard");
  };

  return (
    <div className="login">
      <div className="login__left">
        <div className="login__brand">
          <h1>Governex</h1>
          <p>Sistema de Gestión de Calidad</p>
          <p>NTC-ISO 9001:2015 · Colombia</p>
          <ul>
            <li>Trazabilidad total del SGC</li>
            <li>Control documental versionado</li>
            <li>Auditoría interna integrada</li>
            <li>Dashboard ejecutivo en tiempo real</li>
          </ul>
        </div>
      </div>

      <div className="login__right">
        <form className="login__card" onSubmit={handleSubmit}>
          <h2>Iniciar Sesión</h2>

          <label>
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
            />
          </label>

          <label>
            Contraseña
            <input type="password" placeholder="••••••••" />
          </label>

          <label>
            Rol de acceso
            <select
              value={role}
              onChange={e => setRole(e.target.value as any)}
            >
              <option value="Alta Dirección">Alta Dirección</option>
              <option value="Admin SGC">Admin SGC</option>
              <option value="Usuario">Usuario</option>
            </select>
          </label>

          <button type="submit" className="login__submit">
            INGRESAR A GOVERNEX
          </button>

          <p className="login__helper">
            Autenticación 2FA activa para Alta Dirección y Admin SGC
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
