import { useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.access_token) return data.session.access_token;

  const { data: refreshed } = await supabase.auth.refreshSession();
  if (refreshed?.session?.access_token) return refreshed.session.access_token;

  console.warn(
    "2FA: No valid session — request will be sent without auth. User may need to re-login.",
  );
  return null;
}

export default function TwoFactorVerify({
  userId,
  email,
  isDark,
  onVerified,
  onCancel,
}) {
  const [method, setMethod] = useState(
    () => sessionStorage.getItem("2fa_method") || "authenticator",
  );
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [emailSent, setEmailSent] = useState(() => {
    const expiresAt = sessionStorage.getItem("2fa_email_expires_at");
    if (expiresAt && Date.now() < Number(expiresAt)) return true;
    sessionStorage.removeItem("2fa_email_sent_at");
    sessionStorage.removeItem("2fa_email_expires_at");
    return false;
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expired, setExpired] = useState(false);
  const [locked, setLocked] = useState(false);
  const inputRefs = useRef([]);
  const timerRef = useRef(null);
  const cooldownRef = useRef(null);
  const submittingRef = useRef(false);

  const expiredRef = useRef(false);
  const lockedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    const expiresAt = Number(
      sessionStorage.getItem("2fa_email_expires_at") || 0,
    );
    if (emailSent && expiresAt > Date.now()) {
      startCountdown(expiresAt - Date.now());
    } else if (emailSent && expiresAt <= Date.now()) {
      setExpired(true);
    }
  }, []);

  const startCountdown = (ms) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const endTime = Date.now() + ms;
    setCountdown(Math.ceil(ms / 1000));
    setExpired(false);
    timerRef.current = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setCountdown(0);
        setExpired(true);

        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = null;
        setResendCooldown(0);
        sessionStorage.removeItem("2fa_email_sent_at");
        sessionStorage.removeItem("2fa_email_expires_at");
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  const startResendCooldown = (seconds = 30) => {
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

  useEffect(() => {
    expiredRef.current = expired;
  }, [expired]);
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  const submitCode = useCallback(
    async (codeToSubmit) => {
      const cleanCode = codeToSubmit.replace(/\D/g, "");
      if (cleanCode.length !== 6) return;
      if (submittingRef.current) return;
      // L7 FIX: Read from refs instead of stale closure state
      if (expiredRef.current || lockedRef.current) return;
      submittingRef.current = true;
      setVerifying(true);
      try {
        const endpoint =
          method === "authenticator"
            ? "/auth/2fa/verify-totp"
            : "/auth/2fa/verify-email-otp";
        const body =
          method === "authenticator"
            ? { userId, token: cleanCode }
            : { userId, otp: cleanCode };

        const accessToken = await getAccessToken();
        const headers = { "Content-Type": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

        const res = await fetch(`${API_URL}${endpoint}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
          clearTimers();
          sessionStorage.removeItem("2fa_method");
          sessionStorage.removeItem("2fa_email_sent_at");
          sessionStorage.removeItem("2fa_email_expires_at");
          toast.success("Verified!");
          onVerified();
        } else {
          if (data.expired) setExpired(true);
          if (data.locked) setLocked(true);
          toast.error(data.error || "Invalid code");
          setCode("");
          inputRefs.current[0]?.focus();
        }
      } catch {
        toast.error("Verification failed");
      } finally {
        setVerifying(false);
        submittingRef.current = false;
      }
    },
    [method, userId, clearTimers, onVerified],
  );

  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digits = code.split("");
    while (digits.length < 6) digits.push("");
    digits[index] = value.slice(-1);
    const newCode = digits.join("");
    const digitOnly = newCode.replace(/\D/g, "");
    setCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 digits entered.
    if (digitOnly.length === 6) {
      setTimeout(() => submitCode(newCode), 100);
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
    if (pasted.length === 6) {
      setTimeout(() => submitCode(pasted), 100);
    }
  };

  const sendEmailOTP = async () => {
    if (resendCooldown > 0) return;
    setSendingEmail(true);
    try {
      const accessToken = await getAccessToken();
      const headers = { "Content-Type": "application/json" };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      const res = await fetch(`${API_URL}/auth/2fa/send-email-otp`, {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, email }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailSent(true);
        setExpired(false);
        setLocked(false);
        setCode("");
        const expiresInMs = data.expiresIn || 180000;
        const nextCooldown = data.resendCooldown || 30;
        sessionStorage.setItem("2fa_email_sent_at", Date.now().toString());
        sessionStorage.setItem(
          "2fa_email_expires_at",
          (Date.now() + expiresInMs).toString(),
        );
        toast.success("Verification code sent to your email");
        startCountdown(expiresInMs);
        startResendCooldown(nextCooldown);
      } else {
        if (data.retryAfter) {
          startResendCooldown(data.retryAfter);
        }
        toast.error(data.error || "Failed to send code");
      }
    } catch {
      toast.error("Failed to send verification code");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleManualVerify = (e) => {
    e.preventDefault();
    submittingRef.current = false;
    submitCode(code);
  };

  const switchMethod = (newMethod) => {
    setMethod(newMethod);
    sessionStorage.setItem("2fa_method", newMethod);
    setCode("");
    // When switching back to email, restore emailSent state from session storage
    if (newMethod === "email") {
      const expiresAt = Number(
        sessionStorage.getItem("2fa_email_expires_at") || 0,
      );
      if (expiresAt > Date.now()) {
        setEmailSent(true);
        setExpired(false);
        setLocked(false);
        startCountdown(expiresAt - Date.now());
      } else if (expiresAt > 0) {
        setEmailSent(false);
        setExpired(false);
        setLocked(false);
        sessionStorage.removeItem("2fa_email_sent_at");
        sessionStorage.removeItem("2fa_email_expires_at");
      }
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem("2fa_method");
    sessionStorage.removeItem("2fa_email_sent_at");
    sessionStorage.removeItem("2fa_email_expires_at");
    onCancel();
  };

  const maskedEmail = email
    ? email.replace(
        /(.{2})(.*)(@.*)/,
        (_, a, b, c) => a + "*".repeat(Math.min(b.length, 6)) + c,
      )
    : "";

  const isInputDisabled = expired || locked || verifying;

  const codeInputs = (
    <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          aria-label={`Digit ${i + 1} of 6`}
          value={code[i] || ""}
          onChange={(e) => handleCodeChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={isInputDisabled}
          className={`w-[50px] h-[60px] text-center text-2xl font-normal rounded outline-none transition-all duration-200 ${
            isInputDisabled ? "opacity-40 cursor-not-allowed" : ""
          } ${
            isDark
              ? "bg-transparent border border-slate-500 text-slate-100 focus:border-2 focus:border-primary-400"
              : "bg-transparent border border-gray-400 text-gray-900 focus:border-2 focus:border-primary-600"
          }`}
        />
      ))}
    </div>
  );

  const verifyButton = (
    <button
      type="submit"
      disabled={
        verifying || code.replace(/\D/g, "").length !== 6 || isInputDisabled
      }
      className={`w-full py-3 mb-3 btn-premium flex items-center justify-center transition-all ${
        verifying || code.replace(/\D/g, "").length !== 6 || isInputDisabled
          ? "opacity-50 cursor-not-allowed shadow-none"
          : ""
      }`}
    >
      {verifying ? (
        <span className="flex items-center justify-center gap-2">
          <span className="material-symbols-rounded animate-spin text-[20px]">
            progress_activity
          </span>
          Verifying...
        </span>
      ) : (
        "Verify code"
      )}
    </button>
  );

  const expiredOrLockedMessage = (expired || locked) && (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`text-center mb-4 p-3 rounded-xl ${isDark ? "bg-red-900/20" : "bg-red-50"}`}
    >
      <p
        className={`text-sm font-medium ${isDark ? "text-red-400" : "text-red-600"}`}
      >
        {locked ? "Too many failed attempts." : "Code expired."}
      </p>
      <button
        type="button"
        onClick={sendEmailOTP}
        disabled={sendingEmail || resendCooldown > 0}
        className={`text-sm font-semibold mt-1 transition-colors ${
          resendCooldown > 0 ? "opacity-40 cursor-not-allowed" : ""
        } ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
      >
        {sendingEmail
          ? "Sending..."
          : resendCooldown > 0
            ? `Request new code in ${resendCooldown}s`
            : "Request a new code"}
      </button>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="text-center mb-8">
        <div
          className={`w-[52px] h-[52px] rounded-full mx-auto mb-5 flex items-center justify-center ${isDark ? "bg-primary-900/30" : "bg-primary-50"}`}
        >
          <span
            className={`material-symbols-rounded text-3xl ${isDark ? "text-primary-400" : "text-primary-600"}`}
          >
            shield_lock
          </span>
        </div>
        <h2
          className={`text-2xl font-medium tracking-tight mb-2 font-display ${isDark ? "text-slate-100" : "text-gray-900"}`}
        >
          Two-Step Verification
        </h2>
        <p
          className={`text-[15px] ${isDark ? "text-slate-400" : "text-gray-600"}`}
        >
          Verify your identity to continue
        </p>
      </div>

      <div
        className={`flex rounded-full p-1 mb-8 border relative overflow-hidden transition-colors ${isDark ? "bg-transparent border-slate-700" : "bg-transparent border-gray-300"}`}
      >
        <motion.div
          layoutId="2fa-tab-indicator"
          className={`absolute top-1 bottom-1 rounded-full ${isDark ? "bg-primary-900/40" : "bg-primary-100/60"}`}
          style={{
            width: "calc(50% - 4px)",
            left: method === "authenticator" ? 4 : "calc(50% + 0px)",
          }}
          transition={{ duration: 0.2, ease: [0.05, 0.7, 0.1, 1] }}
        />
        <button
          type="button"
          onClick={() => switchMethod("authenticator")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium relative z-10 transition-colors duration-200 ${
            method === "authenticator"
              ? isDark
                ? "text-primary-400"
                : "text-primary-800"
              : isDark
                ? "text-slate-400 hover:bg-slate-800"
                : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <span className="material-symbols-rounded text-[18px]">
            smartphone
          </span>
          Authenticator
        </button>
        <button
          type="button"
          onClick={() => switchMethod("email")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium relative z-10 transition-colors duration-200 ${
            method === "email"
              ? isDark
                ? "text-primary-400"
                : "text-primary-800"
              : isDark
                ? "text-slate-400 hover:bg-slate-800"
                : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <span className="material-symbols-rounded text-[18px]">mail</span>
          Email OTP
        </button>
      </div>

      <div className="relative">
        <AnimatePresence mode="wait" initial={false}>
          {method === "authenticator" ? (
            <motion.div
              key="authenticator"
              initial={{ opacity: 0, x: -20, filter: "blur(2px)" }}
              animate={{
                opacity: 1,
                x: 0,
                filter: "blur(0px)",
                pointerEvents: "auto",
              }}
              exit={{
                opacity: 0,
                x: 20,
                filter: "blur(2px)",
                pointerEvents: "none",
              }}
              transition={{ duration: 0.2, ease: [0.05, 0.7, 0.1, 1] }}
            >
              <p
                className={`text-[15px] text-center mb-6 ${isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                Enter the 6-digit code from your authenticator app
              </p>
              <form onSubmit={handleManualVerify}>
                {codeInputs}
                {verifyButton}
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 20, filter: "blur(2px)" }}
              animate={{
                opacity: 1,
                x: 0,
                filter: "blur(0px)",
                pointerEvents: "auto",
              }}
              exit={{
                opacity: 0,
                x: -20,
                filter: "blur(2px)",
                pointerEvents: "none",
              }}
              transition={{ duration: 0.2, ease: [0.05, 0.7, 0.1, 1] }}
            >
              {!emailSent ? (
                <div className="text-center mb-4">
                  <p
                    className={`text-[15px] mb-6 ${isDark ? "text-gray-400" : "text-gray-500"}`}
                  >
                    We'll send a verification code to{" "}
                    <strong className={isDark ? "text-white" : "text-gray-900"}>
                      {maskedEmail}
                    </strong>
                  </p>
                  <button
                    type="button"
                    onClick={sendEmailOTP}
                    disabled={sendingEmail || resendCooldown > 0}
                    className={`px-8 py-2.5 btn-premium inline-flex items-center gap-2 transition-all ${
                      sendingEmail || resendCooldown > 0
                        ? "opacity-50 cursor-not-allowed shadow-none"
                        : ""
                    }`}
                  >
                    {sendingEmail ? (
                      <>
                        <span className="material-symbols-rounded animate-spin text-[18px]">
                          progress_activity
                        </span>{" "}
                        Sending...
                      </>
                    ) : resendCooldown > 0 ? (
                      `Wait ${resendCooldown}s`
                    ) : (
                      "Send Code"
                    )}
                  </button>
                </div>
              ) : (
                <>
                  {expiredOrLockedMessage}

                  {!expired && !locked && (
                    <div className="text-center mb-4">
                      <p
                        className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}
                      >
                        Enter the code sent to{" "}
                        <strong
                          className={isDark ? "text-white" : "text-gray-900"}
                        >
                          {maskedEmail}
                        </strong>
                      </p>
                      {countdown > 0 && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`text-xs mt-1.5 font-semibold ${
                            countdown <= 30
                              ? "text-red-500"
                              : countdown <= 60
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
                    </div>
                  )}

                  {!expired && !locked && (
                    <form onSubmit={handleManualVerify}>
                      {codeInputs}
                      {verifyButton}
                      <button
                        type="button"
                        onClick={sendEmailOTP}
                        disabled={sendingEmail || resendCooldown > 0}
                        className={`w-full text-sm font-semibold py-2 transition-colors disabled:opacity-40 ${
                          isDark
                            ? "text-blue-400 hover:text-blue-300"
                            : "text-blue-600 hover:text-blue-700"
                        }`}
                      >
                        {sendingEmail
                          ? "Sending..."
                          : resendCooldown > 0
                            ? `Resend code in ${resendCooldown}s`
                            : "Resend code"}
                      </button>
                    </form>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={handleCancel}
        className={`w-full text-[14px] font-medium py-2 mt-4 rounded-full transition-colors ${isDark ? "text-primary-400 hover:bg-primary-900/20" : "text-primary-600 hover:bg-primary-50"}`}
      >
        Cancel & Sign Out
      </button>
    </motion.div>
  );
}
