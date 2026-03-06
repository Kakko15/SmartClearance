import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import SpotlightBorder from "../ui/SpotlightBorder";

const SAVED_LOGIN_EMAILS_KEY = "saved_login_emails";
const MAX_SAVED_LOGIN_EMAILS = 5;

function formatRetryTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getSavedLoginEmails() {
  try {
    const storedEmails = JSON.parse(
      localStorage.getItem(SAVED_LOGIN_EMAILS_KEY) || "[]",
    );

    if (!Array.isArray(storedEmails)) return [];

    return storedEmails
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => value.trim().toLowerCase())
      .slice(0, MAX_SAVED_LOGIN_EMAILS);
  } catch {
    return [];
  }
}

function persistSavedLoginEmails(emails) {
  localStorage.setItem(
    SAVED_LOGIN_EMAILS_KEY,
    JSON.stringify(emails.slice(0, MAX_SAVED_LOGIN_EMAILS)),
  );
}

export default function LoginForm({ isDark, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [touched, setTouched] = useState({});
  const [loginFeedback, setLoginFeedback] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [savedEmails, setSavedEmails] = useState(() => getSavedLoginEmails());
  const [showSavedEmails, setShowSavedEmails] = useState(false);
  const [activeSavedEmailIndex, setActiveSavedEmailIndex] = useState(-1);
  const emailFieldRef = useRef(null);
  const passwordInputRef = useRef(null);
  const normalizedEmailQuery = email.trim().toLowerCase();
  const filteredSavedEmails = savedEmails.filter(
    (savedEmail) =>
      !normalizedEmailQuery || savedEmail.includes(normalizedEmailQuery),
  );
  const shouldShowSavedEmails =
    showSavedEmails && filteredSavedEmails.length > 0;

  useEffect(() => {
    const blocked = loginFeedback?.rateLimit?.blocked;
    const resetInSeconds = loginFeedback?.rateLimit?.resetInSeconds;

    if (!blocked || !resetInSeconds || resetInSeconds <= 0) {
      setRetryCountdown(0);
      return undefined;
    }

    setRetryCountdown(resetInSeconds);

    const timer = window.setInterval(() => {
      setRetryCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setLoginFeedback((existing) =>
            existing?.rateLimit?.blocked ? null : existing,
          );
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loginFeedback?.rateLimit?.blocked, loginFeedback?.rateLimit?.resetInSeconds]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!emailFieldRef.current?.contains(event.target)) {
        setShowSavedEmails(false);
        setActiveSavedEmailIndex(-1);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (shouldShowSavedEmails && filteredSavedEmails.length === 0) {
      setShowSavedEmails(false);
      setActiveSavedEmailIndex(-1);
      return;
    }

    if (activeSavedEmailIndex >= filteredSavedEmails.length) {
      setActiveSavedEmailIndex(filteredSavedEmails.length - 1);
    }
  }, [
    activeSavedEmailIndex,
    filteredSavedEmails.length,
    shouldShowSavedEmails,
  ]);

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const getFieldError = (field, value) => {
    if (!touched[field]) return null;
    if (!value || value.trim() === "") {
      if (field === "email") return "Email is required.";
      if (field === "password") return "Password is required.";
    }
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "Please enter a valid email address.";
    }
    return null;
  };

  const saveEmailForSuggestions = (nextEmail) => {
    const normalizedEmail = nextEmail.trim().toLowerCase();
    if (!normalizedEmail) return;

    setSavedEmails((currentEmails) => {
      const nextEmails = [
        normalizedEmail,
        ...currentEmails.filter((savedEmail) => savedEmail !== normalizedEmail),
      ].slice(0, MAX_SAVED_LOGIN_EMAILS);

      persistSavedLoginEmails(nextEmails);
      return nextEmails;
    });
  };

  const handleSelectSavedEmail = (savedEmail) => {
    setEmail(savedEmail);
    setShowSavedEmails(false);
    setActiveSavedEmailIndex(-1);
    setLoginFeedback((existing) =>
      existing?.rateLimit?.blocked ? existing : null,
    );
    window.requestAnimationFrame(() => passwordInputRef.current?.focus());
  };

  const handleDeleteSavedEmail = (savedEmailToDelete) => {
    setSavedEmails((currentEmails) => {
      const nextEmails = currentEmails.filter(
        (savedEmail) => savedEmail !== savedEmailToDelete,
      );
      persistSavedLoginEmails(nextEmails);
      return nextEmails;
    });
    setActiveSavedEmailIndex(-1);
  };

  const handleEmailChange = (nextValue) => {
    setEmail(nextValue);
    setShowSavedEmails(true);
    setActiveSavedEmailIndex(-1);
    setLoginFeedback((existing) =>
      existing?.rateLimit?.blocked ? existing : null,
    );
  };

  const handleEmailKeyDown = (e) => {
    if (!shouldShowSavedEmails) {
      if (e.key === "Escape") {
        setShowSavedEmails(false);
        setActiveSavedEmailIndex(-1);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSavedEmailIndex((currentIndex) =>
        currentIndex < filteredSavedEmails.length - 1 ? currentIndex + 1 : 0,
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSavedEmailIndex((currentIndex) =>
        currentIndex > 0 ? currentIndex - 1 : filteredSavedEmails.length - 1,
      );
      return;
    }

    if (e.key === "Enter" && activeSavedEmailIndex >= 0) {
      const selectedEmail = filteredSavedEmails[activeSavedEmailIndex];
      if (selectedEmail) {
        e.preventDefault();
        handleSelectSavedEmail(selectedEmail);
      }
      return;
    }

    if (e.key === "Escape") {
      setShowSavedEmails(false);
      setActiveSavedEmailIndex(-1);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (retryCountdown > 0) return;

    setShowSavedEmails(false);
    setActiveSavedEmailIndex(-1);
    setLoginFeedback(null);
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const data = await res.json();

      if (!data.success) {
        const rateLimit = data.rateLimit || null;

        if (res.status === 429) {
          setLoginFeedback({
            tone: "blocked",
            message:
              data.error ||
              "Too many login attempts. Please try again later.",
            detail:
              rateLimit?.resetInSeconds > 0
                ? `Try again in ${formatRetryTime(rateLimit.resetInSeconds)}.`
                : "Please wait before trying again.",
            rateLimit: { ...(rateLimit || {}), blocked: true },
          });
          return;
        }

        if (res.status === 401) {
          const remaining = rateLimit?.remaining;
          const remainingDetail =
            rateLimit?.scope === "ip"
              ? `${remaining} network-wide attempt${remaining === 1 ? "" : "s"} remaining before a temporary lockout.`
              : `${remaining} attempt${remaining === 1 ? "" : "s"} remaining before a temporary lockout.`;
          setLoginFeedback({
            tone: "warning",
            message: data.error || "Invalid login credentials",
            detail:
              typeof remaining === "number"
                ? remainingDetail
                : "Check your email and password, then try again.",
            rateLimit,
          });
          return;
        }

        setLoginFeedback({
          tone: "error",
          message: data.error || "Login failed",
          detail: null,
          rateLimit,
        });
        return;
      }

      const { data: sessionData, error } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (error) throw error;

      saveEmailForSuggestions(normalizedEmail);
      const sessionUser = sessionData?.session?.user || sessionData?.user;
      if (sessionUser) {
        await onLoginSuccess?.(sessionUser);
      }
    } catch (error) {
      setLoginFeedback({
        tone: "error",
        message: error.message || "An error occurred during login",
        detail: "Please check your connection and try again.",
        rateLimit: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const normalizedResetEmail = resetEmail.trim().toLowerCase();

    if (!normalizedResetEmail) {
      toast.error("Please enter your email address");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedResetEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setResettingPassword(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedResetEmail }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setResetSent(true);
      } else {
        toast.error(data.error || "Failed to send reset link");
      }
    } catch (_err) {
      toast.error("Failed to send reset link. Please try again.");
    } finally {
      setResettingPassword(false);
    }
  };

  if (view === "forgot") {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="forgot"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {resetSent ? (
            <div className="text-center space-y-4">
              <div
                className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${isDark ? "bg-green-500/20" : "bg-green-100"}`}
              >
                <svg
                  className={`w-8 h-8 ${isDark ? "text-green-400" : "text-green-600"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3
                className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
              >
                Check your email
              </h3>
              <p
                className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                We sent a password reset link to
              </p>
              <p
                className={`font-bold text-sm ${isDark ? "text-green-400" : "text-green-600"}`}
              >
                {resetEmail.trim().toLowerCase()}
              </p>
              <p
                className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}
              >
                Didn&apos;t receive the email? Check your spam folder or try
                again.
              </p>
              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetSent(false);
                  }}
                  className={`w-full py-3 rounded-full font-bold transition-all ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
                >
                  Try another email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView("login");
                    setResetEmail("");
                    setResetSent(false);
                  }}
                  className={`text-sm font-semibold transition-colors ${isDark ? "text-green-400 hover:text-green-300" : "text-green-600 hover:text-green-700"}`}
                >
                  ← Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="text-center mb-2">
                <div
                  className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 ${isDark ? "bg-blue-500/20" : "bg-blue-100"}`}
                >
                  <svg
                    className={`w-8 h-8 ${isDark ? "text-blue-400" : "text-blue-600"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>
                <h3
                  className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  Find your account
                </h3>
                <p
                  className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}
                >
                  Enter the email linked to your account and we&apos;ll send you
                  a password reset link.
                </p>
              </div>

              <div>
                <label
                  className={`block text-sm font-bold mb-1.5 ml-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  Email Address
                </label>
                <SpotlightBorder isDark={isDark}>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    autoFocus
                    className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-medium ${isDark ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 caret-green-500 focus:border-green-500" : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 caret-green-500 focus:border-green-500 focus:ring-1 focus:ring-green-500"}`}
                  />
                </SpotlightBorder>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={resettingPassword}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-full shadow-lg shadow-green-500/20 transition-all text-sm uppercase tracking-wider disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {resettingPassword ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </motion.button>

              <button
                type="button"
                onClick={() => {
                  setView("login");
                  setResetEmail("");
                }}
                className={`w-full text-sm font-semibold transition-colors ${isDark ? "text-green-400 hover:text-green-300" : "text-green-600 hover:text-green-700"}`}
              >
                ← Back to Sign In
              </button>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.form
        key="login"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.2 }}
        onSubmit={handleSignIn}
        className="space-y-6"
      >
        <div>
          <label
            className={`block text-sm font-bold mb-1.5 ml-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
          >
            Email <span className="text-red-500">*</span>
          </label>
          <div ref={emailFieldRef} className="relative">
            <SpotlightBorder
              isDark={isDark}
              error={getFieldError("email", email)}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onFocus={() => {
                  if (savedEmails.length > 0) {
                    setShowSavedEmails(true);
                  }
                }}
                onKeyDown={handleEmailKeyDown}
                onBlur={() => handleBlur("email")}
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-autocomplete="list"
                aria-expanded={shouldShowSavedEmails}
                aria-controls="saved-login-email-list"
                aria-activedescendant={
                  activeSavedEmailIndex >= 0
                    ? `saved-login-email-${activeSavedEmailIndex}`
                    : undefined
                }
                className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-medium ${isDark ? "bg-slate-900 border-slate-700 text-white caret-green-500 focus:border-green-500" : "bg-white border-gray-200 text-gray-900 caret-green-500 focus:border-green-500 focus:ring-1 focus:ring-green-500"} ${getFieldError("email", email) ? "!border-red-500 focus:!border-red-500 !ring-red-500 bg-red-50 text-red-900" : ""}`}
              />
            </SpotlightBorder>
            <AnimatePresence>
              {shouldShowSavedEmails && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  id="saved-login-email-list"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-slate-700 bg-slate-950/95 shadow-[0_18px_50px_rgba(15,23,42,0.45)] backdrop-blur-xl"
                >
                  {filteredSavedEmails.map((savedEmail, index) => (
                    <div
                      key={savedEmail}
                      onMouseEnter={() => setActiveSavedEmailIndex(index)}
                      className={`group flex items-center transition-colors ${
                        activeSavedEmailIndex === index
                          ? "bg-white/10"
                          : "hover:bg-white/5"
                      } ${
                        index < filteredSavedEmails.length - 1
                          ? "border-b border-white/5"
                          : ""
                      }`}
                    >
                      <button
                        id={`saved-login-email-${index}`}
                        type="button"
                        role="option"
                        aria-selected={activeSavedEmailIndex === index}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleSelectSavedEmail(savedEmail);
                        }}
                        className={`min-w-0 flex-1 px-5 py-4 text-left text-base font-semibold transition-colors ${
                          activeSavedEmailIndex === index
                            ? "text-white"
                            : "text-slate-100 group-hover:text-white"
                        }`}
                      >
                        <span className="block truncate pr-3">{savedEmail}</span>
                      </button>
                      <div className="group relative mr-3 flex-shrink-0">
                        <button
                          type="button"
                          aria-label={`Delete saved email ${savedEmail}`}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleDeleteSavedEmail(savedEmail);
                          }}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                            activeSavedEmailIndex === index
                              ? "text-slate-200 hover:bg-white/10 hover:text-white"
                              : "text-slate-400 group-hover:text-slate-200 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 6l12 12M18 6L6 18"
                            />
                          </svg>
                        </button>
                        <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                          Delete entry
                        </span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {getFieldError("email", email) && (
              <motion.p
                initial={{ opacity: 0, y: -5, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -5, height: 0 }}
                transition={{ duration: 0.2 }}
                className="text-red-500 text-xs mt-1 ml-1 font-bold"
              >
                {getFieldError("email", email)}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5 ml-1">
            <label
              className={`block text-sm font-bold ${isDark ? "text-slate-300" : "text-gray-700"}`}
            >
              Password <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setView("forgot")}
              className={`text-sm font-semibold transition-colors ${isDark ? "text-green-400 hover:text-green-300" : "text-green-600 hover:text-green-700"}`}
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <SpotlightBorder
              isDark={isDark}
              error={getFieldError("password", password)}
            >
              <input
                type={showPassword ? "text" : "password"}
                ref={passwordInputRef}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginFeedback((existing) =>
                    existing?.rateLimit?.blocked ? existing : null,
                  );
                }}
                onBlur={() => handleBlur("password")}
                required
                autoComplete="current-password"
                className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-medium ${isDark ? "bg-slate-900 border-slate-700 text-white caret-green-500 focus:border-green-500" : "bg-white border-gray-200 text-gray-900 caret-green-500 focus:border-green-500 focus:ring-1 focus:ring-green-500"} ${getFieldError("password", password) ? "!border-red-500 focus:!border-red-500 !ring-red-500 bg-red-50 text-red-900" : ""}`}
              />
            </SpotlightBorder>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${isDark ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600"}`}
            >
              {showPassword ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
          <AnimatePresence>
            {getFieldError("password", password) && (
              <motion.p
                initial={{ opacity: 0, y: -5, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -5, height: 0 }}
                transition={{ duration: 0.2 }}
                className="text-red-500 text-xs mt-1 ml-1 font-bold"
              >
                {getFieldError("password", password)}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {loginFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.2 }}
              aria-live="polite"
              className={`rounded-xl border px-4 py-3 text-sm ${
                loginFeedback.tone === "blocked"
                  ? isDark
                    ? "border-red-500/40 bg-red-500/10 text-red-200"
                    : "border-red-200 bg-red-50 text-red-700"
                  : loginFeedback.tone === "warning"
                    ? isDark
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                    : isDark
                      ? "border-slate-600 bg-slate-800/70 text-slate-200"
                      : "border-gray-200 bg-gray-50 text-gray-700"
              }`}
            >
              <p className="font-semibold">{loginFeedback.message}</p>
              {loginFeedback.tone === "blocked" && retryCountdown > 0 ? (
                <p className="mt-1 text-xs font-medium">
                  Login is temporarily locked for {formatRetryTime(retryCountdown)}.
                </p>
              ) : loginFeedback.detail ? (
                <p className="mt-1 text-xs font-medium">{loginFeedback.detail}</p>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={loading || retryCountdown > 0}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-full shadow-lg shadow-green-500/20 transition-all text-sm uppercase tracking-wider disabled:opacity-70 disabled:grayscale flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Signing in...</span>
            </>
          ) : retryCountdown > 0 ? (
            `Try again in ${formatRetryTime(retryCountdown)}`
          ) : (
            "Sign In"
          )}
        </motion.button>
      </motion.form>
    </AnimatePresence>
  );
}
