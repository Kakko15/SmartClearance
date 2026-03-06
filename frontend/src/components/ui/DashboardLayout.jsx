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

  return (
    <div className={`flex h-screen ${theme.bg}`}>
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className={`absolute top-0 left-1/4 w-[500px] h-[500px] ${theme.glow1 || "bg-green-400/10"} rounded-full blur-[120px] animate-pulse`}
        />
        <div
          className={`absolute bottom-0 right-1/4 w-[600px] h-[600px] ${theme.glow2 || "bg-emerald-400/5"} rounded-full blur-[120px]`}
        />
      </div>

      <motion.div
        animate={{ width: sidebarOpen ? 260 : 76 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`${theme.sidebarGradient} text-white flex flex-col shadow-2xl relative z-10 overflow-hidden flex-shrink-0`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3 overflow-hidden"
              >
                <div
                  className={`w-9 h-9 ${theme.accentGradient} rounded-xl flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0 text-sm`}
                >
                  {theme.abbrev}
                </div>
                <span className="font-bold text-white whitespace-nowrap tracking-tight">
                  {theme.name}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          >
            <motion.div
              animate={{ rotate: sidebarOpen ? 0 : 180 }}
              transition={{ duration: 0.3 }}
            >
              <ArrowLeftIcon className="w-4 h-4 text-white/70" />
            </motion.div>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 mt-1">
          {menuItems.map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                activeView === item.id
                  ? `${theme.sidebarActive} shadow-lg font-semibold`
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="flex-shrink-0 w-5 h-5">{item.icon}</span>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 flex items-center justify-between overflow-hidden"
                  >
                    <span className="font-medium whitespace-nowrap text-sm">
                      {item.label}
                    </span>
                    {item.count != null && item.count > 0 && (
                      <span
                        className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                          activeView === item.id ? "bg-white/20" : "bg-white/10"
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-white/50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2 h-2 ${theme.dotColor} rounded-full animate-pulse`}
                  />
                  <span>System Online</span>
                </div>
                <div>ISU Clearance v2.0</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <div
          className={`h-16 ${theme.topbar} backdrop-blur-xl flex items-center justify-between px-6 shadow-sm flex-shrink-0`}
        >
          <div>
            <h1
              className={`text-lg font-bold ${theme.topbarText || "text-gray-900"}`}
            >
              {theme.dashboardTitle}
            </h1>
            <p className={`text-xs ${theme.topbarSub || "text-gray-500"}`}>
              Isabela State University Campus
            </p>
          </div>
          <div className="flex items-center gap-3">
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className={`p-2 rounded-xl transition-all duration-200 ${theme.topbarBtn || "hover:bg-green-50"}`}
                title="Settings"
              >
                <CogIcon
                  className={`w-5 h-5 ${theme.topbarIcon || "text-gray-500"}`}
                />
              </button>
            )}
            <div
              className={`h-8 w-px ${theme.topbarDivider || "bg-gray-200"}`}
            />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p
                  className={`text-sm font-semibold ${theme.topbarText || "text-gray-900"}`}
                >
                  {userInfo.name}
                </p>
                {userInfo.subtitle && (
                  <p
                    className={`text-xs ${theme.topbarSub || "text-gray-500"}`}
                  >
                    {userInfo.subtitle}
                  </p>
                )}
              </div>
              <div
                className={`w-10 h-10 ${theme.accentGradient} rounded-xl flex items-center justify-center text-white font-bold shadow-lg ${theme.accentShadow || ""}`}
              >
                {userInfo.name?.charAt(0)}
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSignOut}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 text-sm ${
                theme.logoutBtn ||
                "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white"
              }`}
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span>Logout</span>
            </motion.button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="h-full"
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay }}
      className={`relative overflow-hidden rounded-2xl backdrop-blur-xl ${
        isDark
          ? "bg-white/[0.06] border border-white/10 shadow-xl shadow-black/20"
          : "bg-white/70 border border-gray-100/50 shadow-lg"
      } ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}

export function StatusBadge({ status, isDark = false }) {
  const config = {
    pending: {
      bg: isDark
        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
        : "bg-amber-50 text-amber-700 border-amber-200",
      label: "Pending",
    },
    approved: {
      bg: isDark
        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
        : "bg-emerald-50 text-emerald-700 border-emerald-200",
      label: "Approved",
    },
    rejected: {
      bg: isDark
        ? "bg-red-500/20 text-red-400 border-red-500/30"
        : "bg-red-50 text-red-700 border-red-200",
      label: "Rejected",
    },
    completed: {
      bg: isDark
        ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
        : "bg-blue-50 text-blue-700 border-blue-200",
      label: "Completed",
    },
  };

  const c = config[status] || config.pending;
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg}`}
    >
      {c.label}
    </span>
  );
}
