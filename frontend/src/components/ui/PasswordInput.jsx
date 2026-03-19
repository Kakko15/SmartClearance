import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SpotlightBorder from "./SpotlightBorder";

export default function PasswordInput({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = "",
  required = false,
  minLength,
  label,
  showStrength: _showStrength = false,
  className = "",
  isDark = false,
  status = null, // "success" | "error" | null
}) {
  const [showPassword, setShowPassword] = useState(false);

  const baseInputClass = `w-full px-4 py-3 bg-transparent border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 ${status ? 'pr-20' : 'pr-12'} ${
    isDark
      ? "border-[#5f6368] text-[#e8eaed] placeholder-[#9aa0a6] hover:border-[#9aa0a6]"
      : "border-[#dadce0] text-[#202124] placeholder-[#5f6368] hover:border-[#80868b]"
  }`;

  return (
    <div>
      {label && (
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
          {label} {required && <span className={isDark ? "text-red-400" : "text-red-500"}>*</span>}
        </label>
      )}
      <div className="relative">
        <SpotlightBorder isDark={isDark} error={status === "error"}>
          <input
            type={showPassword ? "text" : "password"}
            value={value}
            onChange={onChange}
            onFocus={onFocus}
            onBlur={onBlur}
            required={required}
            minLength={minLength}
            className={`${baseInputClass} ${className} ${status === "error" ? "!border-red-500 focus:!border-red-500 !ring-red-500 bg-red-50 text-red-900" : ""}`}
            placeholder={placeholder}
          />
        </SpotlightBorder>
        
        {/* Status Icon with Smooth Google-like Animation */}
        <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
          <AnimatePresence>
            {status === "success" ? (
              <motion.div
                key="success"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 20 }}
                className={`${isDark ? "text-green-400" : "text-green-500"} absolute`}
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
            ) : status === "error" ? (
              <motion.div
                key="error"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 20 }}
                className={`${isDark ? "text-red-400" : "text-red-500"} absolute`}
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
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
  // BUG 12 FIX: Use theme-aware colors for the eye icon toggle button
          className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-md transition-colors ${isDark ? "text-[#9aa0a6] hover:text-[#e8eaed]" : "text-[#5f6368] hover:text-[#202124]"} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600`}
        >
          {showPassword ? (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
              stroke="currentColor"
              viewBox="0 0 24 24"
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
    </div>
  );
}
