import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { authAxios } from "../../services/api";
import { GlassCard } from "../ui/DashboardLayout";
import {
  UserIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  AcademicCapIcon,
  ShieldCheckIcon,
} from "../ui/Icons";

const FIELD_LABELS = {
  full_name: "Full Name",
  student_number: "Student Number",
  course_year: "Course & Year",
};

const FIELD_ICONS = {
  full_name: UserIcon,
  student_number: AcademicCapIcon,
  course_year: AcademicCapIcon,
};

export default function StudentProfile({
  studentInfo,
  user,
  isDarkMode = false,
}) {
  const [editRequests, setEditRequests] = useState([]);
  const [loadingEdits, setLoadingEdits] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchEditRequests = useCallback(async () => {
    setLoadingEdits(true);
    try {
      const { data } = await authAxios.get("/profiles/edit-requests");
      if (data.success) setEditRequests(data.requests || []);
    } catch {

    } finally {
      setLoadingEdits(false);
    }
  }, []);

  useEffect(() => {
    fetchEditRequests();
  }, [fetchEditRequests]);

  const handleRequestEdit = async () => {
    if (!editingField || !editValue.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await authAxios.post("/profiles/request-edit", {
        field_name: editingField,
        new_value: editValue.trim(),
      });
      if (data.success) {
        toast.success("Edit request submitted for admin approval");
        setEditingField(null);
        setEditValue("");
        fetchEditRequests();
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to submit edit request",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const profileFields = [
    { key: "full_name", value: studentInfo?.full_name || "—" },
    { key: "student_number", value: studentInfo?.student_number || "—" },
    { key: "course_year", value: studentInfo?.course_year || "—" },
  ];

  const pendingEditsMap = {};
  editRequests
    .filter((r) => r.status === "pending")
    .forEach((r) => {
      pendingEditsMap[r.field_name] = r;
    });

  const email = user?.email || "—";
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const avatar = user?.user_metadata?.avatar_url;
  const initials = (studentInfo?.full_name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">

      <GlassCard
        isDark={isDarkMode}
        className="p-6 sm:p-8 rounded-3xl overflow-hidden relative border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"
      >

        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
              opacity: [0.2, 0.3, 0.2]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className={`absolute -right-10 -top-20 w-80 h-80 rounded-full ${isDarkMode ? "bg-primary-500" : "bg-primary-300"}`}
            style={{ filter: "blur(80px)" }}
          />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              translateY: [0, 10, -10, 0],
              opacity: [0.15, 0.25, 0.15]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute -left-20 -bottom-20 w-72 h-72 rounded-full ${isDarkMode ? "bg-emerald-500" : "bg-emerald-300"}`}
            style={{ filter: "blur(80px)" }}
          />

          <div className={`absolute inset-0 backdrop-blur-[2px] ${isDarkMode ? "bg-[#282a2d]/40" : "bg-white/60"}`} />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5">

          <div className="relative">
            {avatar ? (
              <img
                src={avatar}
                alt="Profile"
                className="w-20 h-20 rounded-2xl object-cover shadow-lg"
              />
            ) : (
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg ${isDarkMode ? "bg-primary-900/50 text-primary-400" : "bg-primary-100 text-primary-700"}`}
              >
                {initials}
              </div>
            )}
            <div
              className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 ${isDarkMode ? "bg-emerald-500 border-[#202124]" : "bg-emerald-500 border-white"}`}
            >
              <CheckCircleIcon className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h3
              className={`text-xl font-medium ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
              style={{ fontFamily: "Google Sans, sans-serif" }}
            >
              {studentInfo?.full_name || "Student"}
            </h3>
            <p
              className={`text-sm mt-0.5 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
            >
              {studentInfo?.student_number || "—"} ·{" "}
              {studentInfo?.course_year || "—"}
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-3 justify-center sm:justify-start">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isDarkMode ? "bg-primary-500/15 text-primary-400 border border-primary-500/20" : "bg-primary-50 text-primary-700 border border-primary-200"}`}
              >
                <ShieldCheckIcon className="w-3.5 h-3.5" />
                Student
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isDarkMode ? "bg-[#3c4043] text-[#9aa0a6]" : "bg-[#f1f3f4] text-[#5f6368]"}`}
              >
                Since {createdAt}
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard isDark={isDarkMode} className="rounded-3xl overflow-hidden border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]">
        <div
          className={`px-6 py-4 border-b ${isDarkMode ? "border-[#3c4043]" : "border-[#e8eaed]"}`}
        >
          <h4
            className={`text-[15px] font-medium ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
            style={{ fontFamily: "Google Sans, sans-serif" }}
          >
            Account Details
          </h4>
          <p
            className={`text-xs mt-0.5 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
          >
            Personal information used in your clearance forms
          </p>
        </div>

        <div className="p-2 space-y-1">

          <div className={`px-4 py-4 flex items-center justify-between rounded-2xl transition-colors ${isDarkMode ? "hover:bg-white/[0.02]" : "hover:bg-black/[0.02]"}`}>
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDarkMode ? "bg-[#3c4043]" : "bg-[#f1f3f4]"}`}
              >
                <svg
                  className={`w-4.5 h-4.5 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
              </div>
              <div>
                <p
                  className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
                >
                  Email Address
                </p>
                <p
                  className={`text-sm font-medium mt-0.5 ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
                >
                  {email}
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${isDarkMode ? "bg-[#3c4043] text-[#9aa0a6]" : "bg-[#f1f3f4] text-[#9aa0a6]"}`}
            >
              Read-only
            </span>
          </div>

          {profileFields.map((field) => {
            const Icon = FIELD_ICONS[field.key];
            const hasPending = !!pendingEditsMap[field.key];

            return (
              <div key={field.key} className={`px-4 py-4 rounded-2xl transition-colors ${editingField === field.key ? (isDarkMode ? "bg-white/[0.03]" : "bg-black/[0.03]") : (isDarkMode ? "hover:bg-white/[0.02]" : "hover:bg-black/[0.02]")}`}>
                <div className="flex items-start sm:items-center gap-4">

                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${isDarkMode ? "bg-[#3c4043]" : "bg-[#f1f3f4]"}`}>
                    <Icon className={`w-5 h-5 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                      {FIELD_LABELS[field.key]}
                    </p>

                    {editingField === field.key ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className={`flex-1 min-w-0 px-3 py-2 text-[15px] outline-none border-b-2 transition-all rounded-t-lg ${
                            isDarkMode
                              ? "bg-white/5 hover:bg-white/10 text-white border-[#5f6368] focus:border-primary-400 focus:bg-white/10"
                              : "bg-black/5 hover:bg-black/10 text-[#202124] border-[#9aa0a6] focus:border-primary-600 focus:bg-black/10"
                          }`}
                          autoFocus
                          placeholder={`Enter ${FIELD_LABELS[field.key].toLowerCase()}`}
                        />
                        <div className="flex items-center gap-2 mt-1 sm:mt-0">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handleRequestEdit}
                            disabled={submitting || !editValue.trim() || editValue.trim() === field.value}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isDarkMode
                                ? "bg-primary-500 text-[#202124] hover:bg-primary-400"
                                : "bg-primary-600 text-white hover:bg-primary-700"
                            } disabled:opacity-50 shadow-sm`}
                          >
                            {submitting ? "..." : "Save"}
                          </motion.button>
                          <button
                            onClick={() => setEditingField(null)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isDarkMode ? "text-[#e8eaed] hover:bg-white/10" : "text-[#5f6368] hover:bg-black/5"
                            }`}
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <p className={`text-[15px] font-medium mt-0.5 truncate ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}>
                        {field.value}
                      </p>
                    )}
                  </div>

                  {editingField !== field.key && (
                    <div className="flex-shrink-0 ml-2 sm:ml-4">
                      {hasPending ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${isDarkMode ? "bg-amber-500/15 text-amber-400" : "bg-amber-50 text-amber-700"}`}>
                          <ClockIcon className="w-3 h-3" />
                          <span className="hidden sm:inline">Pending</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingField(field.key);
                            setEditValue(field.value === "—" ? "" : field.value);
                          }}
                          className={`flex items-center justify-center p-2 rounded-full transition-colors ${
                            isDarkMode
                              ? "text-[#9aa0a6] hover:bg-white/10 hover:text-[#e8eaed]"
                              : "text-[#5f6368] hover:bg-black/5 hover:text-[#202124]"
                          }`}
                          title="Edit"
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {!loadingEdits && editRequests.length > 0 && (
        <GlassCard isDark={isDarkMode} className="rounded-3xl overflow-hidden border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] mt-6">
          <div
            className={`px-6 py-4 border-b ${isDarkMode ? "border-[#3c4043]" : "border-[#e8eaed]"}`}
          >
            <h4
              className={`text-[15px] font-medium ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
              style={{ fontFamily: "Google Sans, sans-serif" }}
            >
              Edit Request History
            </h4>
          </div>

          <div className="p-4 space-y-2">
            {editRequests.slice(0, 10).map((req) => (
              <div
                key={req.id}
                className={`flex items-center justify-between px-4 py-3 rounded-xl ${isDarkMode ? "bg-[#2a2a2d]" : "bg-[#f8f9fa]"}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      req.status === "approved"
                        ? isDarkMode
                          ? "bg-emerald-500/15"
                          : "bg-emerald-50"
                        : req.status === "rejected"
                          ? isDarkMode
                            ? "bg-red-500/15"
                            : "bg-red-50"
                          : isDarkMode
                            ? "bg-amber-500/15"
                            : "bg-amber-50"
                    }`}
                  >
                    {req.status === "approved" ? (
                      <CheckCircleIcon
                        className={`w-4 h-4 ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}
                      />
                    ) : req.status === "rejected" ? (
                      <XCircleIcon
                        className={`w-4 h-4 ${isDarkMode ? "text-red-400" : "text-red-600"}`}
                      />
                    ) : (
                      <ClockIcon
                        className={`w-4 h-4 ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}
                      />
                    )}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-medium ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
                    >
                      {FIELD_LABELS[req.field_name] || req.field_name}
                    </p>
                    <p
                      className={`text-xs ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
                    >
                      {req.old_value} → {req.new_value}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    req.status === "approved"
                      ? isDarkMode
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-emerald-50 text-emerald-700"
                      : req.status === "rejected"
                        ? isDarkMode
                          ? "bg-red-500/15 text-red-400"
                          : "bg-red-50 text-red-700"
                        : isDarkMode
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
