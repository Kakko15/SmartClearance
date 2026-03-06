import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export default function PendingAccountsView({ adminId, isDark = false }) {
  const [pendingAccounts, setPendingAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedAccount, setSelectedAccount] = useState(null);

  useEffect(() => {
    fetchPendingAccounts();
  }, []);

  const fetchPendingAccounts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/admin/pending-accounts`);

      if (response.data.success) {
        setPendingAccounts(response.data.accounts);
      }
    } catch (error) {
      console.error("Error fetching pending accounts:", error);
      toast.error("Failed to load pending accounts");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    setActionLoading(userId);
    try {
      const response = await axios.post(
        `${API_URL}/api/admin/approve-account`,
        {
          userId,
          adminId,
        },
      );

      if (response.data.success) {
        toast.success("Account approved!");
        fetchPendingAccounts();
      }
    } catch (error) {
      console.error("Error approving account:", error);
      toast.error(error.response?.data?.error || "Failed to approve account");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setActionLoading(userId);
    try {
      const response = await axios.post(`${API_URL}/api/admin/reject-account`, {
        userId,
        adminId,
        reason: rejectReason,
      });

      if (response.data.success) {
        toast.success("Account rejected");
        setRejectReason("");
        setSelectedAccount(null);
        fetchPendingAccounts();
      }
    } catch (error) {
      console.error("Error rejecting account:", error);
      toast.error(error.response?.data?.error || "Failed to reject account");
    } finally {
      setActionLoading(null);
    }
  };

  const getSimilarityColor = (similarity) => {
    if (similarity >= 90) return "text-green-500";
    if (similarity >= 80) return "text-yellow-500";
    return "text-red-500";
  };

  const getSimilarityBgColor = (similarity) => {
    if (similarity >= 90)
      return isDark
        ? "bg-green-500/10 border-green-500/30"
        : "bg-green-50 border-green-200";
    if (similarity >= 80)
      return isDark
        ? "bg-yellow-500/10 border-yellow-500/30"
        : "bg-yellow-50 border-yellow-200";
    return isDark
      ? "bg-red-500/10 border-red-500/30"
      : "bg-red-50 border-red-200";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  if (pendingAccounts.length === 0) {
    return (
      <div
        className={`text-center py-12 rounded-2xl ${isDark ? "bg-slate-800/50" : "bg-gray-50"}`}
      >
        <div
          className={`w-20 h-20 rounded-full ${isDark ? "bg-green-500/20" : "bg-green-100"} flex items-center justify-center mx-auto mb-4`}
        >
          <svg
            className={`w-10 h-10 ${isDark ? "text-green-400" : "text-green-600"}`}
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
        </div>
        <h3
          className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}
        >
          All Caught Up!
        </h3>
        <p className={isDark ? "text-gray-400" : "text-gray-600"}>
          No pending account verifications at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2
          className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
        >
          Pending Account Verifications
        </h2>
        <span
          className={`px-4 py-2 rounded-full font-semibold ${isDark ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-800"}`}
        >
          {pendingAccounts.length} Pending
        </span>
      </div>

      <div className="grid gap-6">
        {pendingAccounts.map((account) => (
          <motion.div
            key={account.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-2xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-gray-200"} shadow-lg`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-full ${isDark ? "bg-blue-500/20" : "bg-blue-100"} flex items-center justify-center`}
                >
                  <span
                    className={`text-2xl font-bold ${isDark ? "text-blue-400" : "text-blue-600"}`}
                  >
                    {account.full_name?.charAt(0) || "?"}
                  </span>
                </div>
                <div>
                  <h3
                    className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                  >
                    {account.full_name}
                  </h3>
                  <p
                    className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
                  >
                    {account.email}
                  </p>
                  <p
                    className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"} mt-1`}
                  >
                    Student #: {account.student_number}
                  </p>
                </div>
              </div>

              <div
                className={`px-4 py-2 rounded-full border ${getSimilarityBgColor(account.face_similarity)}`}
              >
                <span
                  className={`font-bold ${getSimilarityColor(account.face_similarity)}`}
                >
                  {account.face_similarity?.toFixed(1)}% Match
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div
                className={`p-3 rounded-xl ${isDark ? "bg-slate-900/50" : "bg-gray-50"}`}
              >
                <p
                  className={`text-xs font-semibold ${isDark ? "text-gray-400" : "text-gray-600"} mb-1`}
                >
                  Course & Year
                </p>
                <p
                  className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {account.course_year || "N/A"}
                </p>
              </div>

              <div
                className={`p-3 rounded-xl ${isDark ? "bg-slate-900/50" : "bg-gray-50"}`}
              >
                <p
                  className={`text-xs font-semibold ${isDark ? "text-gray-400" : "text-gray-600"} mb-1`}
                >
                  Registered
                </p>
                <p
                  className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {new Date(account.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl mb-4 ${isDark ? "bg-slate-900/50" : "bg-gray-50"}`}
            >
              <p
                className={`text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                Face Verification Analysis
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                    ID Verified:
                  </span>
                  <span
                    className={
                      account.face_verified ? "text-green-500" : "text-red-500"
                    }
                  >
                    {account.face_verified ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                    Similarity Score:
                  </span>
                  <span
                    className={`font-bold ${getSimilarityColor(account.face_similarity)}`}
                  >
                    {account.face_similarity?.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                    Threshold:
                  </span>
                  <span className={isDark ? "text-gray-300" : "text-gray-700"}>
                    90% (Auto-approve)
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <div
                  className={`w-full rounded-full h-2 overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                >
                  <div
                    className={`h-full rounded-full transition-all ${
                      account.face_similarity >= 90
                        ? "bg-green-500"
                        : account.face_similarity >= 80
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{
                      width: `${Math.min(account.face_similarity, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleApprove(account.id)}
                disabled={actionLoading === account.id}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                  actionLoading === account.id
                    ? "bg-gray-400 cursor-not-allowed"
                    : isDark
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                {actionLoading === account.id ? "Processing..." : "✓ Approve"}
              </button>

              <button
                onClick={() => setSelectedAccount(account.id)}
                disabled={actionLoading === account.id}
                className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                  actionLoading === account.id
                    ? "bg-gray-400 cursor-not-allowed"
                    : isDark
                      ? "bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30"
                      : "bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200"
                }`}
              >
                ✗ Reject
              </button>
            </div>

            {selectedAccount === account.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 space-y-3"
              >
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  className={`w-full p-3 rounded-xl border ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white"
                      : "bg-white border-gray-200 text-gray-900"
                  } focus:outline-none focus:border-red-500`}
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(account.id)}
                    disabled={
                      !rejectReason.trim() || actionLoading === account.id
                    }
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAccount(null);
                      setRejectReason("");
                    }}
                    className={`flex-1 py-2 rounded-xl font-semibold ${
                      isDark
                        ? "bg-slate-700 hover:bg-slate-600 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
