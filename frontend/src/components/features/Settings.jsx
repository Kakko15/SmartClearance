import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import PasswordInput from "../ui/PasswordInput";
import PasswordStrengthMeter from "../ui/PasswordStrengthMeter";

export default function Settings({ user, profile, onClose, theme, setTheme }) {
  const [activeTab, setActiveTab] = useState("appearance");
  const [loading, setLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isLightRole = ["student", "professor"].includes(profile?.role);
  const primaryColor = isLightRole ? "green" : "indigo";

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

  const handleEmailChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success("Email updated successfully");
      setNewEmail("");
    } catch (_error) {
      toast.error("Failed to update email");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "appearance", label: "Appearance", icon: "🎨" },
    { id: "account", label: "Account", icon: "👤" },
    { id: "security", label: "Security", icon: "🔒" },
  ];

  const inputClass =
    theme === "dark"
      ? "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-" +
        primaryColor +
        "-500 focus:ring-2 focus:ring-" +
        primaryColor +
        "-500/20"
      : "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-" +
        primaryColor +
        "-500 focus:ring-2 focus:ring-" +
        primaryColor +
        "-500/20";

  const buttonClass = isLightRole
    ? "px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/25 transition-all"
    : "px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 transition-all";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl ${
            theme === "dark"
              ? "bg-slate-900 border border-white/10"
              : "bg-white border border-gray-100"
          }`}
        >
          <div
            className={`flex items-center justify-between p-6 border-b ${theme === "dark" ? "border-white/10" : "border-gray-200"}`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl shadow-lg ${
                  isLightRole
                    ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white"
                    : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                }`}
              >
                {profile?.full_name?.charAt(0) || "U"}
              </div>
              <div>
                <h2
                  className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  Settings
                </h2>
                <p
                  className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-gray-600"}`}
                >
                  {profile?.full_name} • {profile?.role?.replace("_", " ")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-full transition-colors ${
                theme === "dark"
                  ? "hover:bg-white/10 text-slate-400 hover:text-white"
                  : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="flex h-[calc(90vh-120px)]">
            <div
              className={`w-64 border-r p-4 overflow-y-auto ${theme === "dark" ? "border-white/10" : "border-gray-200"}`}
            >
              <nav className="space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
                      activeTab === tab.id
                        ? isLightRole
                          ? "bg-green-100 text-green-700 font-semibold shadow-sm"
                          : theme === "dark"
                            ? "bg-indigo-500/20 text-indigo-300 font-semibold shadow-sm"
                            : "bg-indigo-100 text-indigo-700 font-semibold shadow-sm"
                        : theme === "dark"
                          ? "text-slate-400 hover:bg-white/5 hover:text-white"
                          : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-xl">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              <AnimatePresence mode="wait">
                {activeTab === "appearance" && (
                  <motion.div
                    key="appearance"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3
                        className={`text-xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                      >
                        Theme Preference
                      </h3>
                      <p
                        className={`text-sm mb-6 ${theme === "dark" ? "text-slate-400" : "text-gray-600"}`}
                      >
                        Choose your preferred color scheme
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => handleThemeChange("light")}
                          className={`group relative p-6 rounded-2xl border-2 transition-all ${
                            theme === "light"
                              ? isLightRole
                                ? "border-green-500 bg-green-50"
                                : "border-indigo-500 bg-indigo-50"
                              : theme === "dark"
                                ? "border-white/10 hover:border-white/20 bg-white/5"
                                : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                        >
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                              <svg
                                className="w-8 h-8 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                            <div className="text-center">
                              <p
                                className={`font-bold text-lg ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                              >
                                Light
                              </p>
                              <p
                                className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-gray-600"}`}
                              >
                                Default theme
                              </p>
                            </div>
                            {theme === "light" && (
                              <div
                                className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center ${isLightRole ? "bg-green-500" : "bg-indigo-500"}`}
                              >
                                <svg
                                  className="w-4 h-4 text-white"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        </button>

                        <button
                          onClick={() => handleThemeChange("dark")}
                          className={`group relative p-6 rounded-2xl border-2 transition-all ${
                            theme === "dark"
                              ? isLightRole
                                ? "border-green-500 bg-green-50"
                                : "border-indigo-500 bg-indigo-500/20"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                        >
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg">
                              <svg
                                className="w-8 h-8 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                              </svg>
                            </div>
                            <div className="text-center">
                              <p
                                className={`font-bold text-lg ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                              >
                                Dark
                              </p>
                              <p
                                className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-gray-600"}`}
                              >
                                Easy on the eyes
                              </p>
                            </div>
                            {theme === "dark" && (
                              <div
                                className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center ${isLightRole ? "bg-green-500" : "bg-indigo-500"}`}
                              >
                                <svg
                                  className="w-4 h-4 text-white"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "account" && (
                  <motion.div
                    key="account"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3
                        className={`text-xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                      >
                        Profile Information
                      </h3>
                      <p
                        className={`text-sm mb-6 ${theme === "dark" ? "text-slate-400" : "text-gray-600"}`}
                      >
                        View and update your account details
                      </p>

                      <form
                        onSubmit={handleUpdateProfile}
                        className="space-y-4"
                      >
                        <div>
                          <label
                            className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
                          >
                            Full Name
                          </label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label
                            className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
                          >
                            Email
                          </label>
                          <input
                            type="email"
                            value={user?.email || ""}
                            disabled
                            className={`${inputClass} opacity-60 cursor-not-allowed`}
                          />
                        </div>
                        <div>
                          <label
                            className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
                          >
                            Role
                          </label>
                          <input
                            type="text"
                            value={
                              profile?.role?.replace("_", " ").toUpperCase() ||
                              ""
                            }
                            disabled
                            className={`${inputClass} opacity-60 cursor-not-allowed capitalize`}
                          />
                        </div>
                        {profile?.student_number && (
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
                            >
                              Student Number
                            </label>
                            <input
                              type="text"
                              value={profile.student_number}
                              disabled
                              className={`${inputClass} opacity-60 cursor-not-allowed`}
                            />
                          </div>
                        )}
                        {profile?.course_year && (
                          <div>
                            <label
                              className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
                            >
                              Course/Year
                            </label>
                            <input
                              type="text"
                              value={profile.course_year}
                              disabled
                              className={`${inputClass} opacity-60 cursor-not-allowed`}
                            />
                          </div>
                        )}
                        <button
                          type="submit"
                          disabled={loading || fullName === profile?.full_name}
                          className={buttonClass}
                        >
                          {loading ? "Updating..." : "Update Profile"}
                        </button>
                      </form>
                    </div>

                    <div
                      className={`pt-6 border-t ${theme === "dark" ? "border-white/10" : "border-gray-200"}`}
                    >
                      <h3
                        className={`text-xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                      >
                        Change Email
                      </h3>
                      <p
                        className={`text-sm mb-4 ${theme === "dark" ? "text-slate-400" : "text-gray-600"}`}
                      >
                        Update your email address
                      </p>
                      <form onSubmit={handleEmailChange} className="space-y-4">
                        <div>
                          <label
                            className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-slate-300" : "text-gray-700"}`}
                          >
                            New Email
                          </label>
                          <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className={inputClass}
                            placeholder="newemail@example.com"
                            required
                          />
                          <p
                            className={`text-xs mt-1 ${theme === "dark" ? "text-slate-500" : "text-gray-500"}`}
                          >
                            Your email will be updated immediately
                          </p>
                        </div>
                        <button
                          type="submit"
                          disabled={loading || !newEmail}
                          className={buttonClass}
                        >
                          {loading ? "Updating..." : "Update Email"}
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}

                {activeTab === "security" && (
                  <motion.div
                    key="security"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3
                        className={`text-xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                      >
                        Change Password
                      </h3>
                      <p
                        className={`text-sm mb-6 ${theme === "dark" ? "text-slate-400" : "text-gray-600"}`}
                      >
                        Update your password to keep your account secure
                      </p>

                      <form
                        onSubmit={handlePasswordChange}
                        className="space-y-4"
                      >
                        <PasswordInput
                          label="Current Password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                        />
                        <PasswordInput
                          label="New Password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={8}
                        />
                        <PasswordStrengthMeter password={newPassword} />
                        <PasswordInput
                          label="Confirm New Password"
                          value={confirmNewPassword}
                          onChange={(e) =>
                            setConfirmNewPassword(e.target.value)
                          }
                          required
                          minLength={8}
                        />
                        {confirmNewPassword &&
                          newPassword !== confirmNewPassword && (
                            <p className="text-sm text-red-600">
                              Passwords do not match
                            </p>
                          )}
                        <button
                          type="submit"
                          disabled={
                            loading ||
                            !currentPassword ||
                            !newPassword ||
                            newPassword !== confirmNewPassword
                          }
                          className={buttonClass}
                        >
                          {loading ? "Updating..." : "Update Password"}
                        </button>
                      </form>
                    </div>

                    <div
                      className={`pt-6 border-t ${theme === "dark" ? "border-white/10" : "border-gray-200"}`}
                    >
                      <h3 className="text-xl font-bold mb-2 text-red-600">
                        Danger Zone
                      </h3>
                      <p
                        className={`text-sm mb-4 ${theme === "dark" ? "text-slate-400" : "text-gray-600"}`}
                      >
                        Once you delete your account, there is no going back.
                        Please be certain.
                      </p>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="px-6 py-3 bg-red-500/10 text-red-600 border border-red-500/20 rounded-xl font-semibold hover:bg-red-500 hover:text-white transition-all"
                      >
                        Delete Account
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {showDeleteModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className={`max-w-md w-full rounded-2xl p-6 ${theme === "dark" ? "bg-slate-900 border border-white/10" : "bg-white"}`}
          >
            <h3
              className={`text-xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Delete Account
            </h3>
            <p
              className={`text-sm mb-6 ${theme === "dark" ? "text-slate-400" : "text-gray-600"}`}
            >
              Account deletion must be requested through your administrator.
              Please contact support for assistance.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className={buttonClass + " flex-1"}
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
