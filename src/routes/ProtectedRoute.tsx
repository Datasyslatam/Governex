import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface ProtectedRouteProps {
  isAuthenticated: boolean;
  children: React.ReactNode;
}

export const RUTA_SEGURIDAD_CUENTA = "/cuenta/seguridad";

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAuthenticated,
  children
}) => {
  const location = useLocation();
  const { user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Contraseña temporal (restablecida por un administrador): solo se permite
  // la pantalla de seguridad de la cuenta. El backend lo exige igualmente
  // (403 PASSWORD_CHANGE_REQUIRED); esto solo evita pantallas vacías.
  if (user?.debeCambiarPassword && location.pathname !== RUTA_SEGURIDAD_CUENTA) {
    return <Navigate to={RUTA_SEGURIDAD_CUENTA} replace />;
  }

  return <>{children}</>;
};
