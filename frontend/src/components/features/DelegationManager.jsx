import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { authAxios } from "../../services/api";
import { UsersIcon, ClockIcon, XMarkIcon } from "../ui/Icons";

export default function DelegationManager({ isDarkMode = false }) {
  const [delegation, setDelegation] = useState(null);
  const [signatories, setSignatories] = useState([]);
  const [selectedDelegate, setSelectedDelegate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchDelegation = useCallback(async () => {
    try {
      const [delRes, sigRes] = await Promise.all([
        authAxios.get("delegation"),
        authAxios.get("delegation/signatories"),
      ]);
      if (delRes.data.success) setDelegation(delRes.data.delegation);
      if (sigRes.data.success) setSignatories(sigRes.data.signatories);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDelegation(); }, [fetchDelegation]);

  const handleSet = async (e) => {
    e.preventDefault();
    if (!selectedDelegate || !expiresAt) {
      toast.error("Please select a delegate and expiry date");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await authAxios.post("delegation/set", {
        delegated_to: selectedDelegate,
        expires_at: expiresAt,
      });
      if (data.success) {
        toast.success("Delegation set successfully");
        setSelectedDelegate("");
        setExpiresAt("");
        fetchDelegation();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to set delegation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    setSubmitting(true);
    try {
      const { data } = await authAxios.post("delegation/revoke");
      if (data.success) {
        toast.success("Delegation revoked");
        fetchDelegation();
      }
    } catch {
      toast.error("Failed to revoke delegation");
    } finally {
      setSubmitting(false);
    }
  };

  const isExpired = delegation?.delegation_expires_at && new Date(delegation.delegation_expires_at) < new Date();
  const hasActive = delegation?.delegated_to && !isExpired;

  // Minimum date for the picker (tomorrow)
  const minDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  if (loading) {
    return (
      <div className={`rounded-2xl p-6 animate-pulse ${isDarkMode ? "bg-[#282a2d]" : "bg-white border border-[#dadce0]"}`}>
        <div className={`h-5 w-48 rounded ${isDarkMode ? "bg-[#3c4043]" : "bg-[#e8eaed]"}`} />
        <div className={`h-4 w-64 rounded mt-3 ${isDarkMode ? "bg-[#3c4043]" : "bg-[#e8eaed]"}`} />
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-5 ${isDarkMode ? "bg-[#282a2d]" : "bg-white border border-[#dadce0]"}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-xl ${isDarkMode ? "bg-[#3c4043]" : "bg-[#f1f3f4]"}`}>
          <UsersIcon className={`w-5 h-5 ${isDarkMode ? "text-[#8ab4f8]" : "text-[#1a73e8]"}`} />
        </div>
        <div>
          <h3 className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-[#202124]"}`}
              style={{ fontFamily: "Google Sans, sans-serif" }}>
            Delegation
          </h3>
          <p className={`text-xs ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
            Designate a temporary substitute while you're away
          </p>
        </div>
      </div>

      {hasActive ? (
        <div className="space-y-3">
          <div className={`flex items-center justify-between p-4 rounded-xl ${isDarkMode ? "bg-[#1a73e8]/10 border border-[#1a73e8]/20" : "bg-[#e8f0fe] border border-[#c2e7ff]"}`}>
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? "text-[#8ab4f8]" : "text-[#1a73e8]"}`}>
                Active Delegation
              </p>
              <p className={`text-sm mt-1 ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}>
                Delegated to <span className="font-semibold">{delegation.delegate?.full_name}</span>
              </p>
              <div className={`flex items-center gap-1 mt-1 text-xs ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                <ClockIcon className="w-3.5 h-3.5" />
                Expires {new Date(delegation.delegation_expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleRevoke}
              disabled={submitting}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isDarkMode
                  ? "bg-[#f28b82]/10 text-[#f28b82] hover:bg-[#f28b82]/20"
                  : "bg-red-50 text-red-600 hover:bg-red-100"
              }`}
            >
              <XMarkIcon className="w-4 h-4" />
              Revoke
            </motion.button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSet} className="space-y-3">
          {isExpired && (
            <p className={`text-xs ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
              Previous delegation has expired.
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedDelegate}
              onChange={(e) => setSelectedDelegate(e.target.value)}
              className={`flex-1 px-4 py-2.5 rounded-xl border text-sm ${
                isDarkMode
                  ? "bg-[#202124] border-[#3c4043] text-[#e8eaed]"
                  : "bg-white border-[#dadce0] text-[#202124]"
              }`}
            >
              <option value="">Select signatory...</option>
              {signatories.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
            <input
              type="date"
              value={expiresAt}
              min={minDate}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={`px-4 py-2.5 rounded-xl border text-sm ${
                isDarkMode
                  ? "bg-[#202124] border-[#3c4043] text-[#e8eaed]"
                  : "bg-white border-[#dadce0] text-[#202124]"
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
              {submitting ? "Setting..." : "Set Delegation"}
            </motion.button>
          </div>
        </form>
      )}
    </div>
  );
}
