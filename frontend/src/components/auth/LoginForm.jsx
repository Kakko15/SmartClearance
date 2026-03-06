import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import SpotlightBorder from "../ui/SpotlightBorder";

function formatRetryTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

  const handleSignIn = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (retryCountdown > 0) return;

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
          <SpotlightBorder
            isDark={isDark}
            error={getFieldError("email", email)}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setLoginFeedback((existing) =>
                  existing?.rateLimit?.blocked ? existing : null,
                );
              }}
              onBlur={() => handleBlur("email")}
              required
              autoComplete="email"
              className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-medium ${isDark ? "bg-slate-900 border-slate-700 text-white caret-green-500 focus:border-green-500" : "bg-white border-gray-200 text-gray-900 caret-green-500 focus:border-green-500 focus:ring-1 focus:ring-green-500"} ${getFieldError("email", email) ? "!border-red-500 focus:!border-red-500 !ring-red-500 bg-red-50 text-red-900" : ""}`}
            />
          </SpotlightBorder>
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

        <div className="flex items-center gap-4 mt-8 mb-6">
          <div
            className={`h-px flex-1 ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
          ></div>
          <span
            className={`text-sm font-medium transition-colors shrink-0 ${isDark ? "text-slate-400" : "text-gray-500"}`}
          >
            Or continue with
          </span>
          <div
            className={`h-px flex-1 ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
          ></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-full transition-all ${isDark ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-gray-200 hover:bg-gray-50 text-gray-700"}`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span className="font-bold text-sm">Google</span>
          </button>
          <button
            type="button"
            className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-full transition-all ${isDark ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-gray-200 hover:bg-gray-50 text-gray-700"}`}
          >
            <svg
              className="w-5 h-5 text-[#5865F2]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.7725-.6083 1.1643a18.4045 18.4045 0 00-5.4872 0 12.64 12.64 0 00-.6171-1.1643.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1892.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.1023.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z" />
            </svg>
            <span className="font-bold text-sm">Discord</span>
          </button>
        </div>
      </motion.form>
    </AnimatePresence>
  );
}
