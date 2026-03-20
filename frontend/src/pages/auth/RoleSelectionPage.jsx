import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";

export default function RoleSelectionPage({ onRoleSelect, isDark }) {
  const [time, setTime] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if (e.key === "1") {
        e.preventDefault();
        onRoleSelect("student");
      }
      if (e.key === "2") {
        e.preventDefault();
        onRoleSelect("staff");
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [onRoleSelect]);

  const roles = [
    {
      id: "student",
      title: "Student Portal",
      description: "Access and track your graduation clearance progress.",
      icon: "school",
      shortcut: "1",
      glow: isDark
        ? "from-emerald-900/40 to-green-900/40"
        : "from-emerald-100/60 to-green-50/60",
      iconColor: isDark ? "text-emerald-400" : "text-emerald-600",
      hoverBorder: isDark
        ? "group-hover:border-emerald-500/50"
        : "group-hover:border-emerald-300",
    },
    {
      id: "staff",
      title: "Personnel Portal",
      description:
        "Unified secure login for Deans, Program Chairs, Librarian, Cashier, and Registrar.",
      icon: "admin_panel_settings",
      shortcut: "2",
      glow: isDark
        ? "from-blue-900/40 to-indigo-900/40"
        : "from-blue-100/60 to-indigo-50/60",
      iconColor: isDark ? "text-blue-400" : "text-blue-600",
      hoverBorder: isDark
        ? "group-hover:border-blue-500/50"
        : "group-hover:border-blue-300",
    },
  ];

  const handleRoleClick = (roleId, e) => {
    if (e) e.preventDefault();
    onRoleSelect(roleId);
  };

  const handleRoleKeyDown = (roleId, e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRoleClick(roleId, e);
    }
  };

  return (
    <div
      className={`flex min-h-screen font-sans transition-colors duration-700 overflow-hidden relative ${isDark ? "bg-[#030303] text-white" : "bg-[#FDFDFD] text-slate-900"}`}
    >
      {}
      <div className="absolute top-0 inset-x-0 p-6 md:p-10 flex justify-between items-center z-30">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => navigate("/home")}
          className={`group flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] backdrop-blur-md border 
            ${isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-slate-300 hover:text-white" : "bg-white/50 border-black/5 hover:bg-white hover:shadow-md hover:border-black/10 text-slate-600 hover:text-slate-900"}`}
        >
          <span
            className="material-symbols-rounded text-[18px] transition-transform duration-300 group-hover:-translate-x-1"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            arrow_back
          </span>
          <span className="text-sm font-semibold tracking-wide">Back</span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className={`text-sm font-semibold tracking-widest uppercase ${isDark ? "text-slate-500" : "text-slate-400"}`}
        >
          {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </motion.div>
      </div>

      {}
      <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
          className={`absolute w-[60vw] h-[60vw] rounded-full opacity-[0.14] mix-blend-screen filter blur-[100px] 
            ${isDark ? "bg-emerald-800 -translate-x-1/2 -translate-y-1/4" : "bg-emerald-200 -translate-x-1/2 -translate-y-1/4"}`}
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, -90, 0] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className={`absolute w-[70vw] h-[70vw] rounded-full opacity-[0.14] mix-blend-screen filter blur-[120px] 
            ${isDark ? "bg-blue-900 translate-x-1/4 translate-y-1/3" : "bg-blue-200/60 translate-x-1/4 translate-y-1/4"}`}
        />
      </div>

      {}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none z-0" />

      {}
      <main className="relative z-10 flex flex-col items-center justify-center w-full max-w-[840px] mx-auto px-6 py-20 min-h-screen">
        {}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center mb-16"
        >
          <div className="mb-8">
            <img
              src={logo}
              alt="SmartClearance Logo"
              className="w-16 h-16 object-contain drop-shadow-xl rounded-full"
            />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-display font-medium tracking-[-0.03em] leading-tight mb-5 drop-shadow-sm">
            Choose your portal
          </h1>
          <p
            className={`text-lg md:text-xl font-light tracking-wide max-w-lg ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            Secure access to the Isabela State University ecosystem. Select your
            designated role below.
          </p>
        </motion.div>

        {}
        <motion.div
          className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.1 } },
          }}
        >
          {roles.map((role) => (
            <motion.div
              key={role.id}
              variants={{
                hidden: { opacity: 0, y: 30, scale: 0.96 },
                show: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { type: "spring", stiffness: 350, damping: 30 },
                },
                hover: {
                  y: -8,
                  transition: { type: "spring", stiffness: 400, damping: 25 },
                },
                tap: {
                  scale: 0.97,
                  transition: { type: "spring", stiffness: 400, damping: 25 },
                },
              }}
              whileHover="hover"
              whileTap="tap"
              role="button"
              tabIndex={0}
              onClick={(e) => handleRoleClick(role.id, e)}
              onKeyDown={(e) => handleRoleKeyDown(role.id, e)}
              className={`group relative flex flex-col p-8 lg:p-10 rounded-[40px] cursor-pointer outline-none border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                ${
                  isDark
                    ? "bg-[#111111]/80 backdrop-blur-2xl border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
                    : "bg-white/90 backdrop-blur-2xl border-transparent shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.1)]"
                }
                ${role.hoverBorder}
              `}
            >
              {}
              <div
                className={`absolute inset-0 rounded-[40px] bg-gradient-to-b ${role.glow} opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none z-0`}
              />

              {}
              <div
                className={`relative z-10 flex items-center justify-center w-[72px] h-[72px] rounded-[24px] mb-8 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 shadow-sm
                ${isDark ? "bg-[#1A1A1A] border border-white/10" : "bg-slate-50 border border-slate-100"} ${role.iconColor}`}
              >
                <span
                  className="material-symbols-rounded text-[32px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {role.icon}
                </span>
              </div>

              {}
              <div className="relative z-10 flex flex-col flex-1 text-left">
                <h3
                  className={`text-[22px] font-bold tracking-tight mb-3 transition-colors duration-300 ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  {role.title}
                </h3>
                <p
                  className={`text-[15px] font-light leading-relaxed mb-8 flex-1 transition-colors duration-300 ${isDark ? "text-slate-400 group-hover:text-slate-300" : "text-slate-500 group-hover:text-slate-700"}`}
                >
                  {role.description}
                </p>

                {}
                <div className="w-full flex items-center justify-between mt-auto pt-6 border-t border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[12px] font-semibold uppercase tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      Key
                    </span>
                    <kbd
                      className={`min-w-[32px] h-8 flex items-center justify-center rounded-[10px] text-xs font-bold border transition-colors duration-300
                       ${
                         isDark
                           ? "bg-[#1A1A1A] border-white/10 text-slate-300 group-hover:bg-white/10 group-hover:border-white/20 group-hover:text-white"
                           : "bg-slate-50 border-slate-200 text-slate-500 group-hover:bg-white group-hover:border-slate-300 group-hover:text-slate-800"
                       }`}
                    >
                      {role.shortcut}
                    </kbd>
                  </div>
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                    ${
                      isDark
                        ? "bg-white/5 text-slate-400 group-hover:bg-white group-hover:text-black"
                        : "bg-black/5 text-slate-500 group-hover:bg-black group-hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-rounded text-[20px] transition-transform duration-500 group-hover:translate-x-1">
                      arrow_forward
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
