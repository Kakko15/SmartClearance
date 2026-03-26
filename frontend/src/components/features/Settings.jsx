import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import PasswordInput from "../ui/PasswordInput";
import PasswordStrengthMeter from "../ui/PasswordStrengthMeter";
import {
  UserCircleIcon,
  ShieldCheckIcon,
  BellAlertIcon,
  XMarkIcon,
} from "../ui/Icons";
import AvatarManager from "./AvatarManager";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function Settings({
  user,
  profile,
  onClose,
  theme,
  onAvatarUpdate,
}) {
  const { skipNextValidationRef } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  const [loading, setLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isNewPasswordFocused, setIsNewPasswordFocused] = useState(false);

  const [clearanceNotifs, setClearanceNotifs] = useState(
    profile?.preferences?.clearance ?? true,
  );
  const [announcementNotifs, setAnnouncementNotifs] = useState(
    profile?.preferences?.announcement ?? true,
  );
  const [commentNotifs, setCommentNotifs] = useState(
    profile?.preferences?.comment ?? true,
  );
  const [emailDelivery, setEmailDelivery] = useState(
    profile?.preferences?.emailDelivery ?? true,
  );

  const has2FA = !!profile?.totp_enabled;
  const lastSignIn = user?.last_sign_in_at;

  // Reset authenticator state
  const [resetStep, setResetStep] = useState(null); // null | "password" | "scan" | "verify"
  const [resetPassword, setResetPassword] = useState("");
  const [resetQrCode, setResetQrCode] = useState(null);
  const [resetManualKey, setResetManualKey] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetKey, setShowResetKey] = useState(false);
  const [resetCopied, setResetCopied] = useState(false);
  const resetInputRefs = useRef([]);

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers = { "Content-Type": "application/json" };
    if (session?.access_token)
      headers["Authorization"] = `Bearer ${session.access_token}`;
    return headers;
  };

  const handleResetStart = async () => {
    if (!resetPassword) {
      toast.error("Enter your password");
      return;
    }
    setResetLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/auth/2fa/reset-setup`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          password: resetPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResetQrCode(data.qrCode);
        setResetManualKey(data.manualKey);
        setResetStep("scan");
        setResetPassword("");
      } else {
        toast.error(
          data.error ||
            (has2FA
              ? "Failed to reset authenticator"
              : "Failed to set up authenticator"),
        );
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetVerify = async () => {
    if (resetCode.replace(/\D/g, "").length !== 6) {
      toast.error("Enter a 6-digit code");
      return;
    }
    setResetLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/auth/2fa/verify-reset`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: user.id,
          token: resetCode.replace(/\D/g, ""),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          has2FA
            ? "Authenticator reset successfully"
            : "2FA enabled successfully",
        );
        setResetStep(null);
        setResetCode("");
        setResetQrCode(null);
        setResetManualKey("");
        // Optimistically update the UI to show 2FA is enabled without refreshing
        if (!has2FA) {
          profile.totp_enabled = true;
        }
      } else {
        toast.error(data.error || "Invalid code");
        setResetCode("");
        resetInputRefs.current[0]?.focus();
      }
    } catch {
      toast.error("Verification failed");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digits = resetCode.split("");
    while (digits.length < 6) digits.push("");
    digits[index] = value.slice(-1);
    const newCode = digits.join("");
    setResetCode(newCode);
    if (value && index < 5) resetInputRefs.current[index + 1]?.focus();
  };

  const handleResetKeyDown = (index, e) => {
    if (e.key === "Backspace" && !resetCode[index] && index > 0)
      resetInputRefs.current[index - 1]?.focus();
  };

  const handleResetPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    setResetCode(pasted);
    resetInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const isPasswordMeetsRequirements = (pwd) => {
    return (
      pwd.length >= 8 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /\d/.test(pwd) &&
      /[^A-Za-z0-9]/.test(pwd)
    );
  };

  const isNewPasswordValid = newPassword
    ? isPasswordMeetsRequirements(newPassword)
    : false;

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!isPasswordMeetsRequirements(newPassword)) {
      toast.error("New password does not meet security requirements");
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        toast.error("Current password is incorrect");
        setLoading(false);
        return;
      }
      skipNextValidationRef.current = true;
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (_error) {
      toast.error("Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const handleNotifToggle = async (key, setter, state, name) => {
    const newState = !state;
    setter(newState);

    try {
      const currentPreferences = profile?.preferences || {};
      const newPreferences = { ...currentPreferences, [key]: newState };

      const { error } = await supabase
        .from("profiles")
        .update({ preferences: newPreferences })
        .eq("id", user.id);

      if (error) throw error;

      if (profile) {
        profile.preferences = newPreferences;
      }

      toast.success(
        `${name} notifications ${newState ? "enabled" : "disabled"}`,
      );
    } catch (err) {
      console.error("Failed to update preferences:", err);
      setter(state);
      toast.error(`Failed to update ${name} notifications. Please try again.`);
    }
  };

  const tabs = [
    {
      id: "account",
      label: "Account Info",
      icon: <UserCircleIcon className="w-[22px] h-[22px]" />,
    },
    {
      id: "security",
      label: "Security",
      icon: <ShieldCheckIcon className="w-[22px] h-[22px]" />,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <BellAlertIcon className="w-[22px] h-[22px]" />,
    },
  ];

  const isDark = theme === "dark";

  const bgMain = isDark ? "bg-[#171717]" : "bg-[#f8f9fa]";
  const bgSidebar = isDark ? "bg-[#202124]" : "bg-white";
  const bgSurface = isDark ? "bg-[#171717]" : "bg-[#f8f9fa]";
  const bgCard = isDark ? "bg-[#202124]" : "bg-white";
  const borderCard = isDark ? "border-[#5f6368]" : "border-[#dadce0]";
  const borderSubtle = isDark ? "border-[#5f6368]" : "border-[#dadce0]";

  const textPrimary = isDark ? "text-[#e3e3e3]" : "text-[#202124]";
  const textSecondary = isDark ? "text-[#9aa0a6]" : "text-[#5f6368]";

  const activeTabClass = isDark
    ? "bg-[#3c4043] text-[#e3e3e3]"
    : "bg-primary-100 text-primary-700";
  const inactiveTabClass = isDark
    ? "text-[#9aa0a6] hover:bg-[#303134]"
    : "text-[#5f6368] hover:bg-[#f1f3f4]";

  const inputClass = `w-full px-4 py-3 bg-transparent border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent ${
    isDark
      ? "border-[#5f6368] text-[#e3e3e3] placeholder-[#9aa0a6] hover:border-[#9aa0a6]"
      : "border-[#dadce0] text-[#202124] placeholder-[#5f6368] hover:border-[#5f6368]"
  }`;

  const btnPrimary =
    "px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-full font-medium tracking-wide transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";

  const renderSwitch = (isChecked, onClick) => (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-[52px] h-[32px] rounded-full transition-colors relative flex items-center flex-shrink-0 border-[2px] cursor-pointer ${
        isChecked
          ? isDark
            ? "bg-primary-400 border-primary-400"
            : "bg-primary-600 border-primary-600"
          : isDark
            ? "border-[#9aa0a6] bg-transparent"
            : "border-[#5f6368] bg-transparent"
      }`}
    >
      <span
        className={`rounded-full transition-all duration-200 ease-out absolute ${
          isChecked
            ? "w-[24px] h-[24px] bg-white left-[22px]"
            : `w-[16px] h-[16px] ${isDark ? "bg-[#9aa0a6]" : "bg-[#5f6368]"} left-[4px]`
        }`}
      />
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98, translateY: 10 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        exit={{ opacity: 0, scale: 0.98, translateY: 10 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={`fixed inset-0 z-[100] flex flex-col md:flex-row shadow-[0_8px_40px_rgba(0,0,0,0.12)] ${bgMain} overflow-hidden`}
        style={{ fontFamily: '"Google Sans", "Roboto", sans-serif' }}
      >
        {}
        <div
          className={`w-full md:w-[280px] lg:w-[320px] flex-shrink-0 flex flex-col pt-10 pb-6 md:pb-10 border-b md:border-b-0 ${bgSidebar} z-10 transition-colors duration-300`}
        >
          <div className="px-6 mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl text-white shrink-0 overflow-hidden shadow-sm"
                style={{ backgroundColor: "var(--color-primary-600, #16a34a)" }}
              >
                {user?.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  profile?.full_name?.charAt(0) || "U"
                )}
              </motion.div>
              <div className="overflow-hidden">
                <h2
                  className={`text-[22px] font-normal tracking-tight truncate ${textPrimary} leading-tight`}
                >
                  Settings
                </h2>
                <p className={`text-[13px] truncate ${textSecondary} mt-0.5`}>
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`md:hidden p-2 rounded-full transition-colors ${inactiveTabClass}`}
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 px-3 space-y-1 overflow-y-auto w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-5 py-3 rounded-full transition-all flex items-center gap-4 text-[14px] font-medium tracking-wide ${
                  activeTab === tab.id ? activeTabClass : inactiveTabClass
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {}
        <div
          className={`flex-1 flex flex-col min-w-0 relative ${bgSurface} transition-colors duration-300`}
        >
          {}
          <div className="hidden md:flex h-[88px] w-full items-center justify-end px-8 shrink-0 absolute top-0 right-0 z-20 pointer-events-none">
            <button
              onClick={onClose}
              className={`p-3 rounded-full transition-all pointer-events-auto hover:bg-black/5 dark:hover:bg-white/10 ${textSecondary}`}
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-20 pt-8 md:pt-20 pb-24 scroll-smooth">
            <AnimatePresence mode="wait">
              {}
              {activeTab === "account" && (
                <motion.div
                  key="account"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  className="max-w-4xl mx-auto"
                >
                  <div className="text-center mb-10">
                    <h3
                      className={`text-[28px] md:text-[32px] font-normal mb-2 ${textPrimary}`}
                    >
                      Account Information
                    </h3>
                    <p className={`text-[15px] ${textSecondary}`}>
                      Manage your personal information and contact details
                    </p>
                  </div>

                  <AvatarManager
                    user={user}
                    profile={profile}
                    isDark={isDark}
                    onAvatarUpdate={onAvatarUpdate}
                  />

                  <div
                    className={`p-6 md:p-8 rounded-[24px] ${bgCard} border ${borderCard} mb-8 transition-colors duration-300`}
                  >
                    <h4
                      className={`text-[16px] font-medium mb-1 ${textPrimary}`}
                    >
                      Personal Information
                    </h4>
                    <p className={`text-[14px] mb-8 ${textSecondary}`}>
                      This information is managed by your institution
                    </p>
                    <div className="space-y-6">
                      <div>
                        <label
                          className={`block text-[13px] font-medium mb-1.5 ${textSecondary}`}
                        >
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={profile?.full_name || ""}
                          disabled
                          className={`${inputClass} opacity-70 cursor-not-allowed font-medium`}
                        />
                      </div>
                      <div>
                        <label
                          className={`block text-[13px] font-medium mb-1.5 ${textSecondary}`}
                        >
                          Email
                        </label>
                        <input
                          type="text"
                          value={user?.email || ""}
                          disabled
                          className={`${inputClass} opacity-70 cursor-not-allowed`}
                        />
                      </div>
                      <div>
                        <label
                          className={`block text-[13px] font-medium mb-1.5 ${textSecondary}`}
                        >
                          Role
                        </label>
                        <input
                          type="text"
                          value={
                            profile?.role?.replace("_", " ").toUpperCase() || ""
                          }
                          disabled
                          className={`${inputClass} opacity-70 cursor-not-allowed font-medium tracking-wide`}
                        />
                      </div>
                      {profile?.student_number && (
                        <div>
                          <label
                            className={`block text-[13px] font-medium mb-1.5 ${textSecondary}`}
                          >
                            Student Number
                          </label>
                          <input
                            type="text"
                            value={profile.student_number}
                            disabled
                            className={`${inputClass} opacity-70 cursor-not-allowed uppercase font-medium tracking-wide`}
                          />
                        </div>
                      )}
                      {profile?.course && (
                        <div>
                          <label
                            className={`block text-[13px] font-medium mb-1.5 ${textSecondary}`}
                          >
                            Course & Year
                          </label>
                          <input
                            type="text"
                            value={`${profile.course}${profile.year_level ? ` - ${profile.year_level}` : ""}`}
                            disabled
                            className={`${inputClass} opacity-70 cursor-not-allowed font-medium`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {}
              {activeTab === "security" && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  className="max-w-4xl mx-auto"
                >
                  <div className="text-center mb-10">
                    <h3
                      className={`text-[28px] md:text-[32px] font-normal mb-2 ${textPrimary}`}
                    >
                      Security
                    </h3>
                    <p className={`text-[15px] ${textSecondary}`}>
                      Settings and recommendations to help you keep your account
                      secure
                    </p>
                  </div>

                  <div
                    className={`p-6 md:p-8 rounded-[24px] ${bgCard} border ${borderCard} mb-8 transition-colors duration-300`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4
                          className={`text-[18px] font-medium mb-1 ${textPrimary}`}
                        >
                          Two-Factor Authentication
                        </h4>
                        <p className={`text-[14px] ${textSecondary}`}>
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      <span
                        className={`px-4 py-1.5 rounded-full text-[13px] font-medium tracking-wide inline-flex items-center justify-center whitespace-nowrap ${has2FA ? (isDark ? "bg-[#0F5223] text-[#93D7A4]" : "bg-[#e6f4ea] text-[#137333]") : isDark ? "bg-[#504017] text-[#E0C070]" : "bg-[#fef7e0] text-[#b06000]"}`}
                      >
                        {has2FA ? "Enabled" : "Not Enabled"}
                      </span>
                    </div>

                    {has2FA && !resetStep && (
                      <div className={`mt-6 pt-6 border-t ${borderSubtle}`}>
                        <p className={`text-[14px] mb-4 ${textSecondary}`}>
                          Lost access to your authenticator app? Reset it to set
                          up a new one.
                        </p>
                        <button
                          onClick={() => setResetStep("password")}
                          className={`px-6 py-2.5 rounded-full text-[14px] font-medium border transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 ${isDark ? "border-[#5f6368] text-primary-400" : "border-[#dadce0] text-primary-700"}`}
                        >
                          Reset Authenticator
                        </button>
                      </div>
                    )}

                    {!has2FA && !resetStep && (
                      <div className={`mt-6 pt-6 border-t ${borderSubtle}`}>
                        <p className={`text-[14px] mb-4 ${textSecondary}`}>
                          Set up two-factor authentication to securely protect
                          your account.
                        </p>
                        <button
                          onClick={() => setResetStep("password")}
                          className={btnPrimary}
                        >
                          Enable 2FA
                        </button>
                      </div>
                    )}

                    {resetStep === "password" && (
                      <div className={`mt-6 pt-6 border-t ${borderSubtle}`}>
                        <p
                          className={`text-[15px] mb-5 font-medium ${textPrimary}`}
                        >
                          Confirm your password to {has2FA ? "reset" : "set up"}{" "}
                          your authenticator
                        </p>
                        <div className="flex gap-4 items-end">
                          <div className="flex-1">
                            <PasswordInput
                              label="Password"
                              value={resetPassword}
                              onChange={(e) => setResetPassword(e.target.value)}
                              isDark={isDark}
                            />
                          </div>
                          <button
                            onClick={handleResetStart}
                            disabled={resetLoading || !resetPassword}
                            className={`${btnPrimary} shrink-0 mb-px`}
                          >
                            {resetLoading ? "Verifying..." : "Continue"}
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setResetStep(null);
                            setResetPassword("");
                          }}
                          className={`mt-4 text-[14px] font-medium ${textSecondary} hover:text-primary-700 transition-colors`}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {resetStep === "scan" && resetQrCode && (
                      <div className={`mt-6 pt-6 border-t ${borderSubtle}`}>
                        <p
                          className={`text-[16px] mb-5 font-normal ${textPrimary}`}
                        >
                          Scan this QR code with your authenticator app
                        </p>
                        <div className="flex justify-center mb-6">
                          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
                            <img
                              src={resetQrCode}
                              alt="2FA QR Code"
                              className="w-48 h-48"
                            />
                          </div>
                        </div>
                        <div className="text-center mb-8">
                          <p
                            className={`text-[12px] font-semibold uppercase tracking-widest mb-3 ${textSecondary}`}
                          >
                            Or enter this key manually
                          </p>
                          <div
                            className={`inline-flex items-center gap-3 p-3 pl-5 rounded-lg border ${borderSubtle} ${isDark ? "bg-[#202124]" : "bg-[#f8f9fa]"}`}
                          >
                            <code
                              className={`text-[14px] font-mono select-none ${textPrimary}`}
                            >
                              {showResetKey
                                ? resetManualKey
                                : "•••• •••• •••• ••••"}
                            </code>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setShowResetKey((v) => !v)}
                                className={`p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${textSecondary}`}
                              >
                                <svg
                                  className="w-[18px] h-[18px]"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d={
                                      showResetKey
                                        ? "M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.72 11.72 0 01-4.168 4.477M6.343 6.343L3 3m3.343 3.343l2.829 2.829m4.243 4.243l2.829 2.829M6.343 6.343l11.314 11.314M14.121 14.121A3 3 0 009.879 9.879"
                                        : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                    }
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(resetManualKey);
                                  setResetCopied(true);
                                  toast.success("Key copied");
                                  setTimeout(() => setResetCopied(false), 2000);
                                }}
                                className={`p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${textSecondary}`}
                              >
                                {resetCopied ? (
                                  <svg
                                    className="w-[18px] h-[18px] text-green-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="w-[18px] h-[18px]"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => setResetStep("verify")}
                            className={btnPrimary}
                          >
                            I've scanned it
                          </button>
                          <button
                            onClick={() => {
                              setResetStep(null);
                              setResetQrCode(null);
                              setResetManualKey("");
                            }}
                            className={`text-[14px] font-medium ${textSecondary} hover:text-primary-700`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {resetStep === "verify" && (
                      <div className={`mt-6 pt-6 border-t ${borderSubtle}`}>
                        <p
                          className={`text-[16px] mb-5 font-normal ${textPrimary}`}
                        >
                          Enter the 6-digit code from your new authenticator
                        </p>
                        <div
                          className="flex justify-center gap-2 md:gap-3 mb-8"
                          onPaste={handleResetPaste}
                        >
                          {Array.from({ length: 6 }).map((_, i) => (
                            <input
                              key={i}
                              ref={(el) => (resetInputRefs.current[i] = el)}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              aria-label={`Digit ${i + 1} of 6`}
                              value={resetCode[i] || ""}
                              onChange={(e) =>
                                handleResetCodeChange(i, e.target.value)
                              }
                              onKeyDown={(e) => handleResetKeyDown(i, e)}
                              className={`w-[48px] h-[56px] md:w-[56px] md:h-[64px] text-center text-[24px] font-normal rounded-xl outline-none transition-all focus:ring-2 focus:ring-primary-600 ${isDark ? "bg-transparent text-[#e3e3e3] border border-[#5f6368]" : "bg-transparent text-[#202124] border border-[#dadce0]"}`}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={handleResetVerify}
                            disabled={
                              resetLoading ||
                              resetCode.replace(/\D/g, "").length !== 6
                            }
                            className={btnPrimary}
                          >
                            {resetLoading ? "Verifying..." : "Verify"}
                          </button>
                          <button
                            onClick={() => {
                              setResetStep("scan");
                              setResetCode("");
                            }}
                            className={`text-[14px] font-medium ${textSecondary} hover:text-primary-700`}
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {lastSignIn && (
                    <div
                      className={`p-6 md:p-8 rounded-[24px] ${bgCard} border ${borderCard} mb-8 transition-colors duration-300`}
                    >
                      <h4
                        className={`text-[16px] font-medium mb-1 ${textPrimary}`}
                      >
                        Recent security activity
                      </h4>
                      <div className="flex items-center gap-4 mt-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 shrink-0`}
                        >
                          <ShieldCheckIcon className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p
                            className={`text-[14px] font-medium ${textPrimary}`}
                          >
                            Sign-in
                          </p>
                          <p className={`text-[13px] ${textSecondary}`}>
                            {new Date(lastSignIn).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            at{" "}
                            {new Date(lastSignIn).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div
                    className={`p-6 md:p-8 rounded-[24px] ${bgCard} border ${borderCard} mb-8 transition-colors duration-300`}
                  >
                    <h4
                      className={`text-[18px] font-medium mb-1 ${textPrimary}`}
                    >
                      Password
                    </h4>
                    <p className={`text-[14px] mb-8 ${textSecondary}`}>
                      A secure password helps protect your account
                    </p>

                    <form onSubmit={handlePasswordChange} className="space-y-6">
                      <PasswordInput
                        label="Current Password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        isDark={isDark}
                      />
                      <div className="pt-2">
                        <PasswordInput
                          label="New Password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          onFocus={() => setIsNewPasswordFocused(true)}
                          onBlur={() => setIsNewPasswordFocused(false)}
                          required
                          minLength={8}
                          isDark={isDark}
                          status={
                            newPassword && confirmNewPassword
                              ? newPassword === confirmNewPassword
                                ? "success"
                                : "error"
                              : null
                          }
                        />
                        <div className="mt-3 px-1">
                          <PasswordStrengthMeter
                            password={newPassword}
                            isVisible={
                              isNewPasswordFocused || newPassword.length > 0
                            }
                            isDark={isDark}
                          />
                        </div>
                      </div>
                      <PasswordInput
                        label="Confirm New Password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        required
                        minLength={8}
                        isDark={isDark}
                        status={
                          newPassword && confirmNewPassword
                            ? newPassword === confirmNewPassword
                              ? "success"
                              : "error"
                            : null
                        }
                      />
                      <AnimatePresence>
                        {confirmNewPassword &&
                          newPassword !== confirmNewPassword && (
                            <motion.p
                              initial={{ opacity: 0, height: 0, y: -5 }}
                              animate={{ opacity: 1, height: "auto", y: 0 }}
                              exit={{ opacity: 0, height: 0, y: -5 }}
                              transition={{ duration: 0.2 }}
                              className={`text-[13px] font-medium px-2 ${isDark ? "text-[#F2B8B5]" : "text-[#d93025]"}`}
                            >
                              Passwords do not match
                            </motion.p>
                          )}
                      </AnimatePresence>
                      <div className="pt-4 flex justify-end">
                        <button
                          type="submit"
                          disabled={
                            loading ||
                            !currentPassword ||
                            !newPassword ||
                            newPassword !== confirmNewPassword ||
                            !isNewPasswordValid
                          }
                          className={btnPrimary}
                        >
                          {loading ? "Updating..." : "Change password"}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}

              {}
              {activeTab === "notifications" && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  className="max-w-4xl mx-auto"
                >
                  <div className="text-center mb-10">
                    <h3
                      className={`text-[28px] md:text-[32px] font-normal mb-2 ${textPrimary}`}
                    >
                      Notifications
                    </h3>
                    <p className={`text-[15px] ${textSecondary}`}>
                      Manage your alerts and communication preferences
                    </p>
                  </div>

                  <div
                    className={`p-0 sm:p-2 rounded-[24px] ${bgCard} border ${borderCard} transition-colors duration-300 overflow-hidden`}
                  >
                    <div className="p-6 md:p-8">
                      <h4
                        className={`text-[18px] font-medium mb-1 ${textPrimary}`}
                      >
                        Notification Preferences
                      </h4>
                      <p className={`text-[14px] mb-8 ${textSecondary}`}>
                        Choose exactly what you want to be notified about
                      </p>

                      <div className="space-y-2">
                        <div
                          className={`flex items-center justify-between p-4 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer`}
                          onClick={() =>
                            handleNotifToggle(
                              "clearance",
                              setClearanceNotifs,
                              clearanceNotifs,
                              "Clearance",
                            )
                          }
                        >
                          <div className="pr-4">
                            <p
                              className={`text-[15px] font-medium ${textPrimary} mb-0.5`}
                            >
                              Clearance Status Updates
                            </p>
                            <p className={`text-[13px] ${textSecondary}`}>
                              When a clearance stage is approved or requires
                              immediate action
                            </p>
                          </div>
                          {renderSwitch(clearanceNotifs, () =>
                            handleNotifToggle(
                              "clearance",
                              setClearanceNotifs,
                              clearanceNotifs,
                              "Clearance",
                            ),
                          )}
                        </div>

                        <div
                          className={`h-px w-full ${borderSubtle} opacity-50 my-1 mx-4 max-w-[calc(100%-2rem)]`}
                        />

                        <div
                          className={`flex items-center justify-between p-4 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer`}
                          onClick={() =>
                            handleNotifToggle(
                              "announcement",
                              setAnnouncementNotifs,
                              announcementNotifs,
                              "Announcement",
                            )
                          }
                        >
                          <div className="pr-4">
                            <p
                              className={`text-[15px] font-medium ${textPrimary} mb-0.5`}
                            >
                              Announcements
                            </p>
                            <p className={`text-[13px] ${textSecondary}`}>
                              Important global updates directly from your school
                              administration
                            </p>
                          </div>
                          {renderSwitch(announcementNotifs, () =>
                            handleNotifToggle(
                              "announcement",
                              setAnnouncementNotifs,
                              announcementNotifs,
                              "Announcement",
                            ),
                          )}
                        </div>

                        <div
                          className={`h-px w-full ${borderSubtle} opacity-50 my-1 mx-4 max-w-[calc(100%-2rem)]`}
                        />

                        <div
                          className={`flex items-center justify-between p-4 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer`}
                          onClick={() =>
                            handleNotifToggle(
                              "comment",
                              setCommentNotifs,
                              commentNotifs,
                              "Comment",
                            )
                          }
                        >
                          <div className="pr-4">
                            <p
                              className={`text-[15px] font-medium ${textPrimary} mb-0.5`}
                            >
                              Comment Replies
                            </p>
                            <p className={`text-[13px] ${textSecondary}`}>
                              When an administrator or instructor replies to
                              your clearance comments
                            </p>
                          </div>
                          {renderSwitch(commentNotifs, () =>
                            handleNotifToggle(
                              "comment",
                              setCommentNotifs,
                              commentNotifs,
                              "Comment",
                            ),
                          )}
                        </div>

                        <div
                          className={`h-px w-full ${borderSubtle} opacity-50 my-1 mx-4 max-w-[calc(100%-2rem)]`}
                        />

                        <div
                          className={`flex items-center justify-between p-4 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer`}
                          onClick={() =>
                            handleNotifToggle(
                              "emailDelivery",
                              setEmailDelivery,
                              emailDelivery,
                              "Email delivery",
                            )
                          }
                        >
                          <div className="pr-4">
                            <p
                              className={`text-[15px] font-medium ${textPrimary} mb-0.5`}
                            >
                              Email Delivery
                            </p>
                            <p className={`text-[13px] ${textSecondary}`}>
                              Push unread notifications directly to your
                              registered email
                            </p>
                          </div>
                          {renderSwitch(emailDelivery, () =>
                            handleNotifToggle(
                              "emailDelivery",
                              setEmailDelivery,
                              emailDelivery,
                              "Email delivery",
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
