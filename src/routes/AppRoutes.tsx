import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { PlatformAdminProtectedRoute } from "./PlatformAdminProtectedRoute";
import { useAuth } from "../hooks/useAuth";
import PlatformAdminLoginPage from "../pages/platform-admin/PlatformAdminLoginPage";
import PlatformAdminDashboardPage from "../pages/platform-admin/PlatformAdminDashboardPage";
import EnfoqueClientePage from "../pages/enfoque-cliente/EnfoqueClientePage";

import AuthLayout from "../layout/AuthLayout";
import MainLayout from "../layout/MainLayout";

import LoginPage                   from "../pages/auth/LoginPage";
import DashboardPage               from "../pages/dashboard/DashboardPage";
import RiesgosPage                 from "../pages/riesgos/RiesgosPage";
import ObjetivosCalidadPage        from "../pages/objetivos-calidad/ObjetivosCalidadPage";
import PlanificacionCambiosPage    from "../pages/planificacion-cambios/PlanificacionCambiosPage"; // ← NUEVO
import DocumentosPage              from "../pages/documentos/DocumentosPage";
import NcAcPage                    from "../pages/nc-ac/NcAcPage";
import AuditoriaPage               from "../pages/auditoria/AuditoriaPage";
import ProcesosPage                from "../pages/procesos/ProcesosPage";
import RevDireccionPage            from "../pages/rev-direccion/RevDireccionPage";
import IndicadoresPage             from "../pages/indicadores/IndicadoresPage";
import PoliticaPage                from "../pages/politica/PoliticaPage";
import RecursosPage                from "../pages/recursos/RecursosPage"; // ← NUEVO
import CompetenciasPage            from "../pages/competencias/CompetenciasPage";
import ProveedoresPage             from "../pages/proveedores/ProveedoresPage";
import RolesPage                   from "../pages/roles/RolesPage";
import TomaConscienciaPage         from "../pages/toma-consciencia/TomaConscienciaPage";
import ComunicacionPage            from "../pages/comunicacion/ComunicacionPage";
import PlanificacionOperacionPage  from "../pages/planificacion-operacion/PlanificacionOperacionPage";
import RequerimientosPSPage        from "../pages/requerimientos-ps/RequerimientosPSPage";
import DisenoDesarrolloPage        from "../pages/diseno-desarrollo/DisenoDesarrolloPage";
import ComprasPage                 from "../pages/compras/ComprasPage";
import ProduccionServicioPage      from "../pages/produccion-servicio/ProduccionServicioPage";
import LiberacionPSPage            from "../pages/liberacion-ps/LiberacionPSPage";
import SalidasNCPage               from "../pages/salidas-nc/SalidasNCPage";
import MejoraContinuaPage          from "../pages/mejora-continua/MejoraContinuaPage";
import UsuariosPage               from "../pages/auth/UsuariosPage";

export const AppRoutes: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />

      {/* Panel de super-admin de Governex — completamente aislado del resto de la app */}
      <Route path="/platform-admin/login" element={<PlatformAdminLoginPage />} />
      <Route
        path="/platform-admin"
        element={
          <PlatformAdminProtectedRoute>
            <PlatformAdminDashboardPage />
          </PlatformAdminProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="dashboard"               element={<DashboardPage />} />

        {/* §4 */}
        <Route path="procesos"                element={<ProcesosPage />} />

        {/* §5 */}
        <Route path="politica"                element={<PoliticaPage />} />
        <Route path="roles"                   element={<RolesPage />} />
        <Route path="enfoque-cliente"         element={<EnfoqueClientePage />} /> {/* ← NUEVO */}
        {user?.role === "Superusuario" && (
          <Route path="usuarios"              element={<UsuariosPage />} />
        )}

        {/* §6 */}
        <Route path="riesgos"                 element={<RiesgosPage />} />
        <Route path="objetivos-calidad"       element={<ObjetivosCalidadPage />} />
        <Route path="planificacion-cambios"   element={<PlanificacionCambiosPage />} /> {/* ← NUEVO */}

        {/* §7 */}
        <Route path="recursos"                element={<RecursosPage />} />
        <Route path="competencias"            element={<CompetenciasPage />} />
        <Route path="documentos"             element={<DocumentosPage />} />
        <Route path="toma-consciencia"        element={<TomaConscienciaPage />} />
        <Route path="comunicacion"            element={<ComunicacionPage />} />

        {/* §8 */}
        <Route path="planificacion-operacion" element={<PlanificacionOperacionPage />} />
        <Route path="requerimientos-ps"       element={<RequerimientosPSPage />} />
        <Route path="diseno-desarrollo"       element={<DisenoDesarrolloPage />} />
        <Route path="compras"                 element={<ComprasPage />} />
        <Route path="proveedores"             element={<ProveedoresPage />} />
        <Route path="produccion-servicio"     element={<ProduccionServicioPage />} />
        <Route path="liberacion-ps"           element={<LiberacionPSPage />} />
        <Route path="salidas-nc"              element={<SalidasNCPage />} />

        {/* §9 */}
        <Route path="auditorias"              element={<AuditoriaPage />} />
        <Route path="indicadores"             element={<IndicadoresPage />} />
        <Route path="rev-direccion"           element={<RevDireccionPage />} />

        {/* §10 */}
        <Route path="nc-ac"                   element={<NcAcPage />} />
        <Route path="mejora-continua"         element={<MejoraContinuaPage />} />
      </Route>

      <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
    </Routes>
  );
};