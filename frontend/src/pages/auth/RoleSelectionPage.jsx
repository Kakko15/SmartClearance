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
        <span className="material-symbols-rounded text-[40px] leading-none">school</span>
      ),
      color: "green",
    },
    {
      id: "signatory",
      title: "Signatory",
      description: "Approve student clearances",
      icon: (
        <span className="material-symbols-rounded text-[40px] leading-none">history_edu</span>
      ),
      color: "green",
    },
    {
      id: "staff",
      title: "Staff",
      description: "Process clearances & approvals",
      icon: (
        <span className="material-symbols-rounded text-[40px] leading-none">admin_panel_settings</span>
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
        <span className="material-symbols-rounded text-[32px] leading-none">local_library</span>
      ),
    },
    {
      id: "cashier",
      title: "Cashier",
      description: "Process financial clearances",
      icon: (
        <span className="material-symbols-rounded text-[32px] leading-none">payments</span>
      ),
    },
    {
      id: "registrar",
      title: "Registrar",
      description: "Final approval & certificates",
      icon: (
        <span className="material-symbols-rounded text-[32px] leading-none">description</span>
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
          className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[80px] transition-colors duration-500 ${isDark ? "bg-emerald-900/20" : "bg-emerald-200/30"}`}
        ></div>
      </div>

      <div className="relative z-20 w-full max-w-6xl">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
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
              Smart<span className="text-primary-600">Clearance</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className={`text-xl font-medium transition-colors ${isDark ? "text-slate-300" : "text-gray-600"}`}
          >
            Select your role to continue
          </motion.p>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            onClick={() => navigate("/home")}
            className={`mt-4 flex items-center gap-2 mx-auto text-sm font-medium transition-colors ${isDark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
          >
            <span className="material-symbols-rounded text-lg">arrow_back</span>
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
              transition={{ duration: 0.4, delay: 0.15 + index * 0.05, ease: [0.05, 0.7, 0.1, 1] }}
              onClick={(e) => handleRoleClick(role.id, e)}
              onKeyDown={(e) => handleRoleKeyDown(role.id, e)}
              className={`cursor-pointer rounded-[24px] overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1 ${
                isDark
                  ? "spatial-glass-dark hover:bg-slate-900/60"
                  : "spatial-glass hover:bg-white/80"
              }`}
            >
              <div className="p-6 text-center">
                <div
                  className={`inline-flex p-4 rounded-full mb-4 transition-colors ${
                    role.color === "green"
                      ? isDark
                        ? "bg-primary-900/40 text-primary-400"
                        : "bg-primary-100/60 text-primary-700"
                      : role.color === "indigo"
                        ? isDark
                          ? "bg-secondary-900/40 text-secondary-400"
                          : "bg-secondary-100/60 text-secondary-700"
                        : isDark
                          ? "bg-purple-900/40 text-purple-400"
                          : "bg-purple-100/60 text-purple-700"
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
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
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
                      className={`p-2 rounded-full transition-colors ${isDark ? "hover:bg-white/10 text-slate-400 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"}`}
                    >
                      <span className="material-symbols-rounded">close</span>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-3">
                  {staffTypes.map((staff, index) => (
                    <motion.button
                      key={staff.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 + 0.1 }}
                      onClick={() => handleStaffSelect(staff.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 ease-out hover:scale-[1.02] ${
                        isDark
                          ? "bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-indigo-500"
                          : "bg-white/50 hover:bg-white border border-gray-200 hover:border-indigo-500"
                      }`}
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
                      <span className={`material-symbols-rounded transition-colors ${isDark ? "text-slate-600" : "text-gray-400"}`}>chevron_right</span>
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
          transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
          className={`mt-12 max-w-4xl mx-auto rounded-2xl p-6 border transition-colors ${
            isDark
              ? "bg-slate-900/50 border-slate-700"
              : "bg-white/50 border-gray-200"
          }`}
        >
          <div className="flex items-start gap-4">
            <span className="material-symbols-rounded text-primary-600 text-[28px] flex-shrink-0 mt-0.5">info</span>
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
