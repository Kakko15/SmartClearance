import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Particles from "../../components/visuals/Particles";
import logo from "../../assets/logo.png";

export default function RoleSelectionPage({
  onRoleSelect,
  onBackToHome,
  isDark,
}) {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const navigate = useNavigate();
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  // Focus trap for admin modal
  const handleModalKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      setShowAdminModal(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key !== "Tab" || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, []);

  // Auto-focus first button when modal opens
  useEffect(() => {
    if (showAdminModal && modalRef.current) {
      const firstBtn = modalRef.current.querySelector("button");
      firstBtn?.focus();
    }
  }, [showAdminModal]);

  useEffect(() => {
    document.title = "SmartClearance";
  }, []);

  const roles = [
    {
      id: "student",
      title: "Student",
      description: "Apply for graduation clearance",
      icon: (
        <svg
          className="w-12 h-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
      color: "green",
    },
    {
      id: "signatory",
      title: "Signatory",
      description: "Approve student clearances",
      icon: (
        <svg
          className="w-12 h-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
      color: "green",
    },
    {
      id: "staff",
      title: "Staff",
      description: "Process clearances & approvals",
      icon: (
        <svg
          className="w-12 h-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
      color: "indigo",
      isStaff: true,
    },
  ];

  const staffTypes = [
    {
      id: "librarian",
      title: "Librarian",
      description: "Process library clearances",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
          />
        </svg>
      ),
    },
    {
      id: "cashier",
      title: "Cashier",
      description: "Process financial clearances",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: "registrar",
      title: "Registrar",
      description: "Final approval & certificates",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
          />
        </svg>
      ),
    },
  ];

  const handleRoleClick = (roleId, e) => {
    if (roleId === "staff") {
      triggerRef.current = e?.currentTarget;
      setShowAdminModal(true);
    } else {
      onRoleSelect(roleId);
    }
  };

  const handleRoleKeyDown = (roleId, e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRoleClick(roleId, e);
    }
  };

  const handleStaffSelect = (staffType) => {
    setShowAdminModal(false);
    onRoleSelect(staffType);
  };

  return (
    <div
      className={`relative flex min-h-screen items-center justify-center p-4 overflow-hidden transition-colors duration-500 ${isDark ? "bg-slate-950" : "bg-[#f8fafc]"}`}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-[0.15]"></div>
        <div className="absolute inset-0 z-0">
          <Particles
            particleColors={
              isDark ? ["#4ade80", "#facc15"] : ["#22c55e", "#eab308"]
            }
            particleCount={40}
            particleSpread={10}
            speed={0.1}
            particleBaseSize={100}
            moveParticlesOnHover={true}
            alphaParticles={false}
            disableRotation={false}
          />
        </div>
        <div
          className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[80px] animate-float transition-colors duration-500 ${isDark ? "bg-green-900/20" : "bg-green-200/40"}`}
        ></div>
        <div
          className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[80px] animate-float transition-colors duration-500 ${isDark ? "bg-emerald-900/20" : "bg-emerald-200/30"}`}
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      <div className="relative z-20 w-full max-w-6xl">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center gap-4 mb-6"
          >
            <img
              src={logo}
              alt="SmartClearance Logo"
              className="w-16 h-16 object-contain drop-shadow-lg"
            />
            <h1
              className={`text-5xl font-extrabold font-display transition-colors ${isDark ? "text-white" : "text-gray-900"}`}
            >
              Smart<span className="text-green-500">Clearance</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`text-xl font-medium transition-colors ${isDark ? "text-slate-300" : "text-gray-600"}`}
          >
            Select your role to continue
          </motion.p>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            onClick={() => navigate("/home")}
            className={`mt-4 flex items-center gap-2 mx-auto text-sm font-medium transition-colors ${isDark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Home
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {roles.map((role, index) => (
            <motion.div
              key={role.id}
              role="button"
              tabIndex={0}
              aria-label={`${role.title} — ${role.description}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
              whileHover={{ scale: 1.05, y: -5 }}
              onClick={(e) => handleRoleClick(role.id, e)}
              onKeyDown={(e) => handleRoleKeyDown(role.id, e)}
              className={`cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 ${
                isDark
                  ? "spatial-glass-dark hover:shadow-2xl hover:shadow-green-500/20"
                  : "spatial-glass hover:shadow-2xl hover:shadow-green-500/30"
              }`}
            >
              <div className="p-6 text-center">
                <div
                  className={`inline-flex p-4 rounded-xl mb-4 transition-colors ${
                    role.color === "green"
                      ? isDark
                        ? "bg-green-500/20 text-green-400"
                        : "bg-green-100 text-green-600"
                      : role.color === "indigo"
                        ? isDark
                          ? "bg-indigo-500/20 text-indigo-400"
                          : "bg-indigo-100 text-indigo-600"
                        : isDark
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-purple-100 text-purple-600"
                  }`}
                >
                  {role.icon}
                </div>

                <h2
                  className={`text-xl font-bold mb-2 transition-colors ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {role.title}
                </h2>
                <p
                  className={`text-sm transition-colors ${isDark ? "text-slate-400" : "text-gray-600"}`}
                >
                  {role.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {showAdminModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAdminModal(false)}
            >
              <motion.div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label="Select Staff Type"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", duration: 0.5 }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleModalKeyDown}
                className={`w-full max-w-2xl rounded-3xl overflow-hidden ${isDark ? "spatial-glass-dark" : "spatial-glass"}`}
              >
                <div
                  className={`p-6 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2
                        className={`text-2xl font-bold transition-colors ${isDark ? "text-white" : "text-gray-900"}`}
                      >
                        Select Staff Type
                      </h2>
                      <p
                        className={`text-sm mt-1 transition-colors ${isDark ? "text-slate-400" : "text-gray-600"}`}
                      >
                        Choose your staff role
                      </p>
                    </div>
                    <button
                      onClick={() => { setShowAdminModal(false); triggerRef.current?.focus(); }}
                      aria-label="Close staff type selection"
                      className={`p-2 rounded-xl transition-colors ${isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"}`}
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-3">
                  {staffTypes.map((staff, index) => (
                    <motion.button
                      key={staff.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => handleStaffSelect(staff.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                        isDark
                          ? "bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-indigo-500"
                          : "bg-white/50 hover:bg-white border border-gray-200 hover:border-indigo-500"
                      } hover:scale-[1.02]`}
                    >
                      <div
                        className={`p-3 rounded-xl ${isDark ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-100 text-indigo-600"}`}
                      >
                        {staff.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <h3
                          className={`font-bold transition-colors ${isDark ? "text-white" : "text-gray-900"}`}
                        >
                          {staff.title}
                        </h3>
                        <p
                          className={`text-sm transition-colors ${isDark ? "text-slate-400" : "text-gray-600"}`}
                        >
                          {staff.description}
                        </p>
                      </div>
                      <svg
                        className={`w-6 h-6 transition-colors ${isDark ? "text-slate-600" : "text-gray-400"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className={`mt-12 max-w-4xl mx-auto rounded-2xl p-6 border transition-colors ${
            isDark
              ? "bg-slate-900/50 border-slate-700"
              : "bg-white/50 border-gray-200"
          }`}
        >
          <div className="flex items-start gap-4">
            <svg
              className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3
                className={`font-bold mb-2 transition-colors ${isDark ? "text-white" : "text-gray-900"}`}
              >
                Isabela State University Campus - Graduation Clearance System
              </h3>
              <p
                className={`text-sm transition-colors ${isDark ? "text-slate-400" : "text-gray-600"}`}
              >
                Select your role above to login. Contact your administrator if
                you don't have an account.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
