import React, { createContext, useState, useContext, useEffect } from "react";
import { authService } from "../services";

export type UserRole = "Superusuario" | "Operativo" | "Gestión";

// Info del tenant SOLO para mostrar en UI (nombre de empresa en el header,
// selector de tema, etc). Nunca se usa para decidir a qué datos puede
// acceder el usuario — eso lo decide el backend a partir del JWT.
export interface TenantInfo {
  id: number;
  nombre: string;
}

export interface User {
  name: string;
  role: UserRole;
  tenant?: TenantInfo;
  permissions?: string[];
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => any;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_KEY = "governex_user";
export const IMPERSONATION_KEY = "governex_impersonation";
const SESSION_INVALID_EVENT = "governex:session-invalid";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Inicializa desde localStorage para que la sesión persista al recargar.
  // Nota: esto no valida el JWT contra el backend, solo restaura lo que se
  // mostró la última vez. Si el token expiró o el tenant fue suspendido, la
  // primera llamada a la API disparará el evento de abajo y cerrará sesión.
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (nextUser: User) => {
    setUser(nextUser);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
    await authService.logout();
    localStorage.removeItem(IMPERSONATION_KEY); // por si la sesión terminó estando impersonando

    // Limpia también el caché de AIAnalysisContext (sessionStorage). Evita
    // que, si otro usuario/tenant inicia sesión en el mismo navegador,
    // vea brevemente los datos del tenant anterior mientras el fetch
    // fresco de AIAnalysisProvider todavía está en vuelo.
    sessionStorage.removeItem("governex_ai_analysis");
    sessionStorage.removeItem("governex_datos_empresa");
    sessionStorage.removeItem("governex_actividades");
    sessionStorage.removeItem("governex_proyectos_diseno");
  };

  // api.ts (fuera del árbol de React) dispara este evento cuando cualquier
  // petición recibe 401, o 403 con code TENANT_INACTIVE. Al reaccionar acá
  // en vez de forzar una recarga de página, ProtectedRoute detecta
  // isAuthenticated=false y redirige a /login sin perder el estado de la SPA.
  useEffect(() => {
    const handleSessionInvalid = () => logout();
    window.addEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
    return () => window.removeEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
};