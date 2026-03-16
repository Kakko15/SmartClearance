import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import PasswordInput from "../ui/PasswordInput";
import PasswordStrengthMeter from "../ui/PasswordStrengthMeter";
import {
  UserCircleIcon,
  ShieldCheckIcon,
  PaintBrushIcon,
  BellAlertIcon,
  XMarkIcon,
  MoonIcon,
  SunIcon,
  ComputerDesktopIcon
} from "../ui/Icons";
import AvatarManager from "./AvatarManager";
import ProfileEditForm from "./ProfileEditForm";

export default function Settings({ user, profile, onClose, theme, setTheme, mode = "full" }) {
  const [activeTab, setActiveTab] = useState(mode === "account" ? "account" : "account");
  const [loading, setLoading] = useState(false);


  const [fullName, setFullName] = useState(profile?.full_name || "");



  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);


  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);
  const [marketingNotifs, setMarketingNotifs] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    toast.success(`Switched to ${newTheme} mode`);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
    } catch (_error) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

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

  const allTabs = [
    { id: "account", label: "Account Info", icon: <UserCircleIcon className="w-5 h-5" /> },
    { id: "editProfile", label: "Edit Profile", icon: <UserCircleIcon className="w-5 h-5" /> },
    { id: "security", label: "Security", icon: <ShieldCheckIcon className="w-5 h-5" /> },
    { id: "appearance", label: "Appearance", icon: <PaintBrushIcon className="w-5 h-5" /> },
    { id: "notifications", label: "Notifications", icon: <BellAlertIcon className="w-5 h-5" /> },
  ];

  const accountOnlyTabIds = ["account", "editProfile", "security"];
  const tabs = mode === "account" ? allTabs.filter(t => accountOnlyTabIds.includes(t.id)) : allTabs;

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
                  <h2 className={`text-[22px] font-medium tracking-tight truncate ${textPrimary}`}>{mode === "account" ? "Manage Account" : "Settings"}</h2>
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
                    
                    <AvatarManager user={user} profile={profile} isDark={isDark} />

                    <div className={`p-6 rounded-2xl border ${bgCard} mb-8`}>
                      <form onSubmit={handleUpdateProfile} className="space-y-6">
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>Full Name</label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>Role</label>
                          <input
                            type="text"
                            value={profile?.role?.replace("_", " ").toUpperCase() || ""}
                            disabled
                            className={`${inputClass} opacity-60 cursor-not-allowed uppercase`}
                          />
                        </div>
                         {profile?.student_number && (
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>Student Number</label>
                            <input
                              type="text"
                              value={profile.student_number}
                              disabled
                              className={`${inputClass} opacity-60 cursor-not-allowed`}
                            />
                          </div>
                        )}
                        <div className="pt-2 flex justify-end">
                          <button type="submit" disabled={loading || fullName === profile?.full_name} className={btnPrimary}>
                            {loading ? "Saving..." : "Save changes"}
                          </button>
                        </div>
                      </form>
                    </div>


                  </motion.div>
                )}

                {activeTab === "editProfile" && (
                  <motion.div
                    key="editProfile"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    className="max-w-3xl mx-auto"
                  >
                    <h3 className={`text-[28px] font-normal mb-2 ${textPrimary}`}>Edit Profile</h3>
                    <p className={`text-sm mb-8 ${textSecondary}`}>Request changes to your profile information</p>
                    <ProfileEditForm profile={profile} isDarkMode={isDark} />
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
                    <h3 className={`text-[28px] font-normal mb-8 ${textPrimary}`}>Security settings</h3>
                    
                    <div className={`p-6 rounded-2xl border ${bgCard} mb-8`}>
                       <h4 className={`text-lg font-medium mb-1 ${textPrimary}`}>Change Password</h4>
                       <p className={`text-sm mb-6 ${textSecondary}`}>Ensure your account is using a long, random password to stay secure.</p>
                      
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

                    <div className={`p-6 rounded-2xl border border-red-200 ${isDark ? 'bg-[#45272a] border-red-900/50' : 'bg-red-50/50'}`}>
                      <h4 className={`text-lg font-medium mb-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>Danger Zone</h4>
                      <p className={`text-sm mb-4 ${isDark ? 'text-red-300' : 'text-red-700'}`}>Once you delete your account, there is no going back. Please be certain.</p>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className={`px-6 py-2 rounded-full font-medium border transition-colors ${isDark ? 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white' : 'border-red-600 text-red-600 hover:bg-red-600 hover:text-white'}`}
                      >
                        Delete account
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeTab === "appearance" && (
                  <motion.div
                    key="appearance"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    className="max-w-3xl mx-auto"
                  >
                    <h3 className={`text-[28px] font-normal mb-8 ${textPrimary}`}>Appearance</h3>
                    <div className={`p-6 rounded-2xl border ${bgCard}`}>
                      <h4 className={`text-lg font-medium mb-1 ${textPrimary}`}>Theme preferences</h4>
                      <p className={`text-sm mb-6 ${textSecondary}`}>Select how you want SmartClearance to normally look.</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          onClick={() => handleThemeChange("light")}
                          className={`relative flex flex-col outline-none items-center p-6 rounded-2xl border-2 transition-all ${
                            theme === "light"
                                ? "border-primary-600 bg-primary-50 bg-opacity-30"
                                : isDark ? "border-[#5f6368] hover:border-[#9aa0a6]" : "border-[#dadce0] hover:border-[#bdc1c6]"
                          }`}
                        >
                           <SunIcon className={`w-8 h-8 mb-3 ${theme === "light" ? "text-primary-600" : textSecondary}`} />
                           <span className={`font-medium ${theme === "light" ? "text-primary-600" : textPrimary}`}>Light theme</span>
                        </button>
                        <button
                          onClick={() => handleThemeChange("dark")}
                          className={`relative flex flex-col outline-none items-center p-6 rounded-2xl border-2 transition-all ${
                            theme === "dark"
                                ? "border-primary-400 bg-primary-900/30"
                                : isDark ? "border-[#5f6368] hover:border-[#9aa0a6]" : "border-[#dadce0] hover:border-[#bdc1c6]"
                          }`}
                        >
                           <MoonIcon className={`w-8 h-8 mb-3 ${theme === "dark" ? "text-primary-400" : textSecondary}`} />
                           <span className={`font-medium ${theme === "dark" ? "text-primary-400" : textPrimary}`}>Dark theme</span>
                        </button>
                      </div>
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
                      <h4 className={`text-lg font-medium mb-1 ${textPrimary}`}>Communication Preferences</h4>
                      <p className={`text-sm mb-6 ${textSecondary}`}>Choose how we notify you about your clearance status.</p>

                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium ${textPrimary}`}>Email Notifications</p>
                            <p className={`text-sm ${textSecondary}`}>Receive alerts when clearance stages update.</p>
                          </div>
                          <button
                            onClick={() => handleNotifToggle(setEmailNotifs, emailNotifs, "Email")}
                            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${emailNotifs ? (isDark ? 'bg-primary-400' : 'bg-primary-600') : (isDark ? 'bg-[#5f6368]' : 'bg-[#dadce0]')}`}
                          >
                            <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${emailNotifs ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className="h-px w-full bg-[#dadce0] dark:bg-[#3c4043]" />
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium ${textPrimary}`}>SMS Notifications (Premium)</p>
                            <p className={`text-sm ${textSecondary}`}>Instant mobile updates for critical stage changes.</p>
                          </div>
                          <button
                            onClick={() => handleNotifToggle(setSmsNotifs, smsNotifs, "SMS")}
                            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${smsNotifs ? (isDark ? 'bg-primary-400' : 'bg-primary-600') : (isDark ? 'bg-[#5f6368]' : 'bg-[#dadce0]')}`}
                          >
                            <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${smsNotifs ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className="h-px w-full bg-[#dadce0] dark:bg-[#3c4043]" />
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium ${textPrimary}`}>Marketing & Surveys</p>
                            <p className={`text-sm ${textSecondary}`}>Occasional emails about platform improvements.</p>
                          </div>
                          <button
                            onClick={() => handleNotifToggle(setMarketingNotifs, marketingNotifs, "Marketing")}
                            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${marketingNotifs ? (isDark ? 'bg-primary-400' : 'bg-primary-600') : (isDark ? 'bg-[#5f6368]' : 'bg-[#dadce0]')}`}
                          >
                            <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${marketingNotifs ? 'translate-x-[20px]' : 'translate-x-0'}`} />
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


      {showDeleteModal && (
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
         >
           <motion.div
             initial={{ scale: 0.9, y: 20 }}
             animate={{ scale: 1, y: 0 }}
             className={`max-w-md w-full rounded-[24px] p-6 shadow-2xl ${isDark ? "bg-[#303134] border border-[#5f6368]" : "bg-white"}`}
             style={{ fontFamily: 'Google Sans, sans-serif' }}
           >
             <h3 className={`text-[22px] font-normal mb-3 ${isDark ? "text-[#e8eaed]" : "text-[#202124]"}`}>
               Contact Administrator
             </h3>
             <p className={`text-sm mb-6 leading-relaxed ${isDark ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
               Due to institutional security policies, account deletion must be requested directly through your IT administrator. Data retention requires manual clearance protocol.
             </p>
             <div className="flex justify-end pr-2">
               <button
                 onClick={() => setShowDeleteModal(false)}
                 className={`px-5 py-2 rounded-full font-medium transition-colors ${isDark ? 'hover:bg-[#3c4043] text-primary-400' : 'hover:bg-[#f1f3f4] text-primary-600'}`}
               >
                 Acknowledge
               </button>
             </div>
           </motion.div>
         </motion.div>
      )}
    </AnimatePresence>
  );
}
