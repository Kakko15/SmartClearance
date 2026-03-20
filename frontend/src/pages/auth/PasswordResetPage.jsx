import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import PasswordStrengthMeter from "../../components/ui/PasswordStrengthMeter";
import logo from "../../assets/logo.png";

export default function PasswordResetPage() {
  const { completePasswordReset } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resettingPw, setResettingPw] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);
  const [isNewPwFocused, setIsNewPwFocused] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      toast.error("Password must meet all strength requirements");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setResettingPw(true);
    try {
      const updatePromise = supabase.auth.updateUser({ password: newPassword });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out.")), 15000),
      );
      const { error } = await Promise.race([updatePromise, timeoutPromise]);
      if (error) throw error;
      toast.success("Password updated successfully! Please sign in.");
      completePasswordReset();
      await supabase.auth.signOut();
      sessionStorage.setItem("hasSeenLoader", "true");
      const savedRole = sessionStorage.getItem("selectedRole");
      navigate(savedRole ? "/auth" : "/select-role", { replace: true });
    } catch (err) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setResettingPw(false);
    }
  };

  const EyeOpen = () => (
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
  );

  const EyeClosed = () => (
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
  );

  const MatchIcon = ({ match }) => (
    <AnimatePresence mode="popLayout">
      {newPassword && confirmNewPassword && (
        <motion.div
          key={match ? "match" : "mismatch"}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0, transition: { duration: 0.1 } }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          className={match ? "text-green-500" : "text-red-500"}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {match ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            )}
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const pwMatch = newPassword === confirmNewPassword;

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? "bg-slate-950" : "bg-gray-50"}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md p-8 rounded-3xl shadow-xl border ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"}`}
      >
        <div className="text-center mb-6">
          <img src={logo} alt="Logo" className="w-14 h-14 mx-auto mb-3" />
          <h2
            className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}
          >
            Set New Password
          </h2>
          <p
            className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
          >
            Enter your new password below
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className={`block text-sm font-bold mb-1.5 ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}
            >
              New Password
            </label>
            <div className="relative">
              <input
                type={showResetPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={() => setIsNewPwFocused(true)}
                onBlur={() => setIsNewPwFocused(false)}
                required
                minLength={8}
                className={`w-full border rounded-xl px-4 py-3 pr-20 outline-none transition-all font-medium ${isDarkMode ? "bg-slate-800 border-slate-600 text-white focus:border-green-500" : "bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"}`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowResetPw(!showResetPw)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors z-10 ${isDarkMode ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600"}`}
              >
                {showResetPw ? <EyeClosed /> : <EyeOpen />}
              </button>
              <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                <MatchIcon match={pwMatch} />
              </div>
            </div>
            <PasswordStrengthMeter
              password={newPassword}
              isVisible={isNewPwFocused}
              isDark={isDarkMode}
            />
          </div>
          <div>
            <label
              className={`block text-sm font-bold mb-1.5 ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}
            >
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showResetPw ? "text" : "password"}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={8}
                className={`w-full border rounded-xl px-4 py-3 pr-20 outline-none transition-all font-medium ${isDarkMode ? "bg-slate-800 border-slate-600 text-white focus:border-green-500" : "bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"}`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowResetPw(!showResetPw)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors z-10 ${isDarkMode ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600"}`}
              >
                {showResetPw ? <EyeClosed /> : <EyeOpen />}
              </button>
              <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                <MatchIcon match={pwMatch} />
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={resettingPw}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-full shadow-lg transition-all disabled:opacity-50"
          >
            {resettingPw ? "Updating..." : "Update Password"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
