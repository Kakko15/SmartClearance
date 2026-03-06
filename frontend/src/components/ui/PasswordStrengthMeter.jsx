import { motion, AnimatePresence } from "framer-motion";

export default function PasswordStrengthMeter({ password, isVisible, isDark }) {
  const show = isVisible;

  const checks = [
    {
      id: "length",
      label: "At least 8 characters",
      isValid: password ? password.length >= 8 : false,
    },
    {
      id: "uppercase",
      label: "One uppercase letter",
      isValid: password ? /[A-Z]/.test(password) : false,
    },
    {
      id: "lowercase",
      label: "One lowercase letter",
      isValid: password ? /[a-z]/.test(password) : false,
    },
    {
      id: "number",
      label: "One number",
      isValid: password ? /[0-9]/.test(password) : false,
    },
    {
      id: "special",
      label: "One special character",
      isValid: password ? /[^A-Za-z0-9]/.test(password) : false,
    },
  ];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: "auto", marginTop: 12 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div
            className={`grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 p-4 rounded-xl border transition-colors ${
              isDark
                ? "bg-slate-900/50 border-slate-700"
                : "bg-slate-50/50 border-slate-100"
            }`}
          >
            {checks.map((check) => (
              <div
                key={check.id}
                className={`flex items-center gap-2 text-xs font-medium transition-colors duration-300 ${
                  check.isValid
                    ? isDark
                      ? "text-green-400"
                      : "text-green-600"
                    : isDark
                      ? "text-red-400"
                      : "text-red-500"
                }`}
              >
                <div className="relative flex items-center justify-center w-4 h-4">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {check.isValid ? (
                      <motion.svg
                        key="valid"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        className={`w-5 h-5 absolute ${isDark ? "text-green-400" : "text-green-500"}`}
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
                      </motion.svg>
                    ) : (
                      <motion.svg
                        key="invalid"
                        initial={{ scale: 0, rotate: 180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: -180 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        className={`w-5 h-5 absolute ${isDark ? "text-red-400" : "text-red-500"}`}
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
                      </motion.svg>
                    )}
                  </AnimatePresence>
                </div>
                <span>{check.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
