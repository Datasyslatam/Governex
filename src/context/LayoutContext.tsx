import React, { createContext, useContext, useState, useCallback } from "react";

interface LayoutContextValue {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);

  const toggleSidebar = useCallback(
    () => setSidebarCollapsedState(prev => !prev),
    []
  );

  const setSidebarCollapsed = (value: boolean) => {
    setSidebarCollapsedState(value);
  };

  const value: LayoutContextValue = {
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed
  };

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
};

export const useLayoutContext = (): LayoutContextValue => {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error("useLayoutContext must be used within a LayoutProvider");
  }
  return ctx;
};
