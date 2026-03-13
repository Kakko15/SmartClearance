import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { supabase } from "./lib/supabase";
import { useAuth, NavigateSetter } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";
import StudentDashboardGraduation from "./pages/StudentDashboardGraduation";
import AdminDashboard from "./pages/AdminDashboard";
import ProfessorDashboard from "./pages/ProfessorDashboard";
import LibraryAdminDashboard from "./pages/LibraryAdminDashboard";
import CashierAdminDashboard from "./pages/CashierAdminDashboard";
import RegistrarAdminDashboard from "./pages/RegistrarAdminDashboard";
import EnvironmentalImpact from "./components/features/EnvironmentalImpact";
import Settings from "./components/features/Settings";
import Loader from "./components/ui/Loader";
import ClickSpark from "./components/ui/ClickSpark";
import LandingPage from "./pages/LandingPage";
import PixelTrail from "./components/visuals/PixelTrail";
import AuthPage from "./pages/auth/AuthPage";
import RoleSelectionPage from "./pages/auth/RoleSelectionPage";
import PasswordResetPage from "./pages/auth/PasswordResetPage";
import TwoFactorVerify from "./components/auth/TwoFactorVerify";
import logo from "./assets/logo.png";

function LoaderPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.setItem("hasSeenLoader", "true");
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
  const { user, profile, handleSignOut, isDarkMode, toggleTheme, setShowSettings, setSettingsMode } = props;
  const dp = { onSignOut: handleSignOut, isDarkMode, toggleTheme };
  const sp = {
    onOpenSettings: (tab) => { setSettingsMode(tab === "appearance" ? "appearance" : "full"); setShowSettings(true); },
    onManageAccount: () => { setSettingsMode("account"); setShowSettings(true); },
  };

  if (profile.role === "library_admin") return <LibraryAdminDashboard adminId={user.id} {...dp} {...sp} />;
  if (profile.role === "cashier_admin") return <CashierAdminDashboard adminId={user.id} {...dp} {...sp} />;
  if (profile.role === "registrar_admin") return <RegistrarAdminDashboard adminId={user.id} {...dp} {...sp} />;
  if (profile.role === "professor") return <ProfessorDashboard professorId={user.id} professorInfo={profile} user={user} {...dp} {...sp} />;
  if (profile.role === "student") return <StudentDashboardGraduation studentId={user.id} studentInfo={profile} user={user} {...dp} {...sp} />;
  return (
    <>
      <div className="absolute inset-0 z-0 opacity-50 pointer-events-none">
        <PixelTrail gridSize={60} trailSize={0.2} maxAge={300} interpolate={8} color="#22c55e" glProps={{ antialias: false, powerPreference: "high-performance", alpha: true }} />
      </div>
      <header className="glass-panel sticky top-0 z-50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Logo" className="w-12 h-12 object-contain" />
              <div>
                <h1 className="font-display text-xl font-bold text-white tracking-wider">SMART<span className="text-primary-400">CLEARANCE</span></h1>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-secondary-500 animate-pulse"></span>
                  <p className="text-[10px] text-primary-400/80 tracking-widest uppercase">System Online</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <button onClick={() => setShowSettings(true)} className="text-gray-400 hover:text-primary-400 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <div className="text-right hidden sm:block border-l border-white/10 pl-6">
                <p className="text-sm font-bold text-white tracking-wide">{profile.full_name}</p>
                <p className="text-[10px] text-primary-400 uppercase tracking-widest">{profile.role.replace("_", " ")}</p>
              </div>
              <button onClick={handleSignOut} className="rounded-none border border-red-500/50 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all">LOGOUT</button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="mb-8 glass-card rounded-xl p-6 border-l-4 border-l-secondary-500">
          <EnvironmentalImpact studentId={null} />
        </div>
        <AdminDashboard adminId={user.id} adminInfo={profile} onSignOut={handleSignOut} onOpenSettings={() => setShowSettings(true)} isDarkMode={isDarkMode} />
      </main>
    </>
  );
}

function App() {
  const auth = useAuth();
  const { user, profile, initializing, selectedRole, showPasswordReset } = auth;
  const { twoFactorPending, pendingUser, pendingProfile } = auth;
  const { handleLoginSuccess, handleSignOut, handleRoleSelect, backToRoleSelection, complete2FA, cancel2FA } = auth;
  const { isDarkMode, themePreference, toggleTheme } = useTheme();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsMode, setSettingsMode] = useState("full");
  const isAuthenticated = !!user && !!profile;

  if (twoFactorPending && pendingUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? "bg-slate-950" : "bg-gray-50"}`}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`w-full max-w-md p-8 rounded-3xl shadow-xl border ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"}`}>
          <TwoFactorVerify userId={pendingUser.id} email={pendingUser.email} isDark={isDarkMode} onVerified={complete2FA} onCancel={cancel2FA} />
        </motion.div>
      </div>
    );
  }

  if (showPasswordReset) return <PasswordResetPage />;

  return (
    <ClickSpark sparkColor={isDarkMode ? "#22c55e" : "#10b981"} sparkSize={13} sparkRadius={15} sparkCount={10} duration={400}>
      <div className={`min-h-screen w-full font-sans transition-colors duration-500 ${isAuthenticated ? (isDarkMode ? "bg-[#030712] text-white" : "bg-[#FAFAFA] text-slate-800") : isDarkMode ? "bg-[#030712] text-slate-100" : "bg-[#FAFAFA] text-slate-800"}`}>
        {isAuthenticated && <div className="fixed inset-0 z-0 grid-bg opacity-20 pointer-events-none"></div>}
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={sessionStorage.getItem("hasSeenLoader") ? <Navigate to="/home" replace /> : <LoaderPage />} />

            <Route path="/home" element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : (
                <motion.div key="landing" exit={{ opacity: 0, y: -100 }} className={`relative z-40 ${isDarkMode ? "bg-slate-950" : "bg-white"}`}>
                  <LandingPage onEnter={() => {}} isDark={isDarkMode} toggleTheme={toggleTheme} />
                </motion.div>
              )
            } />

            <Route path="/select-role" element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : (
                <motion.div key="roleSelection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`relative z-40 ${isDarkMode ? "bg-slate-950" : "bg-white"}`}>
                  <RoleSelectionPage onRoleSelect={handleRoleSelect} onBackToHome={() => {}} isDark={isDarkMode} />
                </motion.div>
              )
            } />

            <Route path="/auth" element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : (
                initializing && Object.keys(localStorage).some(k => k.startsWith("sb-") && k.endsWith("-auth-token")) ? (
                  <div className="min-h-screen flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} className="relative z-10 min-h-screen">
                    <AuthPage isDark={isDarkMode} selectedRole={selectedRole} onLoginSuccess={handleLoginSuccess} onBackToHome={backToRoleSelection} />
                  </motion.div>
                )
              )
            } />

            <Route path="/dashboard" element={
              !isAuthenticated ? (
                initializing ? (
                  <div className="min-h-screen flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : <Navigate to={selectedRole ? "/auth" : "/select-role"} replace />
              ) : (
                <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} className="relative z-10 min-h-screen">
                  <DashboardContent user={user} profile={profile} handleSignOut={handleSignOut} isDarkMode={isDarkMode} toggleTheme={toggleTheme} setShowSettings={setShowSettings} setSettingsMode={setSettingsMode} />
                </motion.div>
              )
            } />

            <Route path="/reset-password" element={<PasswordResetPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
        {showSettings && (
          <Settings user={user} profile={profile} mode={settingsMode} onClose={() => setShowSettings(false)} theme={themePreference} setTheme={(t) => toggleTheme(t)} />
        )}
      </div>
    </ClickSpark>
  );
}

export default App;
