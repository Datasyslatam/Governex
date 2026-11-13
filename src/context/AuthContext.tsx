import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { authService, PerfilUsuario } from "../services";

export type UserRole = "Superusuario" | "Operativo" | "Gestión";

// Info del tenant SOLO para mostrar en UI (nombre de empresa en el header,
// selector de tema, etc). Nunca se usa para decidir a qué datos puede
// acceder el usuario — eso lo decide el backend a partir de la sesión.
export interface TenantInfo {
  id: number;
  nombre: string;
}

export interface User {
  name: string;
  role: UserRole;
  tenant?: TenantInfo;
  permissions?: string[];
  email?: string;
  mfaHabilitado?: boolean;
  mfaObligatorio?: boolean;
  debeCambiarPassword?: boolean;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => any;
  /** Vuelve a leer el perfil del servidor (tras cambiar contraseña, activar MFA, etc.). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_KEY = "governex_user";
export const IMPERSONATION_KEY = "governex_impersonation";
const SESSION_INVALID_EVENT = "governex:session-invalid";
const PASSWORD_CHANGE_EVENT = "governex:password-change-required";

/** Convierte el perfil del backend al formato que usa la UI. */
export function userFromPerfil(p: PerfilUsuario, tenant?: TenantInfo): User {
  return {
    name: p.nombre,
    role: p.rol as UserRole,
    tenant,
    permissions: p.permissions,
    email: p.email,
    mfaHabilitado: p.mfaHabilitado,
    mfaObligatorio: p.mfaObligatorio,
    debeCambiarPassword: p.debeCambiarPassword,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Se restaura lo último mostrado para no parpadear al recargar, pero ya no
  // se confía en ello: el efecto de abajo valida la sesión contra /api/auth/me
  // (la cookie HttpOnly es la única credencial; localStorage solo guarda datos
  // de presentación, nunca un token).
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const guardar = (u: User | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
      else localStorage.removeItem(USER_KEY);
    } catch { /* sin storage */ }
  };

  const login = (nextUser: User) => guardar(nextUser);

  const logout = async () => {
    guardar(null);
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

  const refresh = useCallback(async () => {
    const { user: perfil, tenant } = await authService.me();
    guardar(userFromPerfil(perfil, tenant));
  }, []);

  // Validación de la sesión al cargar la aplicación.
  useEffect(() => {
    if (!user) return;
    refresh().catch(() => { /* un 401 ya dispara el cierre de sesión vía api.ts */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // api.ts (fuera del árbol de React) dispara estos eventos: 401 / empresa
  // inactiva → cerrar sesión; contraseña temporal → marcar para que
  // ProtectedRoute lleve a la pantalla de cambio de contraseña.
  useEffect(() => {
    const handleSessionInvalid = () => logout();
    const handlePasswordChange = () =>
      setUser((u) => (u ? { ...u, debeCambiarPassword: true } : u));
    window.addEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
    window.addEventListener(PASSWORD_CHANGE_EVENT, handlePasswordChange);
    return () => {
      window.removeEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
      window.removeEventListener(PASSWORD_CHANGE_EVENT, handlePasswordChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    refresh,
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
