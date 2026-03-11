import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { useAuth } from "../hooks/useAuth";

import AuthLayout from "../layout/AuthLayout";
import MainLayout from "../layout/MainLayout";

import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import RiesgosPage from "../pages/riesgos/RiesgosPage";
import DocumentosPage from "../pages/documentos/DocumentosPage";
import NcAcPage from "../pages/nc-ac/NcAcPage";
import AuditoriaPage from "../pages/auditoria/AuditoriaPage";
import ProcesosPage from "../pages/procesos/ProcesosPage";
import RevDireccionPage from "../pages/rev-direccion/RevDireccionPage";
import IndicadoresPage from "../pages/indicadores/IndicadoresPage";

export const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route
        path="/login"
        element={
          <AuthLayout>
            <LoginPage />
          </AuthLayout>
        }
      />

      {/* Rutas protegidas con layout principal */}
      <Route
        path="/"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="riesgos" element={<RiesgosPage />} />
        <Route path="documentos" element={<DocumentosPage />} />
        <Route path="nc-ac" element={<NcAcPage />} />
        <Route path="auditorias" element={<AuditoriaPage />} />
        <Route path="procesos" element={<ProcesosPage />} />
        <Route path="rev-direccion" element={<RevDireccionPage />} />
        <Route path="indicadores" element={<IndicadoresPage />} />
      </Route>

      {/* Catch-all */}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />}
      />
    </Routes>
  );
};
