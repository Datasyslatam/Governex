import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/globals.css";
import "./styles/components.css";

import { AuthProvider } from "./context/AuthContext";
import { PlatformAdminAuthProvider } from "./context/PlatformAdminAuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LayoutProvider } from "./context/LayoutContext";
import { AIAnalysisProvider } from "./context/AIAnalysisContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PlatformAdminAuthProvider>
            <AIAnalysisProvider>
              <LayoutProvider>
                <App />
              </LayoutProvider>
            </AIAnalysisProvider>
          </PlatformAdminAuthProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
