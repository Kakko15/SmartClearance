import { useState, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";
import { supabase } from "./lib/supabase";
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
import TwoFactorSetup from "./components/auth/TwoFactorSetup";
import CertificateVerifyPage from "./pages/CertificateVerifyPage";

const TAB_ID = `loader_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function DashboardSkeletonShell({ isDark }) {
  return (
    <div className={`min-h-screen flex ${isDark ? "bg-[#030712]" : "bg-[#f8f9fa]"} overflow-hidden`}>
      {/* Sidebar Skeleton */}
      <div className={`hidden lg:flex w-[280px] flex-col h-screen border-r ${isDark ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-[#dadce0]"} p-6 flex-shrink-0`}>
        <div className={`w-36 h-8 rounded-lg animate-pulse mb-10 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`} />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`w-full h-11 rounded-xl animate-pulse ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header Skeleton */}
        <header className={`h-[72px] border-b flex items-center justify-between px-6 flex-shrink-0 ${isDark ? "bg-[#282a2d]/50 border-[#3c4043]" : "bg-white/50 border-[#dadce0]"}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl animate-pulse lg:hidden ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`} />
            <div className={`w-48 h-6 rounded-md animate-pulse hidden sm:block ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`} />
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl animate-pulse ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`} />
            <div className={`w-10 h-10 rounded-xl animate-pulse ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`} />
          </div>
        </header>
        
        {/* Content Skeleton Area (Will be instantly replaced by actual page skeleton to feel seamless) */}
        <main className="flex-1 p-6 sm:p-8 space-y-6">
          <div className={`w-1/4 h-10 rounded-xl animate-pulse mt-4 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`h-32 rounded-3xl animate-pulse ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`} />
            ))}
          </div>
          <div className={`w-full h-64 rounded-3xl animate-pulse mt-6 ${isDark ? "bg-[#3c4043]" : "bg-gray-200"}`} />
        </main>
      </div>
    </div>
  );
}
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
  const {
    user,
    profile,
    handleSignOut,
    isDarkMode,
    toggleTheme,
    setShowSettings,
  } = props;
  const dp = { onSignOut: handleSignOut, isDarkMode, toggleTheme };
  const sp = {
    onOpenSettings: () => {
      setShowSettings(true);
    },
    onManageAccount: () => {
      setShowSettings(true);
    },
  };

  if (profile.role === "librarian")
    return <LibrarianDashboard adminId={user.id} user={user} {...dp} {...sp} />;
  if (profile.role === "cashier")
    return <CashierDashboard adminId={user.id} user={user} {...dp} {...sp} />;
  if (profile.role === "registrar")
    return <RegistrarDashboard adminId={user.id} user={user} {...dp} {...sp} />;
  if (profile.role === "signatory")
    return (
      <SignatoryDashboard
        professorId={user.id}
        professorInfo={profile}
        user={user}
        {...dp}
        {...sp}
      />
    );
  if (profile.role === "student")
    return (
      <StudentDashboardGraduation
        studentId={user.id}
        studentInfo={profile}
        user={user}
        {...dp}
        {...sp}
      />
    );
  if (profile.role === "super_admin" || profile.role === "system_admin")
    return (
      <SuperAdminDashboard
        adminId={user.id}
        adminRole={profile.role}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        {...dp}
        {...sp}
      />
    );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <p>Unknown role: {profile.role}</p>
    </div>
  );
}

function App() {
  const auth = useAuth();
  const {
    user,
    setUser,
    profile,
    initializing,
    selectedRole,
    showPasswordReset,
  } = auth;
  const { twoFactorPending, pendingUser } = auth;
  const {
    handleLoginSuccess,
    handleSignOut,
    handleRoleSelect,
    backToRoleSelection,
    complete2FA,
    cancel2FA,
    skip2FASetup,
  } = auth;
  const { isDarkMode, themePreference, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const isAuthenticated = !!user && !!profile;

  if (twoFactorPending && pendingUser) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? "bg-slate-950" : "bg-gray-50"}`}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full max-w-md p-8 rounded-3xl shadow-xl border overflow-hidden ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"}`}
        >
          {twoFactorPending === "setup" ? (
            <TwoFactorSetup
              userId={pendingUser.id}
              email={pendingUser.email}
              isDark={isDarkMode}
              onComplete={complete2FA}
              onSkip={skip2FASetup}
            />
          ) : (
            <TwoFactorVerify
              userId={pendingUser.id}
              email={pendingUser.email}
              isDark={isDarkMode}
              onVerified={complete2FA}
              onCancel={cancel2FA}
            />
          )}
        </motion.div>
      </div>
    );
  }

  if (showPasswordReset) return <PasswordResetPage />;

  return (
    <>
      <div
        className={`min-h-screen w-full font-sans transition-colors duration-500 ${isAuthenticated ? (isDarkMode ? "bg-[#030712] text-white" : "bg-[#FAFAFA] text-slate-800") : isDarkMode ? "bg-[#030712] text-slate-100" : "bg-[#FAFAFA] text-slate-800"}`}
      >
        {isAuthenticated && (
          <div className="fixed inset-0 z-0 grid-bg opacity-20 pointer-events-none"></div>
        )}
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                sessionStorage.getItem(TAB_ID) ? (
                  <Navigate to="/home" replace />
                ) : (
                  <LoaderPage />
                )
              }
            />

            <Route
              path="/home"
              element={
                isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <motion.div
                    key="landing"
                    exit={{ opacity: 0, y: -100 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className={`relative z-40 ${isDarkMode ? "bg-slate-950" : "bg-white"}`}
                  >

                    <LandingPage
                      onEnter={() => navigate("/select-role")}
                      isDark={isDarkMode}
                      toggleTheme={toggleTheme}
                    />
                  </motion.div>
                )
              }
            />

            <Route
              path="/select-role"
              element={
                isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <motion.div
                    key="roleSelection"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className={`relative z-40 ${isDarkMode ? "bg-slate-950" : "bg-white"}`}
                  >

                    <RoleSelectionPage
                      onRoleSelect={handleRoleSelect}
                      onBackToHome={() => navigate("/home")}
                      isDark={isDarkMode}
                    />
                  </motion.div>
                )
              }
            />

            <Route
              path="/auth"
              element={
                isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
                ) : initializing &&
                  Object.keys(localStorage).some(
                    (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
                  ) ? (
                  <DashboardSkeletonShell isDark={isDarkMode} />
                ) : (
                  <motion.div
                    key="auth"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="relative z-10 min-h-screen"
                  >
                    <AuthPage
                      isDark={isDarkMode}
                      selectedRole={selectedRole}
                      onLoginSuccess={handleLoginSuccess}
                      onBackToHome={backToRoleSelection}
                    />
                  </motion.div>
                )
              }
            />

            <Route
              path="/dashboard"
              element={
                !isAuthenticated ? (
                  initializing ? (
                    <DashboardSkeletonShell isDark={isDarkMode} />
                  ) : (
                    <Navigate
                      to={selectedRole ? "/auth" : "/select-role"}
                      replace
                    />
                  )
                ) : (
                  <div
                    key="dashboard"
                    className="relative z-10 min-h-screen"
                  >
                    <DashboardContent
                      user={user}
                      profile={profile}
                      handleSignOut={handleSignOut}
                      isDarkMode={isDarkMode}
                      toggleTheme={toggleTheme}
                      setShowSettings={setShowSettings}
                    />
                  </div>
                )
              }
            />

            <Route
              path="/super-admin"
              element={
                isAuthenticated && profile?.role === "super_admin" ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <SuperAdminLoginPage />
                )
              }
            />
            <Route path="/reset-password" element={<PasswordResetPage />} />
            <Route path="/verify/:code" element={<CertificateVerifyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
        {showSettings && (
          <Settings
            user={user}
            profile={profile}
            onClose={() => setShowSettings(false)}
            theme={themePreference}
            setTheme={(t) => toggleTheme(t)}
            onAvatarUpdate={async (url) => {
              try {
                const { data } = await supabase.auth.updateUser({
                  data: { avatar_url: url },
                });
                if (data?.user) setUser(data.user);
              } catch (_err) {
                // Fallback: update local state even if persist fails
                setUser((prev) => ({
                  ...prev,
                  user_metadata: { ...prev.user_metadata, avatar_url: url },
                }));
              }
            }}
          />
        )}
      </div>
    </>
  );
}

export default App;
