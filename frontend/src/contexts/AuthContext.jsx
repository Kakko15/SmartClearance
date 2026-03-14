import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import useIdleTimeout from "../hooks/useIdleTimeout";

const PRESERVED_LOCAL_STORAGE_KEYS = ["theme", "saved_login_emails"];

function clearLocalStoragePreservingPreferences() {
  const preservedEntries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      PRESERVED_LOCAL_STORAGE_KEYS.some(
        (prefix) => key === prefix || key.startsWith(prefix),
      )
    ) {
      preservedEntries.push([key, localStorage.getItem(key)]);
    }
  }
  localStorage.clear();
  preservedEntries.forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
}

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const showPasswordResetRef = useRef(false);
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [pendingProfile, setPendingProfile] = useState(null);
  const roleMismatchRef = useRef(false);
  const sessionValidationPromiseRef = useRef(null);
  const navigateRef = useRef(null);

  const [selectedRole, setSelectedRole] = useState(() => {
    return sessionStorage.getItem("selectedRole") || null;
  });

  // We use a NavigateSetter child to grab navigate without AuthProvider itself being inside Router
  const setNavigate = useCallback((nav) => {
    navigateRef.current = nav;
  }, []);

  const roleMatchesSelection = (profileRole) => {
    const role = sessionStorage.getItem("selectedRole");
    if (!role) return true;
    if (role === "student") return profileRole === "student";
    if (role === "signatory") return profileRole === "signatory";
    if (role === "staff") {
      return ["librarian", "cashier", "registrar"].includes(profileRole);
    }
    // Legacy support: "professor" selection matches "signatory"
    if (role === "professor") return profileRole === "signatory";
    // Legacy support: "admin" or specific old admin roles
    if (role === "admin") return ["librarian", "cashier", "registrar", "super_admin"].includes(profileRole);
    if (role === "library_admin") return profileRole === "librarian";
    if (role === "cashier_admin") return profileRole === "cashier";
    if (role === "registrar_admin") return profileRole === "registrar";
    // Direct match for new role names
    if (role === "librarian") return profileRole === "librarian";
    if (role === "cashier") return profileRole === "cashier";
    if (role === "registrar") return profileRole === "registrar";
    if (role === "super_admin") return profileRole === "super_admin";
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

      if (data.student_number) {
        data.student_number = data.student_number.toUpperCase();
      }

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
    showPasswordResetRef.current = showPasswordReset;
  }, [showPasswordReset]);

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
      const previousRole = sessionStorage.getItem("selectedRole");

      setUser(null);
      setProfile(null);
      setTwoFactorPending(false);
      setPendingUser(null);
      setPendingProfile(null);

      sessionStorage.clear();
      clearLocalStoragePreservingPreferences();

      if (previousRole && previousRole !== "super_admin") {
        setSelectedRole(previousRole);
        sessionStorage.setItem("selectedRole", previousRole);
      } else {
        setSelectedRole(null);
      }

      roleMismatchRef.current = true;
      await supabase.auth.signOut();

      toast.success("Signed out successfully");

      if (previousRole === "super_admin") {
        navigateRef.current?.("/super-admin");
      } else if (previousRole) {
        navigateRef.current?.("/auth");
      } else {
        navigateRef.current?.("/select-role");
      }
      sessionStorage.setItem("hasSeenLoader", "true");
    } catch (error) {
      console.error("Logout error:", error);
      sessionStorage.clear();
      clearLocalStoragePreservingPreferences();
      setSelectedRole(null);
      navigateRef.current?.("/");
      sessionStorage.setItem("hasSeenLoader", "true");
    }
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    sessionStorage.setItem("selectedRole", role);
    sessionStorage.removeItem("authMode");
    navigateRef.current?.("/auth");
  };

  const backToRoleSelection = () => {
    setSelectedRole(null);
    sessionStorage.removeItem("selectedRole");
    sessionStorage.removeItem("authMode");
    sessionStorage.removeItem("signupStep");
    sessionStorage.removeItem("signupFormData");
    navigateRef.current?.("/select-role");
  };

  const complete2FA = () => {
    sessionStorage.setItem("2fa_verified", pendingUser.id);
    setUser(pendingUser);
    setProfile(pendingProfile);
    setTwoFactorPending(false);
    setPendingUser(null);
    setPendingProfile(null);
    supabase
      .from("profiles")
      .update({ last_login: new Date().toISOString() })
      .eq("id", pendingUser.id);
  };

  const cancel2FA = async () => {
    setTwoFactorPending(false);
    setPendingUser(null);
    setPendingProfile(null);
    roleMismatchRef.current = true;
    await supabase.auth.signOut();
  };

  const completePasswordReset = () => {
    setShowPasswordReset(false);
    window.location.hash = "";
  };

  // ── Idle Timeout ────────────────────────────────────────────────────────
  // Default: 15 min timeout, 2 min warning. University shared computers need this.
  const IDLE_TIMEOUT_MS = parseInt(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES || "15", 10) * 60 * 1000;
  const IDLE_WARNING_MS = 2 * 60 * 1000;
  const isAuthenticated = !!user && !!profile;
  const idleSignOutRef = useRef(false);

  const handleIdleSignOut = useCallback(async () => {
    if (idleSignOutRef.current) return; // prevent double-fire
    idleSignOutRef.current = true;

    try {
      const previousRole = sessionStorage.getItem("selectedRole");

      setUser(null);
      setProfile(null);
      setTwoFactorPending(false);
      setPendingUser(null);
      setPendingProfile(null);

      sessionStorage.clear();
      clearLocalStoragePreservingPreferences();

      if (previousRole && previousRole !== "super_admin") {
        setSelectedRole(previousRole);
        sessionStorage.setItem("selectedRole", previousRole);
      } else {
        setSelectedRole(null);
      }

      roleMismatchRef.current = true;
      await supabase.auth.signOut();

      toast("You were signed out due to inactivity", {
        icon: "🔒",
        duration: 6000,
      });

      if (previousRole === "super_admin") {
        navigateRef.current?.("/super-admin");
      } else if (previousRole) {
        navigateRef.current?.("/auth");
      } else {
        navigateRef.current?.("/select-role");
      }
      sessionStorage.setItem("hasSeenLoader", "true");
    } catch (error) {
      console.error("Idle sign-out error:", error);
    } finally {
      idleSignOutRef.current = false;
    }
  }, []);

  const handleIdleWarning = useCallback((secondsLeft) => {
    toast(`Session expiring in ${Math.ceil(secondsLeft / 60)} min due to inactivity. Move your mouse to stay signed in.`, {
      icon: "⏳",
      duration: 10000,
      id: "idle-warning", // prevent duplicate toasts
    });
  }, []);

  const handleIdleActive = useCallback(() => {
    toast.dismiss("idle-warning");
  }, []);

  useIdleTimeout({
    enabled: isAuthenticated,
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onIdle: handleIdleSignOut,
    onWarning: handleIdleWarning,
    onActive: handleIdleActive,
  });

  const value = {
    user,
    profile,
    initializing,
    selectedRole,
    setSelectedRole,
    showPasswordReset,
    setShowPasswordReset,
    twoFactorPending,
    pendingUser,
    pendingProfile,
    handleLoginSuccess,
    handleSignOut,
    handleRoleSelect,
    backToRoleSelection,
    complete2FA,
    cancel2FA,
    completePasswordReset,
    setNavigate,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Small component placed inside Router to capture navigate function
export function NavigateSetter() {
  const navigate = useNavigate();
  const { setNavigate } = useAuth();
  useEffect(() => {
    setNavigate(navigate);
  }, [navigate, setNavigate]);
  return null;
}
