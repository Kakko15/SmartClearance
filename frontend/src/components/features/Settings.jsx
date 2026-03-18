import { useState, useEffect, useRef } from "react";
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
import ProfileEditForm from "./ProfileEditForm";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function Settings({ user, profile, onClose, theme, setTheme, onAvatarUpdate }) {
  const { skipNextValidationRef } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  const [loading, setLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [clearanceNotifs, setClearanceNotifs] = useState(true);
  const [announcementNotifs, setAnnouncementNotifs] = useState(true);
  const [commentNotifs, setCommentNotifs] = useState(true);
  const [emailDelivery, setEmailDelivery] = useState(true);

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
    const { data: { session } } = await supabase.auth.getSession();
    const headers = { "Content-Type": "application/json" };
    if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
    return headers;
  };

  const handleResetStart = async () => {
    if (!resetPassword) { toast.error("Enter your password"); return; }
    setResetLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/auth/2fa/reset-setup`, {
        method: "POST", headers,
        body: JSON.stringify({ userId: user.id, email: user.email, password: resetPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setResetQrCode(data.qrCode);
        setResetManualKey(data.manualKey);
        setResetStep("scan");
        setResetPassword("");
      } else {
        toast.error(data.error || "Failed to reset authenticator");
      }
    } catch { toast.error("Failed to connect to server"); }
    finally { setResetLoading(false); }
  };

  const handleResetVerify = async () => {
    if (resetCode.replace(/\D/g, "").length !== 6) { toast.error("Enter a 6-digit code"); return; }
    setResetLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/auth/2fa/verify-reset`, {
        method: "POST", headers,
        body: JSON.stringify({ userId: user.id, token: resetCode.replace(/\D/g, "") }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Authenticator reset successfully");
        setResetStep(null);
        setResetCode("");
        setResetQrCode(null);
        setResetManualKey("");
      } else {
        toast.error(data.error || "Invalid code");
        setResetCode("");
        resetInputRefs.current[0]?.focus();
      }
    } catch { toast.error("Verification failed"); }
    finally { setResetLoading(false); }
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
    if (e.key === "Backspace" && !resetCode[index] && index > 0) resetInputRefs.current[index - 1]?.focus();
  };

  const handleResetPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    setResetCode(pasted);
    resetInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // L5 FIX: Removed duplicate theme useEffect that conflicted with ThemeContext.
  // ThemeContext already handles document.documentElement.classList and localStorage.

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
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
      // L4 FIX: Skip the TOKEN_REFRESHED re-validation that updateUser triggers
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



  const handleNotifToggle = (setter, state, name) => {
    setter(!state);
    toast.success(`${name} notifications ${!state ? "enabled" : "disabled"}`);
  };

  const tabs = [
    { id: "account", label: "Account Info", icon: <UserCircleIcon className="w-5 h-5" /> },
    { id: "security", label: "Security", icon: <ShieldCheckIcon className="w-5 h-5" /> },
    { id: "notifications", label: "Notifications", icon: <BellAlertIcon className="w-5 h-5" /> },
  ];

  const isDark = theme === "dark";


  const bgMain = isDark ? "bg-[#202124]" : "bg-[#f8f9fa]";
  const bgCard = isDark ? "bg-[#303134] border-[#5f6368]" : "bg-white border-[#dadce0]";
  const textPrimary = isDark ? "text-[#e8eaed]" : "text-[#202124]";
  const textSecondary = isDark ? "text-[#9aa0a6]" : "text-[#5f6368]";
  const activeTabClass = isDark ? "bg-primary-900/30 text-primary-400" : "bg-primary-50 text-primary-600";
  const inactiveTabClass = isDark ? "text-[#e8eaed] hover:bg-[#3c4043]" : "text-[#3c4043] hover:bg-[#f1f3f4]";
  
  const inputClass = `w-full px-4 py-3 bg-transparent border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 ${
    isDark
      ? "border-[#5f6368] text-[#e8eaed] placeholder-[#9aa0a6] hover:border-[#9aa0a6]"
      : "border-[#dadce0] text-[#202124] placeholder-[#5f6368] hover:border-[#80868b]"
  }`;

  const btnPrimary = "px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.98 }}
        transition={{ type: "spring", bounce: 0, duration: 0.5 }}
        className={`fixed inset-0 z-[100] flex flex-col md:flex-row overflow-hidden shadow-2xl ${bgMain}`}
        style={{ fontFamily: 'Google Sans, sans-serif' }}
      >

          <div className={`w-full md:w-[320px] lg:w-[360px] flex-shrink-0 flex flex-col py-6 md:py-10 border-b md:border-b-0 md:border-r z-10 ${isDark ? 'border-[#3c4043] bg-[#202124]' : 'border-[#dadce0] bg-[#f8f9fa]'}`}>
            <div className="px-6 md:px-10 mb-6 md:mb-12 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary-600 flex items-center justify-center font-bold text-2xl text-white shadow-sm shrink-0 overflow-hidden">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profile?.full_name?.charAt(0) || "U"
                  )}
                </div>
                <div className="overflow-hidden">
                  <h2 className={`text-[22px] font-medium tracking-tight truncate ${textPrimary}`}>Manage Account</h2>
                  <p className={`text-[14px] truncate ${textSecondary}`}>{user?.email}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`md:hidden p-2 rounded-full transition-colors ${isDark ? 'hover:bg-[#3c4043] text-[#9aa0a6]' : 'hover:bg-[#e8eaed] text-[#5f6368]'}`}
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <nav className="flex-1 px-4 md:px-6 space-y-1.5 overflow-y-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-5 py-3.5 rounded-full transition-all flex items-center gap-4 text-[15px] font-medium ${
                    activeTab === tab.id ? activeTabClass : inactiveTabClass
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>


          <div className={`flex-1 flex flex-col min-w-0 relative ${isDark ? 'bg-[#202124]' : 'bg-white'}`}>
             <div className="hidden md:flex h-[88px] w-full items-center justify-end px-8 shrink-0 absolute top-0 right-0 z-20 pointer-events-none">
              <button
                onClick={onClose}
                className={`p-3 rounded-full transition-colors pointer-events-auto ${isDark ? 'hover:bg-[#3c4043] text-[#9aa0a6] bg-[#202124]' : 'hover:bg-[#f1f3f4] text-[#5f6368] bg-white'}`}
              >
                <XMarkIcon className="w-7 h-7" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 md:px-16 lg:px-24 pt-8 md:pt-28 pb-24">
              <AnimatePresence mode="wait">
                
                {activeTab === "account" && (
                  <motion.div
                    key="account"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    className="max-w-3xl mx-auto"
                  >
                    <h3 className={`text-[28px] font-normal mb-8 ${textPrimary}`}>Account Information</h3>
                    
                    <AvatarManager user={user} profile={profile} isDark={isDark} onAvatarUpdate={onAvatarUpdate} />

                    <div className={`p-6 rounded-2xl border ${bgCard} mb-8`}>
                      <h4 className={`text-lg font-medium mb-1 ${textPrimary}`}>Personal Information</h4>
                      <p className={`text-sm mb-6 ${textSecondary}`}>This information is managed by your institution</p>
                      <div className="space-y-5">
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>Full Name</label>
                          <input type="text" value={profile?.full_name || ""} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>Email</label>
                          <input type="text" value={user?.email || ""} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>Role</label>
                          <input type="text" value={profile?.role?.replace("_", " ").toUpperCase() || ""} disabled className={`${inputClass} opacity-60 cursor-not-allowed uppercase`} />
                        </div>
                        {profile?.student_number && (
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>Student Number</label>
                            <input type="text" value={profile.student_number} disabled className={`${inputClass} opacity-60 cursor-not-allowed uppercase`} />
                          </div>
                        )}
                        {profile?.course && (
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>Course & Year</label>
                            <input type="text" value={`${profile.course}${profile.year_level ? ` - ${profile.year_level}` : ""}`} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-2">
                      <h4 className={`text-[22px] font-normal mb-1 ${textPrimary}`}>Request Profile Change</h4>
                      <p className={`text-sm mb-6 ${textSecondary}`}>Submit a request to update your profile information</p>
                      <ProfileEditForm profile={profile} isDarkMode={isDark} />
                    </div>

                  </motion.div>
                )}

                {activeTab === "security" && (
                  <motion.div
                    key="security"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    className="max-w-3xl mx-auto"
                  >
                    <h3 className={`text-[28px] font-normal mb-8 ${textPrimary}`}>Security</h3>

                    <div className={`p-6 rounded-2xl border ${bgCard} mb-8`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className={`text-lg font-medium mb-1 ${textPrimary}`}>Two-Factor Authentication</h4>
                          <p className={`text-sm ${textSecondary}`}>Add an extra layer of security to your account</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${has2FA ? (isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700') : (isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-50 text-yellow-700')}`}>
                          {has2FA ? "Enabled" : "Not enabled"}
                        </span>
                      </div>

                      {has2FA && !resetStep && (
                        <div className="mt-4 pt-4 border-t border-inherit">
                          <p className={`text-sm mb-3 ${textSecondary}`}>Lost access to your authenticator app? Reset it to set up a new one.</p>
                          <button onClick={() => setResetStep("password")} className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors ${isDark ? 'border-[#5f6368] text-[#e8eaed] hover:bg-[#3c4043]' : 'border-[#dadce0] text-[#3c4043] hover:bg-[#f1f3f4]'}`}>
                            Reset Authenticator
                          </button>
                        </div>
                      )}

                      {resetStep === "password" && (
                        <div className="mt-4 pt-4 border-t border-inherit">
                          <p className={`text-sm mb-4 ${textSecondary}`}>Confirm your password to reset your authenticator</p>
                          <div className="flex gap-3 items-end">
                            <div className="flex-1">
                              <PasswordInput label="Password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} isDark={isDark} />
                            </div>
                            <button onClick={handleResetStart} disabled={resetLoading || !resetPassword} className={`${btnPrimary} shrink-0 mb-px`}>
                              {resetLoading ? "Verifying..." : "Continue"}
                            </button>
                          </div>
                          <button onClick={() => { setResetStep(null); setResetPassword(""); }} className={`mt-3 text-sm ${textSecondary} hover:underline`}>Cancel</button>
                        </div>
                      )}

                      {resetStep === "scan" && resetQrCode && (
                        <div className="mt-4 pt-4 border-t border-inherit">
                          <p className={`text-sm mb-4 font-medium ${textPrimary}`}>Scan this QR code with your authenticator app</p>
                          <div className="flex justify-center mb-4">
                            <div className="bg-white p-3 rounded-xl shadow-sm">
                              <img src={resetQrCode} alt="2FA QR Code" className="w-48 h-48" />
                            </div>
                          </div>
                          <div className="text-center mb-4">
                            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${textSecondary}`}>Or enter this key manually</p>
                            <div className={`inline-flex items-center gap-2 p-3 rounded-xl ${isDark ? 'bg-[#202124] border border-[#5f6368]' : 'bg-[#f8f9fa] border border-[#dadce0]'}`}>
                              <code className={`text-sm font-mono font-bold tracking-wider select-none ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                {showResetKey ? resetManualKey : "••••  ••••  ••••  ••••"}
                              </code>
                              <button type="button" onClick={() => setShowResetKey(v => !v)} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-[#3c4043] text-[#9aa0a6]' : 'hover:bg-[#e8eaed] text-[#5f6368]'}`}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showResetKey ? "M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.72 11.72 0 01-4.168 4.477M6.343 6.343L3 3m3.343 3.343l2.829 2.829m4.243 4.243l2.829 2.829M6.343 6.343l11.314 11.314M14.121 14.121A3 3 0 009.879 9.879" : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                              </button>
                              <button type="button" onClick={() => { navigator.clipboard.writeText(resetManualKey); setResetCopied(true); toast.success("Key copied"); setTimeout(() => setResetCopied(false), 2000); }} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-[#3c4043] text-[#9aa0a6]' : 'hover:bg-[#e8eaed] text-[#5f6368]'}`}>
                                {resetCopied ? <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                              </button>
                            </div>
                          </div>
                          <button onClick={() => setResetStep("verify")} className={btnPrimary}>I've scanned it</button>
                          <button onClick={() => { setResetStep(null); setResetQrCode(null); setResetManualKey(""); }} className={`ml-3 text-sm ${textSecondary} hover:underline`}>Cancel</button>
                        </div>
                      )}

                      {resetStep === "verify" && (
                        <div className="mt-4 pt-4 border-t border-inherit">
                          <p className={`text-sm mb-4 font-medium ${textPrimary}`}>Enter the 6-digit code from your new authenticator</p>
                          <div className="flex justify-center gap-2 mb-4" onPaste={handleResetPaste}>
                            {Array.from({ length: 6 }).map((_, i) => (
                              <input
                                key={i}
                                ref={(el) => (resetInputRefs.current[i] = el)}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                aria-label={`Digit ${i + 1} of 6`}
                                value={resetCode[i] || ""}
                                onChange={(e) => handleResetCodeChange(i, e.target.value)}
                                onKeyDown={(e) => handleResetKeyDown(i, e)}
                                className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all ${isDark ? 'bg-[#202124] border-[#5f6368] text-[#e8eaed] focus:border-green-500' : 'bg-white border-[#dadce0] text-[#202124] focus:border-green-500 focus:ring-1 focus:ring-green-500'}`}
                              />
                            ))}
                          </div>
                          <button onClick={handleResetVerify} disabled={resetLoading || resetCode.replace(/\D/g, "").length !== 6} className={btnPrimary}>
                            {resetLoading ? "Verifying..." : "Verify & Reset"}
                          </button>
                          <button onClick={() => { setResetStep("scan"); setResetCode(""); }} className={`ml-3 text-sm ${textSecondary} hover:underline`}>Back</button>
                        </div>
                      )}
                    </div>

                    {lastSignIn && (
                      <div className={`p-6 rounded-2xl border ${bgCard} mb-8`}>
                        <h4 className={`text-lg font-medium mb-1 ${textPrimary}`}>Last Sign-in</h4>
                        <p className={`text-sm ${textSecondary}`}>
                          {new Date(lastSignIn).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at {new Date(lastSignIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    )}
                    
                    <div className={`p-6 rounded-2xl border ${bgCard} mb-8`}>
                       <h4 className={`text-lg font-medium mb-1 ${textPrimary}`}>Change Password</h4>
                       <p className={`text-sm mb-6 ${textSecondary}`}>Use a strong password that you don't use elsewhere</p>
                      
                       <form onSubmit={handlePasswordChange} className="space-y-5">
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
                            required
                            minLength={8}
                            isDark={isDark}
                          />
                          <div className="mt-2">
                            <PasswordStrengthMeter password={newPassword} isDark={isDark} />
                          </div>
                        </div>
                        <PasswordInput
                          label="Confirm New Password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          required
                          minLength={8}
                          isDark={isDark}
                        />
                        {confirmNewPassword && newPassword !== confirmNewPassword && (
                           <p className="text-sm text-red-500">Passwords do not match</p>
                        )}
                        <div className="pt-2 flex justify-end">
                          <button
                            type="submit"
                            disabled={loading || !currentPassword || !newPassword || newPassword !== confirmNewPassword}
                            className={btnPrimary}
                          >
                            {loading ? "Updating..." : "Update password"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                )}

                {activeTab === "notifications" && (
                   <motion.div
                    key="notifications"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    className="max-w-3xl mx-auto"
                  >
                     <h3 className={`text-[28px] font-normal mb-8 ${textPrimary}`}>Notifications</h3>
                     <div className={`p-6 rounded-2xl border ${bgCard}`}>
                      <h4 className={`text-lg font-medium mb-1 ${textPrimary}`}>Notification Preferences</h4>
                      <p className={`text-sm mb-6 ${textSecondary}`}>Choose what you get notified about</p>

                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium ${textPrimary}`}>Clearance Status Updates</p>
                            <p className={`text-sm ${textSecondary}`}>When a clearance stage is approved or requires action</p>
                          </div>
                          <button
                            onClick={() => handleNotifToggle(setClearanceNotifs, clearanceNotifs, "Clearance")}
                            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${clearanceNotifs ? (isDark ? 'bg-primary-400' : 'bg-primary-600') : (isDark ? 'bg-[#5f6368]' : 'bg-[#dadce0]')}`}
                          >
                            <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${clearanceNotifs ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className={`h-px w-full ${isDark ? 'bg-[#3c4043]' : 'bg-[#dadce0]'}`} />
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium ${textPrimary}`}>Announcements</p>
                            <p className={`text-sm ${textSecondary}`}>Important updates from your school administration</p>
                          </div>
                          <button
                            onClick={() => handleNotifToggle(setAnnouncementNotifs, announcementNotifs, "Announcement")}
                            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${announcementNotifs ? (isDark ? 'bg-primary-400' : 'bg-primary-600') : (isDark ? 'bg-[#5f6368]' : 'bg-[#dadce0]')}`}
                          >
                            <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${announcementNotifs ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className={`h-px w-full ${isDark ? 'bg-[#3c4043]' : 'bg-[#dadce0]'}`} />
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium ${textPrimary}`}>Comment Replies</p>
                            <p className={`text-sm ${textSecondary}`}>When someone replies to your clearance comments</p>
                          </div>
                          <button
                            onClick={() => handleNotifToggle(setCommentNotifs, commentNotifs, "Comment")}
                            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${commentNotifs ? (isDark ? 'bg-primary-400' : 'bg-primary-600') : (isDark ? 'bg-[#5f6368]' : 'bg-[#dadce0]')}`}
                          >
                            <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${commentNotifs ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className={`h-px w-full ${isDark ? 'bg-[#3c4043]' : 'bg-[#dadce0]'}`} />
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium ${textPrimary}`}>Email Delivery</p>
                            <p className={`text-sm ${textSecondary}`}>Also send notifications to your email</p>
                          </div>
                          <button
                            onClick={() => handleNotifToggle(setEmailDelivery, emailDelivery, "Email delivery")}
                            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${emailDelivery ? (isDark ? 'bg-primary-400' : 'bg-primary-600') : (isDark ? 'bg-[#5f6368]' : 'bg-[#dadce0]')}`}
                          >
                            <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${emailDelivery ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                          </button>
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
