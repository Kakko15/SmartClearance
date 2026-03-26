import { useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function EmailVerification({
  email,
  userId,
  isDark,
  onVerified,
  onSwitchToLogin,
  signupToken,
  verifyToken,
}) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const submittingRef = useRef(false);
  const [countdown, setCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(60);
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

  const storagePrefix = `email_verify_${userId}_`;

  useEffect(() => {
    const storedExpiry = sessionStorage.getItem(`${storagePrefix}expires_at`);
    if (storedExpiry) {
      const remaining = Math.ceil((Number(storedExpiry) - Date.now()) / 1000);
      if (remaining > 0) {
        startCountdown(remaining);
      } else {
        setCountdown(0);
        sessionStorage.removeItem(`${storagePrefix}expires_at`);
      }
    } else {

      const expiresAt = Date.now() + 600 * 1000;
      sessionStorage.setItem(
        `${storagePrefix}expires_at`,
        expiresAt.toString(),
      );
      startCountdown(600);
    }

    const storedCooldown = sessionStorage.getItem(
      `${storagePrefix}resend_until`,
    );
    if (storedCooldown) {
      const remaining = Math.ceil((Number(storedCooldown) - Date.now()) / 1000);
      if (remaining > 0) {
        startResendCooldown(remaining);
      } else {
        setResendCooldown(0);
        sessionStorage.removeItem(`${storagePrefix}resend_until`);
      }
    } else {
      const cooldownUntil = Date.now() + 60 * 1000;
      sessionStorage.setItem(
        `${storagePrefix}resend_until`,
        cooldownUntil.toString(),
      );
      startResendCooldown(60);
    }
  }, [storagePrefix]);

  const startCountdown = (seconds) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const endTime = Date.now() + seconds * 1000;
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setCountdown(0);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  const startResendCooldown = (seconds) => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    const endTime = Date.now() + seconds * 1000;
    setResendCooldown(seconds);
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

  const maskedEmail = email
    ? email.replace(
        /(.{2})(.*)(@.*)/,
        (_, a, b, c) => a + "*".repeat(Math.min(b.length, 6)) + c,
      )
    : "";

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
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    setCode(pasted);
    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setVerifying(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code }),
      });
      const data = await res.json();
      if (data.success) {
        clearTimers();
        sessionStorage.removeItem(`${storagePrefix}expires_at`);
        sessionStorage.removeItem(`${storagePrefix}resend_until`);
        toast.success("Email verified successfully!");
        onVerified();
      } else {
        toast.error(data.error || "Invalid code");
        setCode("");
        inputRefs.current[0]?.focus();
      }
    } catch {
      toast.error("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
      submittingRef.current = false;
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    try {
      const res = await fetch(`${API_URL}/auth/send-verification-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email, signupToken, verifyToken }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("New verification code sent!");
        setCode("");
        const expiresAt = Date.now() + 600 * 1000;
        sessionStorage.setItem(
          `${storagePrefix}expires_at`,
          expiresAt.toString(),
        );
        startCountdown(600);
        const cooldownUntil = Date.now() + 60 * 1000;
        sessionStorage.setItem(
          `${storagePrefix}resend_until`,
          cooldownUntil.toString(),
        );
        startResendCooldown(60);
      } else {
        toast.error(data.error || "Failed to resend code");
      }
    } catch {
      toast.error("Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="text-center mb-6">
        <div
          className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${isDark ? "bg-green-500/20" : "bg-green-100"}`}
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
        <h2
          className={`text-2xl font-bold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}
        >
          Verify Your Email
        </h2>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          We sent a 6-digit code to{" "}
          <strong className={isDark ? "text-white" : "text-gray-900"}>
            {maskedEmail}
          </strong>
        </p>
        {countdown > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`text-xs mt-2 font-semibold ${
              countdown <= 60
                ? "text-red-500"
                : countdown <= 180
                  ? isDark
                    ? "text-yellow-400"
                    : "text-yellow-600"
                  : isDark
                    ? "text-green-400"
                    : "text-green-600"
            }`}
          >
            Code expires in {formatTime(countdown)}
          </motion.p>
        )}
        {countdown === 0 && (
          <p className="text-xs mt-2 text-red-500 font-semibold">
            Code expired. Please request a new one.
          </p>
        )}
      </div>

      <form onSubmit={handleVerify}>
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
              aria-label={`Verification code digit ${i + 1}`}
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
          disabled={verifying || code.length !== 6 || countdown === 0}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-full shadow-lg transition-all disabled:opacity-50 mb-3"
        >
          {verifying ? "Verifying..." : "Verify Email"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending || resendCooldown > 0}
        className={`w-full text-sm font-semibold py-2 transition-colors disabled:opacity-40 ${isDark ? "text-green-400 hover:text-green-300" : "text-green-600 hover:text-green-700"}`}
      >
        {resending
          ? "Sending..."
          : resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : "Resend verification code"}
      </button>

      <button
        type="button"
        onClick={onSwitchToLogin}
        className={`w-full text-sm font-semibold py-2 mt-1 transition-colors ${isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
      >
        Already verified? Sign in
      </button>
    </motion.div>
  );
}
