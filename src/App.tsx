import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import ImpersonationBanner from "./components/ImpersonationBanner";

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    // Acceso oculto al panel de super-admin de Governex. No hay ningún
    // enlace visible en la UI a propósito — solo quien conoce el atajo
    // puede llegar a /platform-admin/login. No depende del backend ni
    // de ninguna ruta especial: es JS puro, así que funciona igual en
    // local y en Railway (mismo bundle).
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifier = e.ctrlKey || e.metaKey; // Cmd en Mac, Ctrl en Windows/Linux
      if (modifier && e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        navigate("/platform-admin/login");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return (
    <div className="App">
      <ImpersonationBanner />
      <AppRoutes />
    </div>
  );
}

export default App;