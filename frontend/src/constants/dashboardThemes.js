function baseTheme(isDarkMode) {
  return {
    sidebarGradient: isDarkMode
      ? "bg-slate-900 border-r border-slate-800"
      : "bg-white border-r border-slate-200",
    sidebarActive: isDarkMode
      ? "bg-primary-900/40 text-primary-400"
      : "bg-primary-50 text-primary-600",
    sidebarInactive: isDarkMode
      ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
    accentGradient: isDarkMode
      ? "bg-primary-500 text-white"
      : "bg-primary-600 text-white",
    dotColor: "bg-primary-500",
    bg: isDarkMode ? "bg-[#030712]" : "bg-[#FAFAFA]",
    topbar: isDarkMode
      ? "bg-slate-900/80 border-b border-slate-800"
      : "bg-white/80 border-b border-slate-200",
    topbarText: isDarkMode ? "text-slate-100" : "text-slate-900",
    topbarSub: isDarkMode ? "text-slate-400" : "text-slate-500",
    topbarBtn: isDarkMode ? "hover:bg-slate-800" : "hover:bg-slate-50",
  };
}

export function getCashierTheme(isDarkMode) {
  return {
    ...baseTheme(isDarkMode),
    name: "Cashier Admin",
    abbrev: "CA",
    dashboardTitle: "Cashier Dashboard",
  };
}

export function getLibrarianTheme(isDarkMode) {
  return {
    ...baseTheme(isDarkMode),
    name: "Library Admin",
    abbrev: "LA",
    dashboardTitle: "Library Dashboard",
  };
}

export function getRegistrarTheme(isDarkMode) {
  return {
    ...baseTheme(isDarkMode),
    name: "Registrar",
    abbrev: "RG",
    dashboardTitle: "Registrar Dashboard",
  };
}

export function getSignatoryTheme(isDarkMode) {
  return {
    ...baseTheme(isDarkMode),
    name: "Signatory Panel",
    abbrev: "SP",
    dashboardTitle: "Signatory Dashboard",
  };
}

export function getStudentTheme(isDarkMode) {
  return {
    ...baseTheme(isDarkMode),
    name: "ISU Clearance",
    abbrev: "SC",
    dashboardTitle: "Student Dashboard",
  };
}

export function getSuperAdminTheme(isDarkMode) {
  return {
    ...baseTheme(isDarkMode),
    name: "Smart Clearance",
    abbrev: "SA",
    dashboardTitle: "Super Admin Dashboard",
  };
}
