import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";
import StudentDashboardGraduation from "./pages/StudentDashboardGraduation";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SignatoryDashboard from "./pages/SignatoryDashboard";
import LibrarianDashboard from "./pages/LibrarianDashboard";
import CashierDashboard from "./pages/CashierDashboard";
import RegistrarDashboard from "./pages/RegistrarDashboard";
import Settings from "./components/features/Settings";
import Loader from "./components/ui/Loader";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/auth/AuthPage";
import RoleSelectionPage from "./pages/auth/RoleSelectionPage";
import PasswordResetPage from "./pages/auth/PasswordResetPage";
import SuperAdminLoginPage from "./pages/auth/SuperAdminLoginPage";
import TwoFactorVerify from "./components/auth/TwoFactorVerify";
import CertificateVerifyPage from "./pages/CertificateVerifyPage";

// Per-tab unique key so each tab shows the loader independently
const TAB_ID = `loader_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function LoaderPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.setItem(TAB_ID, "1");
      navigate("/home", { replace: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [navigate]);
  return (
    <motion.div exit={{ opacity: 0 }} className="absolute inset-0 z-50">
      <Loader />
    </motion.div>
  );
}

function DashboardContent(props) {
  const { user, profile, handleSignOut, isDarkMode, toggleTheme, setShowSettings } = props;
  const dp = { onSignOut: handleSignOut, isDarkMode, toggleTheme };
  const sp = {
    onOpenSettings: () => { setShowSettings(true); },
    onManageAccount: () => { setShowSettings(true); },
  };

  if (profile.role === "librarian") return <LibrarianDashboard adminId={user.id} user={user} {...dp} {...sp} />;
  if (profile.role === "cashier") return <CashierDashboard adminId={user.id} user={user} {...dp} {...sp} />;
  if (profile.role === "registrar") return <RegistrarDashboard adminId={user.id} user={user} {...dp} {...sp} />;
  if (profile.role === "signatory") return <SignatoryDashboard professorId={user.id} professorInfo={profile} user={user} {...dp} {...sp} />;
  if (profile.role === "student") return <StudentDashboardGraduation studentId={user.id} studentInfo={profile} user={user} {...dp} {...sp} />;
  if (profile.role === "super_admin") return <SuperAdminDashboard adminId={user.id} adminRole={profile.role} isDarkMode={isDarkMode} toggleTheme={toggleTheme} {...dp} {...sp} />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <p>Unknown role: {profile.role}</p>
    </div>
  );
}


function App() {
  const auth = useAuth();
  const { user, setUser, profile, initializing, selectedRole, showPasswordReset } = auth;
  const { twoFactorPending, pendingUser } = auth;
  const { handleLoginSuccess, handleSignOut, handleRoleSelect, backToRoleSelection, complete2FA, cancel2FA } = auth;
  const { isDarkMode, themePreference, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const isAuthenticated = !!user && !!profile;

  if (twoFactorPending && pendingUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? "bg-slate-950" : "bg-gray-50"}`}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`w-full max-w-md p-8 rounded-3xl shadow-xl border overflow-hidden ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"}`}>
          <TwoFactorVerify userId={pendingUser.id} email={pendingUser.email} isDark={isDarkMode} onVerified={complete2FA} onCancel={cancel2FA} />
        </motion.div>
      </div>
    );
  }

  if (showPasswordReset) return <PasswordResetPage />;

  return (
    <>
      <div className={`min-h-screen w-full font-sans transition-colors duration-500 ${isAuthenticated ? (isDarkMode ? "bg-[#030712] text-white" : "bg-[#FAFAFA] text-slate-800") : isDarkMode ? "bg-[#030712] text-slate-100" : "bg-[#FAFAFA] text-slate-800"}`}>
        {isAuthenticated && <div className="fixed inset-0 z-0 grid-bg opacity-20 pointer-events-none"></div>}
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={sessionStorage.getItem(TAB_ID) ? <Navigate to="/home" replace /> : <LoaderPage />} />

            <Route path="/home" element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : (
                <motion.div key="landing" exit={{ opacity: 0, y: -100 }} className={`relative z-40 ${isDarkMode ? "bg-slate-950" : "bg-white"}`}>
                  {/* BUG 7 FIX: Navigate to /select-role instead of no-op */}
                  <LandingPage onEnter={() => navigate("/select-role")} isDark={isDarkMode} toggleTheme={toggleTheme} />
                </motion.div>
              )
            } />

            <Route path="/select-role" element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : (
                <motion.div key="roleSelection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`relative z-40 ${isDarkMode ? "bg-slate-950" : "bg-white"}`}>
                  {/* BUG 8 FIX: Navigate to /home instead of no-op */}
                  <RoleSelectionPage onRoleSelect={handleRoleSelect} onBackToHome={() => navigate("/home")} isDark={isDarkMode} />
                </motion.div>
              )
            } />

            <Route path="/auth" element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : (
                initializing && Object.keys(localStorage).some(k => k.startsWith("sb-") && k.endsWith("-auth-token")) ? (
                  <div className="min-h-screen flex items-center justify-center">
                    {/* BUG 14 FIX: border-3 is not a standard Tailwind class, use border-[3px] */}
                    <div className="w-8 h-8 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }} className="relative z-10 min-h-screen">
                    <AuthPage isDark={isDarkMode} selectedRole={selectedRole} onLoginSuccess={handleLoginSuccess} onBackToHome={backToRoleSelection} />
                  </motion.div>
                )
              )
            } />

            <Route path="/dashboard" element={
              !isAuthenticated ? (
                initializing ? (
                  <div className="min-h-screen flex items-center justify-center">
                    {/* BUG 14 FIX: border-3 is not a standard Tailwind class, use border-[3px] */}
                    <div className="w-8 h-8 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : <Navigate to={selectedRole ? "/auth" : "/select-role"} replace />
              ) : (
                <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }} className="relative z-10 min-h-screen">
                  <DashboardContent user={user} profile={profile} handleSignOut={handleSignOut} isDarkMode={isDarkMode} toggleTheme={toggleTheme} setShowSettings={setShowSettings} />
                </motion.div>
              )
            } />

            <Route path="/super-admin" element={
              isAuthenticated && profile?.role === "super_admin" ? <Navigate to="/dashboard" replace /> : <SuperAdminLoginPage />
            } />
            <Route path="/reset-password" element={<PasswordResetPage />} />
            <Route path="/verify/:code" element={<CertificateVerifyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
        {showSettings && (
          <Settings user={user} profile={profile} onClose={() => setShowSettings(false)} theme={themePreference} setTheme={(t) => toggleTheme(t)} onAvatarUpdate={(url) => setUser(prev => ({ ...prev, user_metadata: { ...prev.user_metadata, avatar_url: url } }))} />
        )}
      </div>
    </>
  );
}

export default App;
