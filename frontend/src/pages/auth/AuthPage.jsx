import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import LoginForm from "../../components/auth/LoginForm";
import SignupForm from "../../components/auth/SignupForm";
import SignupFormWithFaceVerification from "../../components/auth/SignupFormWithFaceVerification";
import Particles from "../../components/visuals/Particles";
import logo from "../../assets/logo.png";

const ROLE_LABELS = {
  student: "Student",
  professor: "Professor",
  admin: "Admin",
  library_admin: "Library Admin",
  cashier_admin: "Cashier Admin",
  registrar_admin: "Registrar Admin",
  super_admin: "Super Admin",
};

function formatRoleLabel(role) {
  if (!role) return null;

  return (
    ROLE_LABELS[role] ||
    role
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export default function AuthPage({
  onBackToHome,
  isDark,
  selectedRole,
  onLoginSuccess,
}) {
  const canSignUp = true;
  const selectedRoleLabel = formatRoleLabel(selectedRole);
  const selectedRoleIsAdmin =
    selectedRole === "admin" || selectedRole?.includes("admin");
  const navigate = useNavigate();

  const [isSignUp, setIsSignUp] = useState(() => {
    const savedMode = sessionStorage.getItem("authMode") === "signup";
    return canSignUp && savedMode;
  });

  useEffect(() => {
    sessionStorage.setItem("authMode", isSignUp ? "signup" : "login");
  }, [isSignUp]);

  useEffect(() => {
    document.title = isSignUp ? "SmartClearance | Signup" : "SmartClearance | Login";
  }, [isSignUp]);

  return (
    <div
      className={`relative flex min-h-screen items-center justify-center p-4 overflow-x-hidden transition-colors duration-500 ${isDark ? "bg-slate-950" : "bg-[#f8fafc]"}`}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-[0.15]"></div>
        <div className="absolute inset-0 z-0">
          <Particles
            particleColors={
              isDark ? ["#4ade80", "#facc15"] : ["#22c55e", "#eab308"]
            }
            particleCount={120}
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
        <div
          className={`absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full blur-[60px] animate-float transition-colors duration-500 ${isDark ? "bg-yellow-900/10" : "bg-yellow-200/20"}`}
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          layout: { duration: 0.3, ease: "easeInOut" },
          opacity: { duration: 0.5 },
        }}
        className={`w-full max-w-[500px] rounded-3xl overflow-visible relative z-20 transition-all duration-500 ${isDark ? "spatial-glass-dark" : "spatial-glass"}`}
      >
        <div
          className={`sticky top-0 z-30 pt-8 px-8 mb-8 backdrop-blur-xl transition-colors duration-500 border-b rounded-t-3xl ${isDark ? "bg-slate-900/40 border-slate-800" : "bg-white/40 border-gray-100"}`}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="SmartClearance Logo"
                className="w-10 h-10 object-contain drop-shadow-md"
              />
            </div>
            <button
              onClick={() => {
                sessionStorage.removeItem("authMode");
                onBackToHome();
                navigate("/select-role");
              }}
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
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
              Back to Role Selection
            </button>
          </div>

          <div className="pb-4">
            <motion.div
              key={isSignUp ? "signup-header" : "login-header"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h1
                className={`text-3xl font-extrabold mb-2 font-display transition-colors ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {isSignUp ? "Create your account" : "Sign in to your account"}
              </h1>
            </motion.div>
            {!isSignUp && selectedRoleLabel && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.05 }}
                className="mb-3"
              >
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${selectedRoleIsAdmin ? (isDark ? "bg-indigo-500/15 text-indigo-200 border border-indigo-400/20" : "bg-indigo-50 text-indigo-700 border border-indigo-200") : (isDark ? "bg-green-500/15 text-green-200 border border-green-400/20" : "bg-green-50 text-green-700 border border-green-200")}`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${selectedRoleIsAdmin ? "bg-indigo-400" : "bg-green-500"}`}
                  ></span>
                  <span>
                    Signing in as{" "}
                    <span className="font-bold">{selectedRoleLabel}</span>
                  </span>
                </span>
              </motion.div>
            )}
            <p
              className={`text-sm font-medium transition-colors ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {isSignUp ? "Already have an account?" : "Don't have an account?"}
              <button
                onClick={() => canSignUp && setIsSignUp(!isSignUp)}
                disabled={!canSignUp}
                className={`ml-1 font-bold transition-colors ${
                  canSignUp
                    ? "text-green-600 hover:text-green-500"
                    : "text-gray-400 cursor-not-allowed"
                }`}
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>
        </div>

        <div className="relative px-8 md:px-10 pb-8">
          <AnimatePresence mode="popLayout" initial={false}>
            {!isSignUp ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <LoginForm
                  onSwitchMode={() => canSignUp && setIsSignUp(true)}
                  isDark={isDark}
                  selectedRole={selectedRole}
                  onLoginSuccess={onLoginSuccess}
                />
              </motion.div>
            ) : (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {selectedRole === "student" ? (
                  <SignupFormWithFaceVerification
                    onSwitchMode={() => setIsSignUp(false)}
                    isDark={isDark}
                  />
                ) : (
                  <SignupForm
                    onSwitchMode={() => setIsSignUp(false)}
                    isDark={isDark}
                    selectedRole={selectedRole}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
