import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { authAxios } from "../../services/api";
import { GlassCard, StatusBadge } from "../ui/DashboardLayout";
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentCheckIcon,
  InboxStackIcon,
} from "../ui/Icons";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "pending", label: "Pending" },
  { id: "on_hold", label: "On Hold" },
];

export default function StudentRequestHistory({
  studentId,
  isDarkMode = false,
}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await authAxios.get(`requests/student/${studentId}`);
      if (data.success) setRequests(data.requests || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filtered =
    filter === "all"
      ? requests
      : requests.filter((r) => {
          if (filter === "completed") return r.is_completed;
          return r.current_status === filter;
        });

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getCompletionTime = (r) => {
    if (!r.is_completed || !r.created_at || !r.updated_at) return null;
    const hours =
      (new Date(r.updated_at) - new Date(r.created_at)) / (1000 * 60 * 60);
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <GlassCard key={i} isDark={isDarkMode} className="p-5 rounded-2xl">
            <div className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-full animate-pulse ${isDarkMode ? "bg-[#3c4043]" : "bg-[#e8eaed]"}`}
              />
              <div className="flex-1">
                <div
                  className={`h-4 w-40 rounded animate-pulse ${isDarkMode ? "bg-[#3c4043]" : "bg-[#e8eaed]"}`}
                />
                <div
                  className={`h-3 w-24 rounded mt-2 animate-pulse ${isDarkMode ? "bg-[#3c4043]" : "bg-[#e8eaed]"}`}
                />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.id
                ? isDarkMode
                  ? "bg-primary-400 text-[#202124]"
                  : "bg-primary-600 text-white"
                : isDarkMode
                  ? "bg-[#3c4043] text-[#e8eaed] hover:bg-[#4c4f53]"
                  : "bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <GlassCard isDark={isDarkMode} className="p-12 text-center rounded-2xl">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? "bg-primary-900/20" : "bg-primary-50"}`}
          >
            <InboxStackIcon
              className={`w-8 h-8 ${isDarkMode ? "text-primary-400" : "text-primary-600"}`}
            />
          </div>
          <h3
            className={`text-lg font-medium mb-1 ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
            style={{ fontFamily: "Google Sans, sans-serif" }}
          >
            No requests found
          </h3>
          <p
            className={`text-sm ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
          >
            {filter === "all"
              ? "You haven't submitted any clearance requests yet."
              : `No ${filter.replace("_", " ")} requests.`}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((r, idx) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <GlassCard isDark={isDarkMode} className="p-4 sm:p-5 rounded-2xl">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        r.is_completed
                          ? isDarkMode
                            ? "bg-emerald-500/10"
                            : "bg-emerald-50"
                          : r.current_status === "on_hold"
                            ? isDarkMode
                              ? "bg-red-500/10"
                              : "bg-red-50"
                            : isDarkMode
                              ? "bg-yellow-500/10"
                              : "bg-yellow-50"
                      }`}
                    >
                      {r.is_completed ? (
                        <CheckCircleIcon
                          className={`w-5 h-5 ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}
                        />
                      ) : r.current_status === "on_hold" ? (
                        <XCircleIcon
                          className={`w-5 h-5 ${isDarkMode ? "text-red-400" : "text-red-600"}`}
                        />
                      ) : (
                        <ClockIcon
                          className={`w-5 h-5 ${isDarkMode ? "text-yellow-400" : "text-yellow-600"}`}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
                      >
                        {r.document_types?.name || "Clearance Request"}
                      </p>
                      <div
                        className={`flex items-center gap-2 text-xs mt-0.5 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
                      >
                        <span>Submitted {formatDate(r.created_at)}</span>
                        {r.is_completed && (
                          <>
                            <span>•</span>
                            <span>Completed {formatDate(r.updated_at)}</span>
                          </>
                        )}
                        {getCompletionTime(r) && (
                          <>
                            <span>•</span>
                            <span>{getCompletionTime(r)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge
                      status={r.is_completed ? "completed" : r.current_status}
                      isDark={isDarkMode}
                    />
                    {r.is_completed && r.certificate_generated && (
                      <a
                        href={`/verify/${r.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          isDarkMode
                            ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        <DocumentCheckIcon className="w-3.5 h-3.5" />
                        Certificate
                      </a>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
