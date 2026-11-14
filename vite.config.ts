import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Identificador único de cada build. En Railway incluye el commit desplegado;
// en cualquier caso el instante del build lo hace único por despliegue.
const BUILD_ID = [
  (process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "").slice(0, 12),
  Date.now().toString(36),
].filter(Boolean).join("-");

/**
 * Publica /version.json con el identificador del build. El frontend compara
 * el suyo (incrustado en el bundle) con este archivo para detectar que hubo
 * un despliegue nuevo mientras la pestaña seguía abierta (ver
 * src/components/AvisoNuevaVersion.tsx).
 */
function versionJson(): Plugin {
  return {
    name: "governex-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ build: BUILD_ID }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionJson()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
