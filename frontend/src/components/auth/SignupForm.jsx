import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import ReCAPTCHA from "react-google-recaptcha";
import PasswordStrengthMeter from "../ui/PasswordStrengthMeter";
import CustomSelect from "../ui/CustomSelect";
import SpotlightBorder from "../ui/SpotlightBorder";
import TwoFactorSetup from "./TwoFactorSetup";
import EmailVerification from "./EmailVerification";

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const IS_LOCALHOST =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const PENDING_SIGNUP_VERIFICATION_KEY = "pending_signup_email_verification";
const PENDING_SIGNUP_TWO_FACTOR_KEY = "pending_signup_two_factor_setup";
const PENDING_VERIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getPendingSignupVerification(expectedScopeRole) {
  try {
    const raw = sessionStorage.getItem(PENDING_SIGNUP_VERIFICATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      parsed.type !== "email_verification_pending" ||
      !parsed.userId ||
      !parsed.email
    ) {
      return null;
    }

    if (
      parsed.createdAt &&
      Number.isFinite(parsed.createdAt) &&
      Date.now() - parsed.createdAt > PENDING_VERIFICATION_MAX_AGE_MS
    ) {
      sessionStorage.removeItem(PENDING_SIGNUP_VERIFICATION_KEY);
      return null;
    }

    if (expectedScopeRole && parsed.scopeRole !== expectedScopeRole) {
      return null;
    }

    return {
      userId: parsed.userId,
      email: parsed.email,
      signupToken: parsed.signupToken || null,
    };
  } catch (_e) {
    return null;
  }
}

function persistPendingSignupVerification(data) {
  sessionStorage.setItem(
    PENDING_SIGNUP_VERIFICATION_KEY,
    JSON.stringify({
      type: "email_verification_pending",
      flow: "admin",
      scopeRole: data.scopeRole,
      userId: data.userId,
      email: data.email,
      signupToken: data.signupToken || null,
      createdAt: Date.now(),
    }),
  );
}

function clearPendingSignupVerification() {
  sessionStorage.removeItem(PENDING_SIGNUP_VERIFICATION_KEY);
}

function getPendingTwoFactorSetup(expectedScopeRole) {
  try {
    const raw = sessionStorage.getItem(PENDING_SIGNUP_TWO_FACTOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      parsed.type !== "two_factor_setup_pending" ||
      !parsed.userId ||
      !parsed.email
    ) {
      return null;
    }

    if (
      parsed.createdAt &&
      Number.isFinite(parsed.createdAt) &&
      Date.now() - parsed.createdAt > PENDING_VERIFICATION_MAX_AGE_MS
    ) {
      sessionStorage.removeItem(PENDING_SIGNUP_TWO_FACTOR_KEY);
      return null;
    }

    if (expectedScopeRole && parsed.scopeRole !== expectedScopeRole) {
      return null;
    }

    return {
      userId: parsed.userId,
      email: parsed.email,
      signupToken: parsed.signupToken || null,
    };
  } catch (_e) {
    return null;
  }
}

function persistPendingTwoFactorSetup(data) {
  sessionStorage.setItem(
    PENDING_SIGNUP_TWO_FACTOR_KEY,
    JSON.stringify({
      type: "two_factor_setup_pending",
      flow: "admin",
      scopeRole: data.scopeRole,
      userId: data.userId,
      email: data.email,
      signupToken: data.signupToken || null,
      createdAt: Date.now(),
    }),
  );
}

function clearPendingTwoFactorSetup() {
  sessionStorage.removeItem(PENDING_SIGNUP_TWO_FACTOR_KEY);
}

export default function SignupForm({
  onSwitchMode,
  isDark,
  selectedRole,
  onLoginSuccess,
}) {
  const roleScope = selectedRole || "staff";
  const [restoredVerification] = useState(() =>
    getPendingSignupVerification(roleScope),
  );
  const [restoredTwoFactor] = useState(() =>
    getPendingTwoFactorSetup(roleScope),
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [recaptchaExpired, setRecaptchaExpired] = useState(false);
  const [adminSecretCode, setAdminSecretCode] = useState("");
  const [show2FASetup, setShow2FASetup] = useState(
    () => !!restoredTwoFactor?.userId && !!restoredTwoFactor?.email,
  );
  const [showEmailVerification, setShowEmailVerification] = useState(
    () =>
      !restoredTwoFactor?.userId &&
      !!restoredVerification?.userId &&
      !!restoredVerification?.email,
  );
  const [signupUserId, setSignupUserId] = useState(
    () => restoredTwoFactor?.userId || restoredVerification?.userId || null,
  );
  const [signupEmail, setSignupEmail] = useState(
    () => restoredTwoFactor?.email || restoredVerification?.email || "",
  );
  const [signupToken, setSignupToken] = useState(
    () =>
      restoredTwoFactor?.signupToken ||
      restoredVerification?.signupToken ||
      null,
  );

  const [signUpData, setSignUpData] = useState({
    firstName: "",
    lastName: "",
    role:
      selectedRole === "student"
        ? "student"
        : selectedRole === "signatory"
          ? "signatory"
          : "signatory",
  });

  const recaptchaRef = useRef(null);

  const [touched, setTouched] = useState({});
  const [emailError, setEmailError] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "password") setIsPasswordFocused(false);
  };

  const validateAndCheckEmail = async (emailVal) => {
    handleBlur("email");
    const trimmed = emailVal.trim().toLowerCase();
    if (!trimmed) {
      setEmailError("Email is required.");
      return true;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return true;
    }
    setCheckingEmail(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/check-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        },
      );
      const data = await res.json();
      if (data.success && data.message) {
        setEmailError(data.message);
        return true;
      } else {
        setEmailError("");
        return false;
      }
    } catch (err) {
      console.error("Email check failed:", err);
      setEmailError("");
      return false; // allow submit on network error — backend will catch duplicates
    } finally {
      setCheckingEmail(false);
    }
  };

  const getFieldError = (field, value, confirmValue) => {
    if (!touched[field]) return null;

    if (!value || value.trim() === "") {
      const labels = {
        firstName: "First name is required.",
        lastName: "Last name is required.",
        email: "Email is required.",
        password: "Password is required.",
        confirmPassword: "Please confirm your password.",
        adminSecretCode: "Admin secret code is required.",
      };
      return labels[field];
    }

    if (field === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return "Please enter a valid email address.";
      }
    }

    if (field === "password") {
      const strongPasswordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
      if (!strongPasswordRegex.test(value)) {
        return "Password must meet all requirements.";
      }
    }

    if (field === "confirmPassword" && value !== confirmValue) {
      return "Passwords do not match.";
    }

    if (
      field === "adminSecretCode" &&
      (selectedRole === "staff" ||
        selectedRole === "librarian" ||
        selectedRole === "cashier" ||
        selectedRole === "registrar" ||
        selectedRole === "signatory") &&
      value.length < 8
    ) {
      return "Invalid secret code format.";
    }

    return null;
  };

  const handleSignUp = async (e) => {
    e.preventDefault();

    const hasEmailError = await validateAndCheckEmail(email);
    if (hasEmailError) return;
    setLoading(true);
    try {
      if (
        !signUpData.firstName.trim() ||
        signUpData.firstName.trim().length < 2
      )
        throw new Error("First name too short");
      if (!signUpData.lastName.trim() || signUpData.lastName.trim().length < 2)
        throw new Error("Last name too short");
      if (!confirmPassword) throw new Error("Please confirm password");
      if (password !== confirmPassword)
        throw new Error("Passwords do not match");
      if (password.length < 8)
        throw new Error("Password must be at least 8 chars");
      if (
        !/[A-Z]/.test(password) ||
        !/[a-z]/.test(password) ||
        !/[0-9]/.test(password) ||
        !/[^A-Za-z0-9]/.test(password)
      )
        throw new Error("Password too weak");
      if (!recaptchaToken && !IS_LOCALHOST)
        throw new Error("Please verify reCAPTCHA");

      if (
        selectedRole === "staff" ||
        selectedRole === "librarian" ||
        selectedRole === "cashier" ||
        selectedRole === "registrar" ||
        selectedRole === "signatory"
      ) {
        if (!adminSecretCode || adminSecretCode.trim().length < 8) {
          throw new Error("Valid secret code is required");
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            firstName: signUpData.firstName.trim(),
            lastName: signUpData.lastName.trim(),
            role: signUpData.role,
            adminSecretCode:
              selectedRole !== "student" ? adminSecretCode : null,
            recaptchaToken: recaptchaToken,
          }),
        },
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Signup failed");

      toast.success("Account created! Now verify your email.");
      const normalizedEmail = email.trim().toLowerCase();
      setSignupUserId(result.user.id);
      setSignupEmail(normalizedEmail);
      setSignupToken(result.signupToken);
      persistPendingSignupVerification({
        scopeRole: roleScope,
        userId: result.user.id,
        email: normalizedEmail,
        signupToken: result.signupToken,
      });
      setShowEmailVerification(true);
    } catch (error) {
      toast.error(error.message);
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  if (showEmailVerification && signupUserId) {
    return (
      <EmailVerification
        email={signupEmail}
        userId={signupUserId}
        signupToken={signupToken}
        isDark={isDark}
        onVerified={() => {
          toast.success(
            "Email verified! Now set up 2FA to secure your account.",
          );
          const normalizedEmail = (signupEmail || email || "")
            .trim()
            .toLowerCase();
          clearPendingSignupVerification();
          persistPendingTwoFactorSetup({
            scopeRole: roleScope,
            userId: signupUserId,
            email: normalizedEmail,
            signupToken,
          });
          setSignupEmail(normalizedEmail);
          setShowEmailVerification(false);
          setShow2FASetup(true);
        }}
        onSwitchToLogin={() => {
          clearPendingSignupVerification();
          clearPendingTwoFactorSetup();
          if (onSwitchMode) onSwitchMode();
        }}
      />
    );
  }

  if (show2FASetup && signupUserId) {
    return (
      <TwoFactorSetup
        userId={signupUserId}
        email={signupEmail}
        signupToken={signupToken}
        isDark={isDark}
        onComplete={async () => {
          clearPendingTwoFactorSetup();
          clearPendingSignupVerification();
          toast.success("You're all set! Signing you in...");
          try {
            const {
              data: { session },
            } = await (
              await import("../../lib/supabase")
            ).supabase.auth.getSession();
            if (session?.user && onLoginSuccess) {
              await onLoginSuccess(session.user);
              return;
            }
          } catch (_e) {}
          toast.success("Please sign in with your new account.");
          setTimeout(() => {
            if (onSwitchMode) onSwitchMode();
          }, 1000);
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSignUp} className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            className={`block text-sm font-bold mb-1.5 ml-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
          >
            First Name <span className="text-red-500">*</span>
          </label>
          <SpotlightBorder
            isDark={isDark}
            error={getFieldError("firstName", signUpData.firstName)}
          >
            <input
              type="text"
              value={signUpData.firstName}
              onChange={(e) =>
                setSignUpData({
                  ...signUpData,
                  firstName: e.target.value.replace(/[^a-zA-ZÀ-ÿ\s'-]/g, ""),
                })
              }
              onBlur={() => handleBlur("firstName")}
              required
              className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-medium ${isDark ? "bg-slate-900 border-slate-700 text-white focus:border-green-500" : "bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"} ${getFieldError("firstName", signUpData.firstName) ? "!border-red-500 focus:!border-red-500 !ring-red-500 bg-red-50 text-red-900" : ""}`}
            />
          </SpotlightBorder>
          <AnimatePresence>
            {getFieldError("firstName", signUpData.firstName) && (
              <motion.p
                initial={{ opacity: 0, y: -5, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -5, height: 0 }}
                transition={{ duration: 0.2 }}
                className="text-red-500 text-xs mt-1 ml-1 font-bold"
              >
                {getFieldError("firstName", signUpData.firstName)}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div>
          <label
            className={`block text-sm font-bold mb-1.5 ml-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
          >
            Last Name <span className="text-red-500">*</span>
          </label>
          <SpotlightBorder
            isDark={isDark}
            error={getFieldError("lastName", signUpData.lastName)}
          >
            <input
              type="text"
              value={signUpData.lastName}
              onChange={(e) =>
                setSignUpData({
                  ...signUpData,
                  lastName: e.target.value.replace(/[^a-zA-ZÀ-ÿ\s'-]/g, ""),
                })
              }
              onBlur={() => handleBlur("lastName")}
              required
              className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-medium ${isDark ? "bg-slate-900 border-slate-700 text-white focus:border-green-500" : "bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"} ${getFieldError("lastName", signUpData.lastName) ? "!border-red-500 focus:!border-red-500 !ring-red-500 bg-red-50 text-red-900" : ""}`}
            />
          </SpotlightBorder>
          <AnimatePresence>
            {getFieldError("lastName", signUpData.lastName) && (
              <motion.p
                initial={{ opacity: 0, y: -5, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -5, height: 0 }}
                transition={{ duration: 0.2 }}
                className="text-red-500 text-xs mt-1 ml-1 font-bold"
              >
                {getFieldError("lastName", signUpData.lastName)}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div>
        <label
          className={`block text-sm font-bold mb-1.5 ml-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
        >
          Email <span className="text-red-500">*</span>
        </label>
        <SpotlightBorder
          isDark={isDark}
          error={getFieldError("email", email) || !!emailError}
        >
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value.toLowerCase());
                if (emailError) setEmailError("");
              }}
              onBlur={() => validateAndCheckEmail(email)}
              required
              className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-medium ${isDark ? "bg-slate-900 border-slate-700 text-white focus:border-green-500" : "bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"} ${getFieldError("email", email) || emailError ? "!border-red-500 focus:!border-red-500 !ring-red-500 bg-red-50 text-red-900" : ""}`}
            />
            {checkingEmail && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg
                  className="animate-spin h-5 w-5 text-green-500"
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
              </div>
            )}
          </div>
        </SpotlightBorder>
        <AnimatePresence>
          {(getFieldError("email", email) || emailError) && (
            <motion.p
              initial={{ opacity: 0, y: -5, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -5, height: 0 }}
              transition={{ duration: 0.2 }}
              className="text-red-500 text-xs mt-1 ml-1 font-bold"
            >
              {emailError || getFieldError("email", email)}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {selectedRole === "staff" && (
        <div className="relative z-20">
          <label
            className={`block text-sm font-bold mb-1.5 ml-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
          >
            Staff Role <span className="text-red-500">*</span>
          </label>
          <SpotlightBorder isDark={isDark}>
            <CustomSelect
              label=""
              value={signUpData.role}
              onChange={(val) => setSignUpData({ ...signUpData, role: val })}
              isDark={isDark}
              options={[
                { value: "signatory", label: "Signatory" },
                { value: "librarian", label: "Librarian" },
                { value: "cashier", label: "Cashier" },
                { value: "registrar", label: "Registrar" },
              ]}
            />
          </SpotlightBorder>
        </div>
      )}

      {selectedRole === "staff" && (
        <div>
          <label
            className={`block text-sm font-bold mb-1.5 ml-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
          >
            Staff Secret Code <span className="text-red-500">*</span>
          </label>
          <SpotlightBorder
            isDark={isDark}
            error={getFieldError("adminSecretCode", adminSecretCode)}
          >
            <input
              type="password"
              value={adminSecretCode}
              onChange={(e) => setAdminSecretCode(e.target.value)}
              onBlur={() => handleBlur("adminSecretCode")}
              required
              placeholder="Enter staff secret code"
              className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-medium ${isDark ? "bg-slate-900 border-slate-700 text-white focus:border-green-500 placeholder:text-slate-600" : "bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 placeholder:text-gray-400"} ${getFieldError("adminSecretCode", adminSecretCode) ? "!border-red-500 focus:!border-red-500 !ring-red-500 bg-red-50 text-red-900" : ""}`}
            />
          </SpotlightBorder>
          <AnimatePresence>
            {getFieldError("adminSecretCode", adminSecretCode) && (
              <motion.p
                initial={{ opacity: 0, y: -5, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -5, height: 0 }}
                transition={{ duration: 0.2 }}
                className="text-red-500 text-xs mt-1 ml-1 font-bold"
              >
                {getFieldError("adminSecretCode", adminSecretCode)}
              </motion.p>
            )}
          </AnimatePresence>
          <p
            className={`text-xs mt-1.5 ml-1 ${isDark ? "text-slate-500" : "text-gray-500"}`}
          >
            Contact your supervisor to obtain the staff secret code
          </p>
        </div>
      )}

      <div>
        <label
          className={`block text-sm font-bold mb-1.5 ml-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
        >
          Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <SpotlightBorder
            isDark={isDark}
            error={getFieldError("password", password)}
          >
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => handleBlur("password")}
              required
              className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-medium ${isDark ? "bg-slate-900 border-slate-700 text-white focus:border-green-500" : "bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"} ${getFieldError("password", password) ? "!border-red-500 focus:!border-red-500 !ring-red-500 bg-red-50 text-red-900" : ""}`}
            />
          </SpotlightBorder>
          <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
            <AnimatePresence>
              {password && confirmPassword && password === confirmPassword ? (
                <motion.div
                  key="pw-match"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 20 }}
                  className="text-green-500 absolute"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </motion.div>
              ) : password &&
                confirmPassword &&
                password !== confirmPassword ? (
                <motion.div
                  key="pw-mismatch"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 20 }}
                  className="text-red-500 absolute"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <button
            id="toggle-password-visibility"
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowPassword((prev) => !prev);
            }}
            className={`absolute right-4 top-1/2 -translate-y-1/2 focus:outline-none transition-colors z-10 ${isDark ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600"}`}
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
        <div className="mt-2">
          <PasswordStrengthMeter
            password={password}
            isVisible={isPasswordFocused}
            isDark={isDark}
          />
        </div>
      </div>

      <div>
        <label
          className={`block text-sm font-bold mb-1.5 ml-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
        >
          Confirm Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <SpotlightBorder
            isDark={isDark}
            error={getFieldError("confirmPassword", confirmPassword, password)}
          >
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => handleBlur("confirmPassword")}
              required
              className={`w-full border rounded-xl px-4 py-3 outline-none transition-all font-medium ${isDark ? "bg-slate-900 border-slate-700 text-white focus:border-green-500" : "bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"} ${getFieldError("confirmPassword", confirmPassword, password) ? "!border-red-500 focus:!border-red-500 !ring-red-500 bg-red-50 text-red-900" : ""}`}
            />
          </SpotlightBorder>
          <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
            <AnimatePresence>
              {password && confirmPassword && password === confirmPassword ? (
                <motion.div
                  key="cp-match"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 20 }}
                  className="text-green-500 absolute"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </motion.div>
              ) : password &&
                confirmPassword &&
                password !== confirmPassword ? (
                <motion.div
                  key="cp-mismatch"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 20 }}
                  className="text-red-500 absolute"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <button
            id="toggle-confirm-password-visibility"
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowPassword((prev) => !prev);
            }}
            className={`absolute right-4 top-1/2 -translate-y-1/2 focus:outline-none transition-colors z-10 ${isDark ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600"}`}
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
          {getFieldError("confirmPassword", confirmPassword, password) && (
            <motion.p
              initial={{ opacity: 0, y: -5, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -5, height: 0 }}
              transition={{ duration: 0.2 }}
              className="text-red-500 text-xs mt-1 ml-1 font-bold"
            >
              {getFieldError("confirmPassword", confirmPassword, password)}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {!IS_LOCALHOST && (
        <div className="flex justify-center py-2 items-center">
          <ReCAPTCHA
            key={isDark ? "dark" : "light"}
            ref={recaptchaRef}
            sitekey={RECAPTCHA_SITE_KEY}
            onChange={(token) => {
              setRecaptchaToken(token);
              setRecaptchaExpired(false);
            }}
            onExpired={() => {
              setRecaptchaToken(null);
              setRecaptchaExpired(true);
            }}
            theme={isDark ? "dark" : "light"}
          />
        </div>
      )}

      {recaptchaExpired && !recaptchaToken && !IS_LOCALHOST && (
        <p className="text-center text-xs font-semibold text-amber-500 -mt-1 mb-1">
          reCAPTCHA expired. Please re-verify above.
        </p>
      )}

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        type="submit"
        disabled={loading || (!recaptchaToken && !IS_LOCALHOST)}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-full shadow-lg shadow-green-500/20 transition-all text-base disabled:grayscale disabled:opacity-50 flex items-center justify-center gap-2"
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
            <span>Processing...</span>
          </>
        ) : (
          "Create Account"
        )}
      </motion.button>

      <div className="flex items-center gap-4 mt-4 mb-4">
        <div
          className={`h-px flex-1 ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
        ></div>
        <span
          className={`text-sm font-medium transition-colors shrink-0 ${isDark ? "text-slate-400" : "text-gray-500"}`}
        >
          Isabela State University
        </span>
        <div
          className={`h-px flex-1 ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
        ></div>
      </div>
    </form>
  );
}
