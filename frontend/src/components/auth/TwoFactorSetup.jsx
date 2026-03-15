import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function TwoFactorSetup({ userId, email, signupToken, isDark, onComplete }) {
  const [qrCode, setQrCode] = useState(null);
  const [manualKey, setManualKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    const setup = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/2fa/setup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, email, signupToken }),
        });
        const data = await res.json();
        if (data.success) {
          setQrCode(data.qrCode);
          setManualKey(data.manualKey);
        } else {
          toast.error(data.error || "Failed to setup 2FA");
        }
      } catch (err) {
        toast.error("Failed to connect to server");
      } finally {
        setLoading(false);
      }
    };
    setup();
  }, [userId, email, signupToken]);

  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digits = verifyCode.split("");
    while (digits.length < 6) digits.push("");
    digits[index] = value.slice(-1);
    const newCode = digits.join("");
    setVerifyCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !verifyCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    setVerifyCode(pasted);
    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (verifyCode.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(`${API_URL}/auth/2fa/verify-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token: verifyCode, signupToken }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("2FA enabled successfully!");
        onComplete();
      } else {
        toast.error(data.error || "Invalid code");
        setVerifyCode("");
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      toast.error("Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(manualKey);
    setCopied(true);
    toast.success("Key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <svg className="animate-spin h-12 w-12 text-green-500 mb-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className={isDark ? "text-gray-400" : "text-gray-600"}>Setting up 2FA...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="text-center mb-6">
        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${isDark ? "bg-green-500/20" : "bg-green-100"}`}>
          <svg className={`w-8 h-8 ${isDark ? "text-green-400" : "text-green-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className={`text-2xl font-bold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
          Set Up Two-Factor Authentication
        </h2>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          Scan the QR code with Google Authenticator or any authenticator app
        </p>
      </div>

      {qrCode && (
        <div className={`p-6 rounded-2xl border mb-5 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-gray-200"} shadow-lg`}>
          <div className="flex justify-center mb-4">
            <div className="bg-white p-3 rounded-xl">
              <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
            </div>
          </div>

          <div className="text-center mb-4">
            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Or enter this key manually
            </p>
            <div className={`flex items-center justify-center gap-2 p-3 rounded-xl ${isDark ? "bg-slate-900 border border-slate-700" : "bg-gray-50 border border-gray-200"}`}>
              <code className={`text-sm font-mono font-bold tracking-wider select-none ${isDark ? "text-green-400" : "text-green-700"}`}>
                {showKey ? manualKey : "••••  ••••  ••••  ••••"}
              </code>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                title={showKey ? "Hide key" : "Reveal key"}
                aria-label={showKey ? "Hide secret key" : "Reveal secret key"}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-gray-400 hover:text-white" : "hover:bg-gray-200 text-gray-500 hover:text-gray-900"}`}
              >
                {showKey ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.72 11.72 0 01-4.168 4.477M6.343 6.343L3 3m3.343 3.343l2.829 2.829m4.243 4.243l2.829 2.829M6.343 6.343l11.314 11.314M14.121 14.121A3 3 0 009.879 9.879" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={copyKey}
                title="Copy key"
                aria-label="Copy secret key to clipboard"
                className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-gray-400 hover:text-white" : "hover:bg-gray-200 text-gray-500 hover:text-gray-900"}`}
              >
                {copied ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleVerify}>
        <div className="mb-5">
          <label className={`block text-sm font-bold mb-3 text-center ${isDark ? "text-slate-300" : "text-gray-700"}`}>
            Enter the 6-digit code from your app
          </label>
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {Array.from({ length: 6 }).map((_, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                aria-label={`Digit ${i + 1} of 6`}
                value={verifyCode[i] || ""}
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
        </div>

        <button
          type="submit"
          disabled={verifying || verifyCode.length !== 6}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-full shadow-lg transition-all disabled:opacity-50"
        >
          {verifying ? "Verifying..." : "Verify & Enable 2FA"}
        </button>
      </form>
    </motion.div>
  );
}
