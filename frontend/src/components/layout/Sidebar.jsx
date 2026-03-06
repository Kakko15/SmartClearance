import { motion, AnimatePresence } from "framer-motion";

export default function Sidebar({
  menuItems,
  activeView,
  onViewChange,
  isCollapsed,
  onToggleCollapse,
  theme = "light",
}) {
  const isDark = theme === "dark";

  return (
    <motion.aside
      initial={{ x: -300 }}
      animate={{ x: 0, width: isCollapsed ? "80px" : "280px" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`fixed left-0 top-0 h-screen z-40 ${
        isDark
          ? "bg-slate-900/95 border-r border-white/10"
          : "bg-white/95 border-r border-gray-200"
      } backdrop-blur-xl shadow-2xl flex flex-col`}
    >
      <div className="h-20 flex items-center justify-between px-6 border-b border-current/10">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <div
                className={`w-10 h-10 rounded-xl ${
                  isDark ? "bg-indigo-500" : "bg-green-500"
                } flex items-center justify-center shadow-lg`}
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                </svg>
              </div>
              <div>
                <h2
                  className={`font-bold text-lg ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  Smart Clearance
                </h2>
                <p
                  className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  System
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={onToggleCollapse}
          className={`p-2 rounded-lg transition-colors ${
            isDark
              ? "hover:bg-white/10 text-slate-400 hover:text-white"
              : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
          }`}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
        <div className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${
                activeView === item.id
                  ? isDark
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                    : "bg-green-500 text-white shadow-lg shadow-green-500/30"
                  : isDark
                    ? "text-slate-400 hover:bg-white/5 hover:text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <div className={`flex-shrink-0 ${isCollapsed ? "mx-auto" : ""}`}>
                {item.icon}
              </div>
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="font-semibold text-sm whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {!isCollapsed && item.badge && (
                <span
                  className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <div
        className={`p-4 border-t ${isDark ? "border-white/10" : "border-gray-200"}`}
      >
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-xl ${
                isDark ? "bg-white/5" : "bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span
                  className={`text-xs font-bold ${isDark ? "text-slate-400" : "text-gray-600"}`}
                >
                  System Online
                </span>
              </div>
              <p
                className={`text-xs ${isDark ? "text-slate-500" : "text-gray-500"}`}
              >
                Smart Clearance v2.0
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
