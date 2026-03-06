import { useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function TwoFactorVerify({ userId, email, isDark, onVerified, onCancel }) {
  const [method, setMethod] = useState("authenticator");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);
  const timerRef = useRef(null);
  const cooldownRef = useRef(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  }, []);

  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  const startCountdown = (ms) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const endTime = Date.now() + ms;
    setCountdown(Math.ceil(ms / 1000));
    timerRef.current = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setCountdown(0);
        setEmailSent(false);
        toast.error("Code expired. Please request a new one.");
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  const startResendCooldown = () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    const endTime = Date.now() + 60000;
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
        setResendCooldown(0);
      } else {
        setResendCooldown(remaining);
      }
    }, 1000);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digits = code.split("");
    while (digits.length < 6) digits.push("");
    digits[index] = value.slice(-1);
    const newCode = digits.join("");
    setCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    setCode(pasted);
    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
  };

  const sendEmailOTP = async () => {
    if (resendCooldown > 0) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`${API_URL}/auth/2fa/send-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailSent(true);
        setCode("");
        toast.success("Verification code sent to your email");
        startCountdown(data.expiresIn || 180000);
        startResendCooldown();
      } else {
        toast.error(data.error || "Failed to send code");
      }
    } catch (err) {
      toast.error("Failed to send verification code");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }
    setVerifying(true);
    try {
      const endpoint = method === "authenticator" ? "/auth/2fa/verify-totp" : "/auth/2fa/verify-email-otp";
      const body = method === "authenticator"
        ? { userId, token: code }
        : { userId, otp: code };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        clearTimers();
        toast.success("Verified!");
        onVerified();
      } else {
        toast.error(data.error || "Invalid code");
        setCode("");
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      toast.error("Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const switchMethod = (newMethod) => {
    setMethod(newMethod);
    setCode("");
    setEmailSent(false);
    clearTimers();
    setCountdown(0);
    setResendCooldown(0);
  };

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + "*".repeat(b.length) + c)
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="text-center mb-6">
        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${isDark ? "bg-blue-500/20" : "bg-blue-100"}`}>
          <svg className={`w-8 h-8 ${isDark ? "text-blue-400" : "text-blue-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h2 className={`text-2xl font-bold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
          Two-Factor Authentication
        </h2>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          Verify your identity to continue
        </p>
      </div>

      <div className={`flex rounded-xl p-1 mb-5 ${isDark ? "bg-slate-800" : "bg-gray-100"}`}>
        <button
          type="button"
          onClick={() => switchMethod("authenticator")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            method === "authenticator"
              ? isDark ? "bg-green-500 text-white shadow-lg" : "bg-white text-gray-900 shadow-md"
              : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Authenticator
        </button>
        <button
          type="button"
          onClick={() => switchMethod("email")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            method === "email"
              ? isDark ? "bg-green-500 text-white shadow-lg" : "bg-white text-gray-900 shadow-md"
              : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Email OTP
        </button>
      </div>

      <AnimatePresence mode="wait">
        {method === "authenticator" ? (
          <motion.div
            key="authenticator"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            <p className={`text-sm text-center mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Enter the 6-digit code from your authenticator app
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="email"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            {!emailSent ? (
              <div className="text-center mb-4">
                <p className={`text-sm mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  We'll send a verification code to <strong className={isDark ? "text-white" : "text-gray-900"}>{maskedEmail}</strong>
                </p>
                <button
                  type="button"
                  onClick={sendEmailOTP}
                  disabled={sendingEmail}
                  className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all ${
                    isDark
                      ? "bg-blue-500 hover:bg-blue-600 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  } disabled:opacity-50`}
                >
                  {sendingEmail ? "Sending..." : "Send Code"}
                </button>
              </div>
            ) : (
              <div className="text-center mb-4">
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Enter the code sent to <strong className={isDark ? "text-white" : "text-gray-900"}>{maskedEmail}</strong>
                </p>
                {countdown > 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`text-xs mt-1.5 font-semibold ${
                      countdown <= 30
                        ? "text-red-500"
                        : countdown <= 60
                          ? isDark ? "text-yellow-400" : "text-yellow-600"
                          : isDark ? "text-green-400" : "text-green-600"
                    }`}
                  >
                    Code expires in {formatTime(countdown)}
                  </motion.p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleVerify}>
        {(method === "authenticator" || emailSent) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex justify-center gap-2 mb-5" onPaste={handlePaste}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={code[i] || ""}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all ${
                    isDark
                      ? "bg-slate-800 border-slate-600 text-white focus:border-green-500"
                      : "bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  }`}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-full shadow-lg transition-all disabled:opacity-50 mb-3"
            >
              {verifying ? "Verifying..." : "Verify"}
            </button>
          </motion.div>
        )}

        {method === "email" && emailSent && (
          <button
            type="button"
            onClick={sendEmailOTP}
            disabled={sendingEmail || resendCooldown > 0}
            className={`w-full text-sm font-semibold py-2 transition-colors disabled:opacity-40 ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
          >
            {sendingEmail
              ? "Sending..."
              : resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Resend code"}
          </button>
        )}
      </form>

      <button
        type="button"
        onClick={onCancel}
        className={`w-full text-sm font-semibold py-2 mt-2 transition-colors ${isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
      >
        Cancel & Sign Out
      </button>
    </motion.div>
  );
}
