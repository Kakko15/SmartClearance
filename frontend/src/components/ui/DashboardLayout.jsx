import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeftIcon,
  ArrowRightOnRectangleIcon,
  CogIcon,
  Bars3Icon,
  PencilSquareIcon,
  MoonIcon,
  SunIcon,
} from "./Icons";

export default function DashboardLayout({
  theme,
  menuItems,
  activeView,
  setActiveView,
  userInfo,
  onSignOut,
  onOpenSettings,
  onManageAccount,
  isDarkMode,
  toggleTheme,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [dropdownView, setDropdownView] = useState("main");
  const profileDropdownRef = useRef(null);

  const currentThemePref = typeof window !== "undefined" ? (localStorage.getItem("theme") || "system") : "system";

  useEffect(() => {
    if (!profileDropdownOpen) {
      setTimeout(() => setDropdownView("main"), 200);
    }
  }, [profileDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fallback defaults for a Google Material You style if theme misses them
  const bgC = theme.bg || "bg-[#FAFAFA]";
  const sidebarBg = theme.sidebarGradient || "bg-white border-r border-slate-200";
  const sidebarText = theme.sidebarText || "text-slate-600";
  const sidebarActive = theme.sidebarActive || "bg-primary-50 text-primary-600";
  const sidebarInactive = theme.sidebarInactive || "text-slate-600 hover:bg-slate-50";
  const topbarBg = theme.topbar || "bg-white border-b border-slate-200";

  return (
    <div className={`flex h-screen ${bgC} font-sans selection:bg-blue-100 selection:text-blue-900`}>
      {/* Optional decorative glows, hidable */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-0 left-1/4 w-[500px] h-[500px] ${theme.glow1 || "hidden"} rounded-full blur-[120px]`} />
        <div className={`absolute bottom-0 right-1/4 w-[600px] h-[600px] ${theme.glow2 || "hidden"} rounded-full blur-[120px]`} />
      </div>

      <motion.div
        layout
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 68 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className={`${sidebarBg} ${sidebarText} flex flex-col relative z-20 flex-shrink-0 transition-colors duration-200`}
      >
        <div className="flex flex-col gap-4 mt-3 px-3">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2.5 rounded-full transition-colors flex-shrink-0 ${theme.topbarBtn || 'hover:bg-slate-50 text-slate-500'}`}
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  layout
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ opacity: { duration: 0.15 }, width: { type: "spring", bounce: 0, duration: 0.3 } }}
                  className="overflow-hidden flex items-center"
                >
                  <span className={`font-medium text-[18px] tracking-tight whitespace-nowrap ml-3 ${theme.topbarText || 'text-slate-900'}`}
                        style={{ fontFamily: 'Google Sans, sans-serif' }}>
                    {theme.name}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center mt-2">
             <button
                className={`w-full flex items-center relative group transition-colors rounded-[16px] h-[44px] ${theme.bg === 'bg-[#030712]' ? 'bg-primary-500/10 text-primary-400 hover:bg-primary-500/20' : 'bg-primary-100 text-primary-900 hover:bg-primary-200'}`}
             >
                <div className="flex items-center justify-center w-[44px] h-[44px] flex-shrink-0">
                  <PencilSquareIcon className="w-5 h-5 flex-shrink-0" />
                </div>
                {!sidebarOpen && (
                  <div className={`pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${theme.bg === 'bg-[#030712]' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-900'}`}>
                    New Request
                  </div>
                )}
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.div
                      layout
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ opacity: { duration: 0.15 }, width: { type: "spring", bounce: 0, duration: 0.3 } }}
                      className="overflow-hidden whitespace-nowrap pr-4"
                    >
                       <span className="text-[14px] font-medium">New Request</span>
                    </motion.div>
                  )}
                </AnimatePresence>
             </button>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-3">
          {menuItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center relative rounded-full transition-colors duration-150 group h-[44px] mb-0.5 ${
                  isActive ? sidebarActive : sidebarInactive
                }`}
              >
                <div className="flex items-center justify-center w-[44px] h-[44px] flex-shrink-0">
                  <span className={`w-6 h-6 flex items-center justify-center ${isActive ? "text-primary-600" : "text-slate-500 group-hover:text-slate-900"}`}>
                    {item.icon}
                  </span>
                </div>
                {!sidebarOpen && (
                  <div className={`pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${theme.bg === 'bg-[#030712]' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-900'}`}>
                    {item.label}
                  </div>
                )}
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.div
                      layout
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ opacity: { duration: 0.15 }, width: { type: "spring", bounce: 0, duration: 0.3 } }}
                      className="flex-1 flex items-center justify-between overflow-hidden pr-4"
                    >
                      <span className={`font-medium whitespace-nowrap text-[14px] ${isActive ? "text-primary-600 font-semibold" : "text-slate-600"}`}>
                        {item.label}
                      </span>
                      {item.count != null && item.count > 0 && (
                        <span
                          className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isActive ? "bg-primary-100 text-primary-600" : "bg-slate-100 text-slate-600"
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

        <div className="mt-auto px-3 pb-6 flex flex-col gap-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className={`w-full flex items-center relative group rounded-full transition-colors h-[44px] ${theme.topbarBtn || 'hover:bg-slate-50 text-slate-500'}`}
            >
              <div className="flex items-center justify-center w-[44px] h-[44px] flex-shrink-0">
                <CogIcon className="w-[22px] h-[22px]" />
              </div>
              {!sidebarOpen && (
                <div className={`pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${theme.bg === 'bg-[#030712]' ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-900'}`}>
                  Settings
                </div>
              )}
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ opacity: { duration: 0.15 }, width: { type: "spring", bounce: 0, duration: 0.3 } }}
                    className="overflow-hidden whitespace-nowrap pr-4"
                  >
                    <span className={`font-medium text-[14px] ${theme.topbarText || 'text-slate-600'}`}>
                      Settings
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          )}
        </div>
      </motion.div>

      <div className="flex-1 flex flex-col relative z-20 overflow-hidden">
        <div
          className={`h-[64px] ${topbarBg} flex items-center justify-between px-6 sm:px-8 flex-shrink-0 z-30 transition-shadow`}
        >
          <div>
            <h1 className={`text-[22px] font-normal tracking-tight ${theme.topbarText || "text-slate-900"}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
              {theme.dashboardTitle}
            </h1>
          </div>
          <div className="flex items-center mr-2 relative" ref={profileDropdownRef}>
            <button 
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-3 text-left focus:outline-none group"
            >
              <div className="hidden md:block text-right">
                <p className={`text-[14px] font-medium leading-tight ${theme.topbarText || 'text-slate-900'}`}>
                  {userInfo.name}
                </p>
                <p className={`text-[12px] leading-tight mt-0.5 ${theme.topbarSub || 'text-slate-500'}`}>
                  {userInfo.subtitle}
                </p>
              </div>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-medium text-[15px] shadow-sm transition-all focus:outline-none group-hover:ring-4 ring-black/5 dark:ring-white/10 ${theme.accentGradient || 'bg-primary-600 text-white'}`}>
                {userInfo.name?.charAt(0)}
              </div>
            </button>
            
            <AnimatePresence>
              {profileDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute right-1 top-full mt-2 ${dropdownView === "main" ? "w-64" : "w-[340px]"} transition-[width] duration-200 ease-out origin-top-right rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border z-50 overflow-hidden ${
                    theme.dropdownMenu || (isDarkMode ? 'bg-[#282a2d] border-[#3c4043]' : 'bg-white border-[#dadce0]')
                  }`}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {dropdownView === "main" ? (
                      <motion.div
                        key="main"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0, transition: { duration: 0.15, ease: "easeOut" } }}
                        exit={{ opacity: 0, x: -10, transition: { duration: 0.08, ease: "easeIn" } }}
                        className="p-2 flex flex-col gap-1 w-full"
                      >
                        {(onManageAccount || onOpenSettings) && (
                          <button
                            onClick={() => {
                              setProfileDropdownOpen(false);
                              (onManageAccount || onOpenSettings)();
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-4 text-[15px] font-medium transition-all duration-200 active:scale-[0.98] group ${
                              isDarkMode ? 'text-[#e8eaed] hover:bg-[#3c4043] hover:text-white' : 'text-[#3c4043] hover:bg-[#f1f3f4] hover:text-[#202124]'
                            }`}
                          >
                            <CogIcon className={`w-5 h-5 flex-shrink-0 transition-colors ${
                              isDarkMode ? 'text-[#9aa0a6] group-hover:text-white' : 'text-[#5f6368] group-hover:text-[#202124]'
                            }`} />
                            Manage Account
                          </button>
                        )}
                        {toggleTheme && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDropdownView("appearance");
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-[15px] font-medium transition-all duration-200 active:scale-[0.98] group ${
                              isDarkMode ? 'text-[#e8eaed] hover:bg-[#3c4043] hover:text-white' : 'text-[#3c4043] hover:bg-[#f1f3f4] hover:text-[#202124]'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <MoonIcon className={`w-5 h-5 flex-shrink-0 transition-colors ${
                                isDarkMode ? 'text-[#9aa0a6] group-hover:text-white' : 'text-[#5f6368] group-hover:text-[#202124]'
                              }`} />
                              Display & accessibility
                            </div>
                            <ArrowLeftIcon className={`w-4 h-4 rotate-180 flex-shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all ${
                              isDarkMode ? 'text-white' : 'text-[#202124]'
                            }`} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            onSignOut();
                          }}
                          className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-4 text-[15px] font-medium transition-all duration-200 active:scale-[0.98] group ${
                            isDarkMode ? 'text-[#e8eaed] hover:bg-red-900/20 hover:text-red-400' : 'text-[#3c4043] hover:bg-red-50 hover:text-red-700'
                          }`}
                        >
                          <ArrowRightOnRectangleIcon className={`w-5 h-5 flex-shrink-0 transition-colors ${
                            isDarkMode ? 'text-[#9aa0a6] group-hover:text-red-400' : 'text-[#5f6368] group-hover:text-red-600'
                          }`} />
                          Sign Out
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="appearance"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0, transition: { duration: 0.15, ease: "easeOut" } }}
                        exit={{ opacity: 0, x: 10, transition: { duration: 0.08, ease: "easeIn" } }}
                        className="p-2 flex flex-col w-full"
                      >
                        <div className="flex items-center gap-3 px-2 py-2 mb-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDropdownView("main");
                            }}
                            className={`p-1.5 rounded-full transition-all duration-200 active:scale-90 ${
                              isDarkMode ? 'hover:bg-[#3c4043] text-[#e8eaed]' : 'hover:bg-[#f1f3f4] text-[#3c4043]'
                            }`}
                          >
                            <ArrowLeftIcon className="w-5 h-5" />
                          </button>
                          <h3 className={`text-[18px] font-medium ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>Display & accessibility</h3>
                        </div>
                        
                        <div className="px-4 pb-3 flex gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-[#3c4043]' : 'bg-[#f1f3f4]'}`}>
                            <MoonIcon className={`w-5 h-5 ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`} />
                          </div>
                          <div>
                            <p className={`font-medium text-[15px] ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`}>Dark mode</p>
                            <p className={`text-[13px] leading-[1.4] mt-1 ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                              Adjust the appearance to reduce glare and give your eyes a break.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 mt-1 pb-1">
                          {[
                            { id: "light", label: "Off" },
                            { id: "dark", label: "On" },
                            { id: "system", label: "Automatic", sub: "We'll automatically adjust the display based on your device's system settings." }
                          ].map((opt) => (
                            <label
                              key={opt.id}
                              className={`group flex flex-col px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 active:scale-[0.98] ${
                                currentThemePref === opt.id
                                  ? isDarkMode ? 'bg-primary-900/20' : 'bg-primary-50/70'
                                  : isDarkMode ? 'hover:bg-[#3c4043]' : 'hover:bg-[#f1f3f4]'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span
                                  className={`text-[15px] font-medium transition-colors duration-200 ${
                                    currentThemePref === opt.id
                                      ? isDarkMode ? 'text-primary-400' : 'text-primary-700'
                                      : isDarkMode ? 'text-[#e8eaed]' : 'text-[#3c4043]'
                                  }`}
                                >
                                  {opt.label}
                                </span>
                                <div
                                  className={`relative w-[22px] h-[22px] rounded-full border-[2.5px] transition-all duration-300 ${
                                    currentThemePref === opt.id
                                      ? isDarkMode ? 'border-primary-400 scale-105' : 'border-primary-600 scale-105'
                                      : isDarkMode ? 'border-[#9aa0a6]' : 'border-[#5f6368]'
                                  }`}
                                >
                                  {currentThemePref === opt.id && (
                                    <motion.div
                                      layoutId="radio-active"
                                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                      className={`absolute inset-0 m-auto w-[11px] h-[11px] rounded-full ${isDarkMode ? 'bg-primary-400' : 'bg-primary-600'}`}
                                    />
                                  )}
                                </div>
                              </div>
                              {opt.sub && (
                                <p className={`text-[13px] mt-1 leading-[1.4] pr-8 transition-colors duration-200 ${
                                  currentThemePref === opt.id 
                                    ? isDarkMode ? 'text-primary-400/80' : 'text-primary-700/80'
                                    : isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'
                                }`}>
                                  {opt.sub}
                                </p>
                              )}
                              <input
                                type="radio"
                                name="theme_mode"
                                value={opt.id}
                                checked={currentThemePref === opt.id}
                                onChange={() => toggleTheme(opt.id)}
                                className="sr-only"
                              />
                            </label>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
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
          ? "bg-[#282a2d] shadow-sm"
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
