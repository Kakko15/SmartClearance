import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NotificationBell from "../features/NotificationBell";

export default function Topbar({
  user,
  onSignOut,
  onOpenSettings,
  theme = "light",
  sidebarCollapsed,
  notifications: externalNotifications,
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  const isDark = theme === "dark";
  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`fixed top-0 h-20 z-30 transition-all duration-300 ${
        isDark
          ? "bg-slate-900/95 border-b border-white/10"
          : "bg-white/95 border-b border-gray-200"
      } backdrop-blur-xl shadow-lg`}
      style={{
        left: sidebarCollapsed ? "80px" : "280px",
        right: 0,
        width: `calc(100% - ${sidebarCollapsed ? "80px" : "280px"})`,
      }}
    >
      <div className="h-full px-6 flex items-center justify-between">
        <div>
          <h1
            className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          >
            Dashboard
          </h1>
          <p
            className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
          >
            Welcome back, {user?.full_name?.split(" ")[0] || "User"}!
          </p>
        </div>

        <div className="flex items-center gap-4">
          <NotificationBell isDarkMode={isDark} onOpenSettings={onOpenSettings} />

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-colors ${
                isDark
                  ? "hover:bg-white/10 text-slate-300"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full ${
                  isDark ? "bg-indigo-500" : "bg-green-500"
                } flex items-center justify-center text-white font-bold shadow-lg`}
              >
                {user?.full_name?.charAt(0) || "U"}
              </div>
              <div className="hidden md:block text-left">
                <p
                  className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {user?.full_name}
                </p>
                <p
                  className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {user?.role?.replace("_", " ")}
                </p>
              </div>
              <svg
                className={`w-4 h-4 transition-transform ${showProfileMenu ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            <AnimatePresence>
              {showProfileMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={`absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl overflow-hidden ${
                    isDark
                      ? "bg-slate-800 border border-white/10"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  <div
                    className={`p-4 border-b ${isDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-full ${
                          isDark ? "bg-indigo-500" : "bg-green-500"
                        } flex items-center justify-center text-white font-bold text-lg shadow-lg`}
                      >
                        {user?.full_name?.charAt(0) || "U"}
                      </div>
                      <div>
                        <p
                          className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                        >
                          {user?.full_name}
                        </p>
                        <p
                          className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
                        >
                          {user?.student_number ||
                            user?.role?.replace("_", " ")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="py-2">
                    {!isSuperAdmin && (
                      <>
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                            isDark
                              ? "hover:bg-white/5 text-slate-300"
                              : "hover:bg-gray-50 text-gray-700"
                          }`}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <span className="font-medium">View Profile</span>
                        </button>

                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            onOpenSettings();
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                            isDark
                              ? "hover:bg-white/5 text-slate-300"
                              : "hover:bg-gray-50 text-gray-700"
                          }`}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span className="font-medium">Settings</span>
                        </button>

                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                            isDark
                              ? "hover:bg-white/5 text-slate-300"
                              : "hover:bg-gray-50 text-gray-700"
                          }`}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                            />
                          </svg>
                          <span className="font-medium">Change Password</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onOpenSettings();
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                        isDark
                          ? "hover:bg-white/5 text-slate-300"
                          : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="font-medium">Settings</span>
                    </button>
                  </div>

                  <div
                    className={`p-2 border-t ${isDark ? "border-white/10" : "border-gray-200"}`}
                  >
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-semibold"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
