import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { authAxios } from "../../services/api";
import { ClockIcon, CheckCircleIcon, XCircleIcon } from "../ui/Icons";

const EDITABLE_FIELDS = [
  { key: "full_name", label: "Full Name" },
  { key: "student_number", label: "Student Number" },
  { key: "course_year", label: "Course & Year" },
];

export default function ProfileEditForm({ profile, isDarkMode = false }) {
  const [editRequests, setEditRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedField, setSelectedField] = useState("");
  const [newValue, setNewValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchEditRequests = async () => {
    setLoading(true);
    try {
      const { data } = await authAxios.get("profile/edit-requests");
      if (data.success) setEditRequests(data.requests);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEditRequests();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedField || !newValue.trim()) {
      toast.error("Please select a field and enter a new value");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await authAxios.post("profile/request-edit", {
        field_name: selectedField,
        new_value: newValue.trim(),
      });
      if (data.success) {
        toast.success("Edit request submitted for admin approval");
        setSelectedField("");
        setNewValue("");
        fetchEditRequests();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const statusIcon = {
    pending: <ClockIcon className="w-4 h-4 text-amber-500" />,
    approved: <CheckCircleIcon className="w-4 h-4 text-emerald-500" />,
    rejected: <XCircleIcon className="w-4 h-4 text-red-500" />,
  };

  const statusColor = {
    pending: isDarkMode ? "text-amber-400" : "text-amber-600",
    approved: isDarkMode ? "text-emerald-400" : "text-emerald-600",
    rejected: isDarkMode ? "text-red-400" : "text-red-600",
  };

  return (
    <div className="space-y-6">
      {/* Current Profile Info */}
      <div className={`rounded-2xl p-5 ${isDarkMode ? "bg-[#282a2d]" : "bg-white border border-[#dadce0]"}`}>
        <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? "text-white" : "text-[#202124]"}`}
            style={{ fontFamily: "Google Sans, sans-serif" }}>
          Current Profile
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {EDITABLE_FIELDS.map((f) => (
            <div key={f.key} className={`p-3 rounded-xl ${isDarkMode ? "bg-[#3c4043]/40" : "bg-[#f8f9fa]"}`}>
              <p className={`text-xs font-medium ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>{f.label}</p>
              <p className={`text-sm font-medium mt-1 ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}>
                {profile?.[f.key] || "—"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Request Edit Form */}
      <div className={`rounded-2xl p-5 ${isDarkMode ? "bg-[#282a2d]" : "bg-white border border-[#dadce0]"}`}>
        <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? "text-white" : "text-[#202124]"}`}
            style={{ fontFamily: "Google Sans, sans-serif" }}>
          Request Profile Change
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
            className={`px-4 py-2.5 rounded-xl border text-sm ${
              isDarkMode
                ? "bg-[#202124] border-[#3c4043] text-[#e8eaed]"
                : "bg-white border-[#dadce0] text-[#202124]"
            }`}
          >
            <option value="">Select field...</option>
            {EDITABLE_FIELDS.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="New value"
            className={`flex-1 px-4 py-2.5 rounded-xl border text-sm ${
              isDarkMode
                ? "bg-[#202124] border-[#3c4043] text-[#e8eaed] placeholder-[#5f6368]"
                : "bg-white border-[#dadce0] text-[#202124] placeholder-[#9aa0a6]"
            }`}
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={submitting}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
              isDarkMode
                ? "bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]"
                : "bg-[#1a73e8] text-white hover:bg-[#1557b0]"
            }`}
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </motion.button>
        </form>
      </div>

      {/* Edit Request History */}
      {editRequests.length > 0 && (
        <div className={`rounded-2xl p-5 ${isDarkMode ? "bg-[#282a2d]" : "bg-white border border-[#dadce0]"}`}>
          <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? "text-white" : "text-[#202124]"}`}
              style={{ fontFamily: "Google Sans, sans-serif" }}>
            Edit Request History
          </h3>
          <div className="space-y-2">
            {editRequests.map((r) => (
              <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl ${isDarkMode ? "bg-[#3c4043]/30" : "bg-[#f8f9fa]"}`}>
                {statusIcon[r.status]}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}>
                    <span className="font-medium">{r.field_name.replace(/_/g, " ")}</span>
                    {" → "}
                    <span className="font-medium">{r.new_value}</span>
                  </p>
                  {r.admin_comment && (
                    <p className={`text-xs mt-0.5 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                      Admin: {r.admin_comment}
                    </p>
                  )}
                </div>
                <span className={`text-xs font-medium capitalize ${statusColor[r.status]}`}>
                  {r.status}
                </span>
                <span className={`text-[11px] ${isDarkMode ? "text-[#5f6368]" : "text-[#9aa0a6]"}`}>
                  {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
