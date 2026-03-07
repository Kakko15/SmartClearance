import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeftIcon,
  ArrowRightOnRectangleIcon,
  CogIcon,
} from "./Icons";

export default function DashboardLayout({
  theme,
  menuItems,
  activeView,
  setActiveView,
  userInfo,
  onSignOut,
  onOpenSettings,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fallback defaults for a Google Material You style if theme misses them
  const bgC = theme.bg || "bg-[#f8f9fa]";
  const sidebarBg = theme.sidebarGradient || "bg-white border-r border-[#dadce0]";
  const sidebarText = theme.sidebarText || "text-[#3c4043]";
  const sidebarActive = theme.sidebarActive || "bg-[#e8f0fe] text-[#1a73e8]";
  const sidebarInactive = theme.sidebarInactive || "text-[#3c4043] hover:bg-[#f1f3f4]";
  const topbarBg = theme.topbar || "bg-white border-b border-[#dadce0]";

  return (
    <div className={`flex h-screen ${bgC} font-sans selection:bg-blue-100 selection:text-blue-900`}>
      {/* Optional decorative glows, hidable */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-0 left-1/4 w-[500px] h-[500px] ${theme.glow1 || "hidden"} rounded-full blur-[120px]`} />
        <div className={`absolute bottom-0 right-1/4 w-[600px] h-[600px] ${theme.glow2 || "hidden"} rounded-full blur-[120px]`} />
      </div>

      <motion.div
        animate={{ width: sidebarOpen ? 260 : 76 }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className={`${sidebarBg} ${sidebarText} flex flex-col relative z-20 overflow-hidden flex-shrink-0 transition-colors duration-200`}
      >
        <div className="h-[64px] flex items-center justify-between px-4 mt-1">
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3 overflow-hidden ml-2"
              >
                <div
                  className={`w-8 h-8 ${theme.accentGradient || "bg-[#1a73e8]"} rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0`}
                >
                  {theme.abbrev}
                </div>
                <span className="font-medium text-[18px] tracking-tight text-[#202124] whitespace-nowrap" style={{ fontFamily: 'Google Sans, sans-serif' }}>
                  {theme.name}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2.5 rounded-full transition-colors flex-shrink-0 ${theme.topbarBtn || 'hover:bg-[#f1f3f4] text-[#5f6368]'}`}
          >
            <motion.div
              animate={{ rotate: sidebarOpen ? 0 : 180 }}
              transition={{ duration: 0.3 }}
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </motion.div>
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-3">
          {menuItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-full transition-all duration-150 group ${
                  isActive ? sidebarActive : sidebarInactive
                }`}
              >
                <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center ${isActive ? "text-[#1a73e8]" : "text-[#5f6368] group-hover:text-[#202124]"}`}>
                  {item.icon}
                </span>
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex-1 flex items-center justify-between overflow-hidden"
                    >
                      <span className={`font-medium whitespace-nowrap text-[14px] ${isActive ? "text-[#1a73e8] font-semibold" : "text-[#3c4043]"}`}>
                        {item.label}
                      </span>
                      {item.count != null && item.count > 0 && (
                        <span
                          className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isActive ? "bg-blue-100 text-[#1a73e8]" : "bg-[#f1f3f4] text-[#3c4043]"
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </nav>

        <div className="p-5 pb-6">
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-[#5f6368] font-medium ml-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`w-2 h-2 ${theme.dotColor || "bg-[#1e8e3e]"} rounded-full animate-pulse`}
                  />
                  <span>System Online</span>
                </div>
                <div>ISU Clearance v2.0</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="flex-1 flex flex-col relative z-20 overflow-hidden">
        <div
          className={`h-[64px] ${topbarBg} flex items-center justify-between px-6 sm:px-8 flex-shrink-0 z-30 transition-shadow`}
        >
          <div>
            <h1 className={`text-[22px] font-normal tracking-tight ${theme.topbarText || "text-[#202124]"}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
              {theme.dashboardTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className={`p-2.5 rounded-full transition-colors ${theme.topbarBtn || 'hover:bg-[#f1f3f4] text-[#5f6368]'}`}
                title="Settings"
              >
                <CogIcon className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-3 ml-2">
              <div className="text-right hidden sm:block mr-1">
                <p className={`text-[14px] font-medium ${theme.topbarText || 'text-[#3c4043]'}`}>
                  {userInfo.name}
                </p>
                {userInfo.subtitle && (
                  <p className={`text-[11px] font-medium tracking-wide uppercase mt-0.5 ${theme.topbarSub || 'text-[#5f6368]'}`}>
                    {userInfo.subtitle}
                  </p>
                )}
              </div>
              <button className={`flex items-center justify-center w-9 h-9 rounded-full font-medium text-sm shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-offset-2 ${theme.accentGradient || 'bg-[#1a73e8] text-white focus:ring-[#1a73e8]'}`}>
                {userInfo.name?.charAt(0)}
              </button>
            </div>
            <div className={`w-px h-8 mx-3 ${theme.divider || 'bg-[#dadce0]'}`} />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSignOut}
              className={`p-2 rounded-full transition-colors flex items-center justify-center ${theme.logoutBtn || 'text-[#5f6368] hover:text-[#d93025] hover:bg-[#fce8e6]'}`}
              title="Sign Out"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 relative z-10 scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="h-full w-full max-w-[1000px] mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function GlassCard({
  children,
  className = "",
  isDark = false,
  delay = 0,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 40, delay }}
      className={`relative rounded-3xl overflow-hidden ${
        isDark
          ? "bg-[#202124] border border-[#3c4043] shadow-sm"
          : "bg-white border border-[#dadce0] shadow-sm hover:shadow-md transition-shadow duration-300"
      } ${className}`}
    >
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}

export function StatusBadge({ status, isDark = false }) {
  const config = {
    pending: {
      bg: isDark
        ? "bg-[#422c00] text-[#fde293]"
        : "bg-[#fef7e0] text-[#b06000]",
      label: "Pending",
    },
    locked: {
      bg: isDark
        ? "bg-[#3c4043] text-[#9aa0a6]"
        : "bg-[#f1f3f4] text-[#5f6368]",
      label: "Locked",
    },
    approved: {
      bg: isDark
        ? "bg-[#0d3b16] text-[#81c995]"
        : "bg-[#e6f4ea] text-[#137333]",
      label: "Approved",
    },
    rejected: {
      bg: isDark
        ? "bg-[#5c1010] text-[#f28b82]"
        : "bg-[#fce8e6] text-[#c5221f]",
      label: "Rejected",
    },
    completed: {
      bg: isDark
        ? "bg-[#0f1f42] text-[#8ab4f8]"
        : "bg-[#e8f0fe] text-[#1a73e8]",
      label: "Completed",
    },
  };

  const c = config[status] || config.pending;
  return (
    <span
      className={`px-3 py-1 rounded-full text-[12px] font-semibold tracking-wide border border-transparent ${c.bg}`}
    >
      {c.label}
    </span>
  );
}
