export const theme = {
  colors: {
    // Neutros
    bg: "#F0F4F8",
    panel: "#FFFFFF",
    border: "#D1DCE8",
    textMain: "#1A2B45",
    textSecondary: "#4A5E78",
    textMuted: "#7A8FA6",

    // Sidebar / topbar
    sidebar: "#1B3A6B",
    sidebarAlt: "#162F58",

    // Primarios
    primary: "#1A6EBD",
    primaryAlt: "#2E86DE",

    // Semáforo
    success: "#1A9C5B",
    warning: "#E08A00",
    danger: "#D93025",

    // Grises
    gray100: "#F8FAFC",
    gray200: "#EDF2F7",
    gray300: "#E2E8F0",
    gray400: "#CBD5E1",
    gray500: "#94A3B8",
    gray600: "#64748B",
    gray700: "#334155",
    gray800: "#1E293B",
    gray900: "#0F172A"
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem"
  },
  borderRadius: {
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    pill: "999px"
  },
  shadows: {
    sm: "0 1px 3px rgba(15, 23, 42, 0.08)",
    md: "0 4px 6px rgba(15, 23, 42, 0.09)",
    lg: "0 10px 25px rgba(15, 23, 42, 0.12)"
  }
} as const;
