import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
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

  const skipNextValidationRef = useRef(false);

  const [selectedRole, setSelectedRole] = useState(() => {
    return sessionStorage.getItem("selectedRole") || null;
  });

  const setNavigate = useCallback((nav) => {
    navigateRef.current = nav;
  }, []);

  const roleMatchesSelection = (profileRole) => {
    const selected = sessionStorage.getItem("selectedRole");
    if (!selected) return true;

    const ROLE_MAP = {
      student: ["student"],
      signatory: ["signatory"],
      staff: ["librarian", "cashier", "registrar", "signatory"],
      librarian: ["librarian"],
      cashier: ["cashier"],
      registrar: ["registrar"],
      super_admin: ["super_admin"],
    };

    const allowed = ROLE_MAP[selected];
    return allowed ? allowed.includes(profileRole) : true;
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
          .select(
            "id, full_name, role, student_number, course_year, account_enabled",
          )
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
        setInitializing(false);
        await supabase.auth.signOut();
        return;
      }

      if (!roleMatchesSelection(data.role)) {
        const selected = sessionStorage.getItem("selectedRole");
        toast.error(
          `This account is not a ${selected} account. Redirecting to role selection.`,
        );
        roleMismatchRef.current = true;
        sessionStorage.removeItem("selectedRole");
        setSelectedRole(null);
        setInitializing(false);
        await supabase.auth.signOut();
        navigateRef.current?.("/select-role");
        return;
      }

      if (!isMounted) return;

      const twoFAVerified = sessionStorage.getItem("2fa_verified");
      if (data.totp_enabled && twoFAVerified !== sessionUser.id) {
        setPendingUser(sessionUser);
        setPendingProfile(data);
        setTwoFactorPending("verify");
        setInitializing(false);
        return;
      }

      const requires2FA = [
        "librarian",
        "cashier",
        "registrar",
        "signatory",
        "super_admin",
      ].includes(data.role);
      if (requires2FA && !data.totp_enabled) {
        setPendingUser(sessionUser);
        setPendingProfile(data);
        setTwoFactorPending("setup");
        setInitializing(false);
        return;
      }

      setUser(sessionUser);
      setProfile(data);

      supabase
        .from("profiles")
        .update({ last_login: new Date().toISOString() })
        .eq("id", sessionUser.id)
        .then(({ error }) => {
          if (error) {
            console.error("last_login update failed:", error);

            setTimeout(() => {
              supabase
                .from("profiles")
                .update({ last_login: new Date().toISOString() })
                .eq("id", sessionUser.id);
            }, 2000);
          }
        });
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
    const promise = validateAndSetSession(sessionUser, isMounted).finally(
      () => {
        if (sessionValidationPromiseRef.current === promise) {
          sessionValidationPromiseRef.current = null;
        }
      },
    );
    sessionValidationPromiseRef.current = promise;
    return promise;
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
          if (skipNextValidationRef.current) {
            skipNextValidationRef.current = false;
            return;
          }

          if (event === "SIGNED_IN" && !session.user.email_confirmed_at) {
            return;
          }
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
      .eq("id", pendingUser.id)
      .then(({ error }) => {
        if (error) {
          console.error("last_login update failed:", error);
          setTimeout(() => {
            supabase
              .from("profiles")
              .update({ last_login: new Date().toISOString() })
              .eq("id", pendingUser.id);
          }, 2000);
        }
      });
    navigateRef.current?.("/dashboard");
  };

  const cancel2FA = async () => {
    setTwoFactorPending(false);
    setPendingUser(null);
    setPendingProfile(null);
    sessionStorage.removeItem("2fa_verified");
    roleMismatchRef.current = true;
    await supabase.auth.signOut();
  };

  const IDLE_TIMEOUT_MS =
    parseInt(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES || "15", 10) * 60 * 1000;
  const IDLE_WARNING_MS = 2 * 60 * 1000;
  const isAuthenticated = !!user && !!profile;
  const idleSignOutRef = useRef(false);

  const handleIdleSignOut = useCallback(async () => {
    if (idleSignOutRef.current) return;
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
    toast(
      `Session expiring in ${Math.ceil(secondsLeft / 60)} min due to inactivity. Move your mouse to stay signed in.`,
      {
        icon: "⏳",
        duration: 10000,
        id: "idle-warning",
      },
    );
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
    setUser,
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
    setNavigate,
    skipNextValidationRef,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function NavigateSetter() {
  const navigate = useNavigate();
  const { setNavigate } = useAuth();
  useEffect(() => {
    setNavigate(navigate);
  }, [navigate, setNavigate]);
  return null;
}
