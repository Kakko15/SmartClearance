import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./lib/supabase";
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
import PasswordStrengthMeter from "./components/ui/PasswordStrengthMeter";
import TwoFactorVerify from "./components/auth/TwoFactorVerify";
import logo from "./assets/logo.png";

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const roleMismatchRef = useRef(false);
  const sessionValidationPromiseRef = useRef(null);

  const [appMode, setAppMode] = useState(() => {
    const savedMode = sessionStorage.getItem("currentAppMode");
    if (savedMode) return savedMode;
    return sessionStorage.getItem("hasSeenLoader") ? "landing" : "loader";
  });

  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const showPasswordResetRef = useRef(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resettingPw, setResettingPw] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);
  const [isNewPwFocused, setIsNewPwFocused] = useState(false);
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [pendingProfile, setPendingProfile] = useState(null);

  const [selectedRole, setSelectedRole] = useState(() => {
    return sessionStorage.getItem("selectedRole") || null;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("theme", newMode ? "dark" : "light");
      document.documentElement.classList.toggle("dark", newMode);
      return newMode;
    });
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setIsDarkMode(savedTheme === "dark");
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }
  }, []);

  useEffect(() => {
    showPasswordResetRef.current = showPasswordReset;
  }, [showPasswordReset]);

  useEffect(() => {
    if (appMode === "loader") {
      const timer = setTimeout(() => {
        setAppMode("landing");
        sessionStorage.setItem("hasSeenLoader", "true");
        sessionStorage.setItem("currentAppMode", "landing");
      }, 1200); // Realistic loading time: ~1.2 seconds
      return () => clearTimeout(timer);
    }
  }, [appMode]);

  const enterSystem = () => {
    sessionStorage.removeItem("authMode");
    setAppMode("roleSelection");
    sessionStorage.setItem("currentAppMode", "roleSelection");
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    sessionStorage.setItem("selectedRole", role);
    sessionStorage.removeItem("authMode");
    setAppMode("app");
    sessionStorage.setItem("currentAppMode", "app");
  };

  const backToRoleSelection = () => {
    setSelectedRole(null);
    sessionStorage.removeItem("selectedRole");
    sessionStorage.removeItem("authMode");
    sessionStorage.removeItem("signupStep");
    sessionStorage.removeItem("signupFormData");
    setAppMode("roleSelection");
    sessionStorage.setItem("currentAppMode", "roleSelection");
  };

  const roleMatchesSelection = (profileRole) => {
    const role = sessionStorage.getItem("selectedRole");
    if (!role) return true;
    if (role === "student") return profileRole === "student";
    if (role === "professor") return profileRole === "professor";
    if (role === "admin") return profileRole?.includes("admin");
    return true;
  };

  const validateAndSetSession = async (sessionUser, isMounted = true) => {
    if (!sessionUser || !isMounted) return;

    try {
      let { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, role, student_number, course_year, account_enabled, totp_enabled",
        )
        .eq("id", sessionUser.id)
        .single()
        .abortSignal(AbortSignal.timeout(8000));

      if (error && error.message?.includes("totp_enabled")) {
        const fallback = await supabase
          .from("profiles")
          .select("id, full_name, role, student_number, course_year, account_enabled")
          .eq("id", sessionUser.id)
          .single()
          .abortSignal(AbortSignal.timeout(8000));
        data = fallback.data ? { ...fallback.data, totp_enabled: false } : null;
        error = fallback.error;
      }

      if (error) throw error;
      if (!isMounted) return;
      if (!data) throw new Error("No profile data");

      if (data.account_enabled === false) {
        toast.error(
          "Your account is pending approval. Please contact your administrator.",
        );
        roleMismatchRef.current = true;
        await supabase.auth.signOut();
        return;
      }

      if (!roleMatchesSelection(data.role)) {
        const selected = sessionStorage.getItem("selectedRole");
        toast.error(
          `This account is not a ${selected} account. Please go back and select the correct role.`,
        );
        roleMismatchRef.current = true;
        await supabase.auth.signOut();
        return;
      }

      if (!isMounted) return;

      const twoFAVerified = sessionStorage.getItem("2fa_verified");
      if (data.totp_enabled && twoFAVerified !== sessionUser.id) {
        setPendingUser(sessionUser);
        setPendingProfile(data);
        setTwoFactorPending(true);
        setInitializing(false);
        return;
      }

      setUser(sessionUser);
      setProfile(data);
      setAppMode("app");
      sessionStorage.setItem("currentAppMode", "app");

      supabase
        .from("profiles")
        .update({ last_login: new Date().toISOString() })
        .eq("id", sessionUser.id);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Profile fetch error:", error);
        toast.error("Failed to load profile. Please try again.");
        if (isMounted) {
          roleMismatchRef.current = true;
          await supabase.auth.signOut();
        }
      }
    }
  };

  const runSessionValidation = (sessionUser, isMounted = true) => {
    if (!sessionUser || !isMounted) return Promise.resolve();
    if (sessionValidationPromiseRef.current) {
      return sessionValidationPromiseRef.current;
    }

    sessionValidationPromiseRef.current = validateAndSetSession(
      sessionUser,
      isMounted,
    ).finally(() => {
      sessionValidationPromiseRef.current = null;
    });

    return sessionValidationPromiseRef.current;
  };

  const handleLoginSuccess = (sessionUser) => {
    if (!sessionUser) return;

    return runSessionValidation(sessionUser);
  };

  useEffect(() => {
    let isMounted = true;

    const scheduleSessionValidation = (sessionUser) => {
      window.setTimeout(() => {
        if (!isMounted) return;
        void runSessionValidation(sessionUser, isMounted);
      }, 0);
    };

    const init = async () => {
      try {
        const hash = window.location.hash;
        const isRecovery = hash.includes("type=recovery");

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error && error.name !== "AbortError")
          console.error("Error getting session:", error);

        if (isMounted && isRecovery && session?.user) {
          setShowPasswordReset(true);
          return;
        }

        if (isMounted && session?.user) {
          await runSessionValidation(session.user, isMounted);
        }
      } catch (error) {
        if (error.name !== "AbortError") console.error(error);
      } finally {
        if (isMounted) setInitializing(false);
      }
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        if (event === "PASSWORD_RECOVERY" && session?.user) {
          setShowPasswordReset(true);
          setInitializing(false);
          return;
        }

        if (showPasswordResetRef.current) return;

        if (
          (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
          session?.user
        ) {
          scheduleSessionValidation(session.user);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);

          if (roleMismatchRef.current) {
            roleMismatchRef.current = false;
            return;
          }

          setSelectedRole(null);
          const hasSeenLoader = sessionStorage.getItem("hasSeenLoader");
          sessionStorage.clear();
          if (hasSeenLoader) {
            sessionStorage.setItem("hasSeenLoader", "true");
          }

          setAppMode("roleSelection");
          sessionStorage.setItem("currentAppMode", "roleSelection");
        }
      },
    );

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      setUser(null);
      setProfile(null);
      setSelectedRole(null);
      setTwoFactorPending(false);
      setPendingUser(null);
      setPendingProfile(null);

      sessionStorage.clear();
      localStorage.clear();

      await supabase.auth.signOut();

      toast.success("Signed out successfully");

      setAppMode("roleSelection");
      sessionStorage.setItem("currentAppMode", "roleSelection");
      sessionStorage.setItem("hasSeenLoader", "true");
    } catch (error) {
      console.error("Logout error:", error);

      sessionStorage.clear();
      localStorage.clear();
      setAppMode("landing");
      sessionStorage.setItem("currentAppMode", "landing");
      sessionStorage.setItem("hasSeenLoader", "true");
    }
  };

  if (initializing && appMode === "app") {
    return <Loader />;
  }

  if (twoFactorPending && pendingUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? "bg-slate-950" : "bg-gray-50"}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full max-w-md p-8 rounded-3xl shadow-xl border ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"}`}
        >
          <TwoFactorVerify
            userId={pendingUser.id}
            email={pendingUser.email}
            isDark={isDarkMode}
            onVerified={() => {
              sessionStorage.setItem("2fa_verified", pendingUser.id);
              setUser(pendingUser);
              setProfile(pendingProfile);
              setTwoFactorPending(false);
              setPendingUser(null);
              setPendingProfile(null);
              setAppMode("app");
              sessionStorage.setItem("currentAppMode", "app");
              supabase
                .from("profiles")
                .update({ last_login: new Date().toISOString() })
                .eq("id", pendingUser.id);
            }}
            onCancel={async () => {
              setTwoFactorPending(false);
              setPendingUser(null);
              setPendingProfile(null);
              roleMismatchRef.current = true;
              await supabase.auth.signOut();
            }}
          />
        </motion.div>
      </div>
    );
  }

  if (showPasswordReset) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? "bg-slate-950" : "bg-gray-50"}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full max-w-md p-8 rounded-3xl shadow-xl border ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"}`}
        >
          <div className="text-center mb-6">
            <img src={logo} alt="Logo" className="w-14 h-14 mx-auto mb-3" />
            <h2 className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              Set New Password
            </h2>
            <p className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              Enter your new password below
            </p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const hasUpper = /[A-Z]/.test(newPassword);
              const hasLower = /[a-z]/.test(newPassword);
              const hasNumber = /[0-9]/.test(newPassword);
              const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
              if (newPassword.length < 8 || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
                toast.error("Password must meet all strength requirements");
                return;
              }
              if (newPassword !== confirmNewPassword) {
                toast.error("Passwords do not match");
                return;
              }
              setResettingPw(true);
              try {
                const updatePromise = supabase.auth.updateUser({ password: newPassword });
                const timeoutPromise = new Promise((_, reject) =>
                  setTimeout(() => reject(new Error("Request timed out. Please try again.")), 15000)
                );
                const { error } = await Promise.race([updatePromise, timeoutPromise]);
                if (error) throw error;
                toast.success("Password updated successfully! Please sign in.");
                setShowPasswordReset(false);
                setNewPassword("");
                setConfirmNewPassword("");
                setShowResetPw(false);
                setIsNewPwFocused(false);
                window.location.hash = "";
                await supabase.auth.signOut();
                setAppMode("landing");
                sessionStorage.setItem("currentAppMode", "landing");
                sessionStorage.setItem("hasSeenLoader", "true");
              } catch (err) {
                toast.error(err.message || "Failed to update password");
              } finally {
                setResettingPw(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>
                New Password
              </label>
              <div className="relative">
                <input
                  type={showResetPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onFocus={() => setIsNewPwFocused(true)}
                  onBlur={() => setIsNewPwFocused(false)}
                  required
                  minLength={8}
                  className={`w-full border rounded-xl px-4 py-3 pr-20 outline-none transition-all font-medium ${isDarkMode ? "bg-slate-800 border-slate-600 text-white focus:border-green-500" : "bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"}`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowResetPw(!showResetPw)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors z-10 ${isDarkMode ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600"}`}
                >
                  {showResetPw ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
                <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                  <AnimatePresence mode="popLayout">
                    {newPassword && confirmNewPassword && newPassword === confirmNewPassword ? (
                      <motion.div key="match" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0, transition: { duration: 0.1 } }} transition={{ type: "spring", stiffness: 500, damping: 25 }} className="text-green-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </motion.div>
                    ) : newPassword && confirmNewPassword && newPassword !== confirmNewPassword ? (
                      <motion.div key="mismatch" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0, transition: { duration: 0.1 } }} transition={{ type: "spring", stiffness: 500, damping: 25 }} className="text-red-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
              <PasswordStrengthMeter
                password={newPassword}
                isVisible={isNewPwFocused}
                isDark={isDarkMode}
              />
            </div>
            <div>
              <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showResetPw ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className={`w-full border rounded-xl px-4 py-3 pr-20 outline-none transition-all font-medium ${isDarkMode ? "bg-slate-800 border-slate-600 text-white focus:border-green-500" : "bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"}`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowResetPw(!showResetPw)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors z-10 ${isDarkMode ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600"}`}
                >
                  {showResetPw ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
                <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                  <AnimatePresence mode="popLayout">
                    {newPassword && confirmNewPassword && newPassword === confirmNewPassword ? (
                      <motion.div key="match" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0, transition: { duration: 0.1 } }} transition={{ type: "spring", stiffness: 500, damping: 25 }} className="text-green-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </motion.div>
                    ) : newPassword && confirmNewPassword && newPassword !== confirmNewPassword ? (
                      <motion.div key="mismatch" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0, transition: { duration: 0.1 } }} transition={{ type: "spring", stiffness: 500, damping: 25 }} className="text-red-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={resettingPw}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-full shadow-lg transition-all disabled:opacity-50"
            >
              {resettingPw ? "Updating..." : "Update Password"}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <ClickSpark
      sparkColor={isDarkMode ? "#22c55e" : "#10b981"}
      sparkSize={13}
      sparkRadius={15}
      sparkCount={10}
      duration={400}
    >
      <div
        className={`min-h-screen w-full font-sans transition-colors duration-500 ${appMode === "app" && user ? "bg-[#021205] text-white" : isDarkMode ? "bg-slate-950 text-slate-100" : "bg-[#f8fafc] text-slate-800"}`}
      >
        {appMode === "app" && user && (
          <div className="fixed inset-0 z-0 grid-bg opacity-20 pointer-events-none"></div>
        )}

        <AnimatePresence mode="wait">
          {appMode === "loader" && (
            <motion.div
              key="loader"
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50"
            >
              <Loader />
            </motion.div>
          )}

          {appMode === "landing" && (
            <motion.div
              key="landing"
              exit={{ opacity: 0, y: -100 }}
              className={`relative z-40 ${isDarkMode ? "bg-slate-950" : "bg-white"}`}
            >
              <LandingPage
                onEnter={enterSystem}
                isDark={isDarkMode}
                toggleTheme={toggleTheme}
              />
            </motion.div>
          )}

          {appMode === "roleSelection" && (
            <motion.div
              key="roleSelection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`relative z-40 ${isDarkMode ? "bg-slate-950" : "bg-white"}`}
            >
              <RoleSelectionPage
                onRoleSelect={handleRoleSelect}
                onBackToHome={() => {
                  setAppMode("landing");
                  sessionStorage.setItem("currentAppMode", "landing");
                }}
                isDark={isDarkMode}
              />
            </motion.div>
          )}

          {appMode === "app" && (
            <motion.div
              key="app"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
              className="relative z-10 min-h-screen"
            >
              {!user || !profile ? (
                <AuthPage
                  isDark={isDarkMode}
                  selectedRole={selectedRole}
                  onLoginSuccess={handleLoginSuccess}
                  onBackToHome={backToRoleSelection}
                />
              ) : (
                <div className="min-h-screen relative">
                  {profile.role === "library_admin" ? (
                    <LibraryAdminDashboard
                      adminId={user.id}
                      onSignOut={handleSignOut}
                      onOpenSettings={() => setShowSettings(true)}
                      isDarkMode={isDarkMode}
                    />
                  ) : profile.role === "cashier_admin" ? (
                    <CashierAdminDashboard
                      adminId={user.id}
                      onSignOut={handleSignOut}
                      onOpenSettings={() => setShowSettings(true)}
                      isDarkMode={isDarkMode}
                    />
                  ) : profile.role === "registrar_admin" ? (
                    <RegistrarAdminDashboard
                      adminId={user.id}
                      onSignOut={handleSignOut}
                      onOpenSettings={() => setShowSettings(true)}
                      isDarkMode={isDarkMode}
                    />
                  ) : profile.role === "professor" ? (
                    <ProfessorDashboard
                      professorId={user.id}
                      professorInfo={profile}
                      onSignOut={handleSignOut}
                      onOpenSettings={() => setShowSettings(true)}
                      isDarkMode={isDarkMode}
                    />
                  ) : (
                    <>
                      {profile.role === "student" ? (
                        <StudentDashboardGraduation
                          studentId={user.id}
                          studentInfo={profile}
                          onSignOut={handleSignOut}
                          onOpenSettings={() => setShowSettings(true)}
                          isDarkMode={isDarkMode}
                        />
                      ) : (
                        <>
                          <div className="absolute inset-0 z-0 opacity-50 pointer-events-none">
                            <PixelTrail
                              gridSize={60}
                              trailSize={0.2}
                              maxAge={300}
                              interpolate={8}
                              color="#22c55e"
                              glProps={{
                                antialias: false,
                                powerPreference: "high-performance",
                                alpha: true,
                              }}
                            />
                          </div>
                          <header className="glass-panel sticky top-0 z-50 border-b border-white/10">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                              <div className="flex justify-between items-center h-20">
                                <div className="flex items-center gap-4">
                                  <img
                                    src={logo}
                                    alt="Smart Clearance System Logo"
                                    className="w-12 h-12 object-contain"
                                  />
                                  <div>
                                    <h1 className="font-display text-xl font-bold text-white tracking-wider">
                                      SMART
                                      <span className="text-primary-400">
                                        CLEARANCE
                                      </span>
                                    </h1>
                                    <div className="flex items-center gap-2">
                                      <span className="h-1.5 w-1.5 rounded-full bg-secondary-500 animate-pulse"></span>
                                      <p className="text-[10px] text-primary-400/80 tracking-widest uppercase">
                                        System Online
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-6">
                                  <button
                                    onClick={() => setShowSettings(true)}
                                    className="text-gray-400 hover:text-primary-400 transition-colors"
                                  >
                                    <svg
                                      className="w-6 h-6"
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
                                  </button>

                                  <div className="text-right hidden sm:block border-l border-white/10 pl-6">
                                    <p className="text-sm font-bold text-white tracking-wide">
                                      {profile.full_name}
                                    </p>
                                    <p className="text-[10px] text-primary-400 uppercase tracking-widest">
                                      {profile.role.replace("_", " ")}
                                    </p>
                                  </div>

                                  <button
                                    onClick={handleSignOut}
                                    className="rounded-none border border-red-500/50 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                  >
                                    LOGOUT
                                  </button>
                                </div>
                              </div>
                            </div>
                          </header>

                          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
                            <div className="mb-8 glass-card rounded-xl p-6 border-l-4 border-l-secondary-500">
                              <EnvironmentalImpact studentId={null} />
                            </div>
                            <AdminDashboard
                              adminId={user.id}
                              adminInfo={profile}
                              onSignOut={handleSignOut}
                              onOpenSettings={() => setShowSettings(true)}
                              isDarkMode={isDarkMode}
                            />
                          </main>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {showSettings && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="glass-card p-1">
              <Settings
                user={user}
                profile={profile}
                onClose={() => setShowSettings(false)}
                theme={isDarkMode ? "dark" : "light"}
                setTheme={(newTheme) => {
                  setIsDarkMode(newTheme === "dark");
                  localStorage.setItem("theme", newTheme);
                  document.documentElement.classList.toggle(
                    "dark",
                    newTheme === "dark",
                  );
                }}
              />
            </div>
          </div>
        )}
      </div>
    </ClickSpark>
  );
}

export default App;
