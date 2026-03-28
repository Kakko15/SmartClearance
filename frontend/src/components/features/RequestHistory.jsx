import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import CustomSelect from "../ui/CustomSelect";

let requestHistoryCache = {};

export default function RequestHistory({
  studentId,
  isAdmin = false,
  isDark = false,
}) {
  const cacheKey = `${studentId}-${isAdmin}`;

  const [history, setHistory] = useState(() => {
    const cached = requestHistoryCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < 300000) return cached.data;
    return [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = requestHistoryCache[cacheKey];
    return !(cached && Date.now() - cached.timestamp < 300000);
  });
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    let timer;
    if (loading && history.length === 0) {
      timer = setTimeout(() => setShowSkeleton(true), 150);
    } else {
      setShowSkeleton(false);
    }
    return () => clearTimeout(timer);
  }, [loading, history.length]);

  const [filter, setFilter] = useState("all");

  const fetchHistory = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let query = supabase
        .from("request_history")
        .select("*")
        .order("timestamp", { ascending: false });

      if (filter !== "all") {
        query = query.eq("new_status", filter);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        const adminIds = [
          ...new Set(data.map((h) => h.processed_by).filter(Boolean)),
        ];

        const { data: admins } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("id", adminIds);

        const requestIds = [...new Set(data.map((h) => h.request_id))];

        const { data: requests } = await supabase
          .from("requests")
          .select(
            "id, student_id, profiles!requests_student_id_fkey(full_name, student_number)",
          )
          .in("id", requestIds);

        const enrichedHistory = data.map((entry) => ({
          ...entry,
          admin: admins?.find((a) => a.id === entry.processed_by),
          request: requests?.find((r) => r.id === entry.request_id),
        }));

        if (!isAdmin && studentId) {
          const filtered = enrichedHistory.filter((h) => h.request?.student_id === studentId);
          setHistory(filtered);
          requestHistoryCache[cacheKey] = { data: filtered, timestamp: Date.now() };
        } else {
          setHistory(enrichedHistory);
          requestHistoryCache[cacheKey] = { data: enrichedHistory, timestamp: Date.now() };
        }
      } else {
        setHistory([]);
        requestHistoryCache[cacheKey] = { data: [], timestamp: Date.now() };
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      if (!silent) setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [filter, studentId, isAdmin, cacheKey]);

  useEffect(() => {
    const cached = requestHistoryCache[cacheKey];
    const hasCache = cached && Date.now() - cached.timestamp < 300000;
    fetchHistory(hasCache);
  }, [fetchHistory, cacheKey]);

  const formatAdminRole = (role) => {
    if (!role) return "Admin";

    return role
      .replace("_admin", "")
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getStatusColor = (status) => {
    const map = {
      pending: isDark
        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
        : "bg-yellow-100 text-yellow-800 border-yellow-200",
      approved: isDark
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
        : "bg-green-100 text-green-800 border-green-200",
      on_hold: isDark
        ? "bg-red-500/20 text-red-300 border-red-500/30"
        : "bg-red-100 text-red-800 border-red-200",
      rejected: isDark
        ? "bg-red-500/20 text-red-300 border-red-500/30"
        : "bg-red-100 text-red-800 border-red-200",
      completed: isDark
        ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
        : "bg-blue-100 text-blue-800 border-blue-200",
    };
    return (
      map[status] ||
      (isDark
        ? "bg-white/10 text-slate-300 border-white/10"
        : "bg-gray-100 text-gray-800 border-gray-200")
    );
  };

  const getActionIcon = (action) => {
    const iconColor = {
      created: isDark ? "text-blue-400" : "text-blue-500",
      approved: isDark ? "text-emerald-400" : "text-green-500",
      rejected: isDark ? "text-red-400" : "text-red-500",
      resubmitted: isDark ? "text-amber-400" : "text-amber-500",
      completed: isDark ? "text-indigo-400" : "text-blue-500",
    };
    const color =
      iconColor[action] || (isDark ? "text-slate-400" : "text-gray-500");

    switch (action) {
      case "created":
        return (
          <svg
            className={`w-5 h-5 ${color}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "approved":
        return (
          <svg
            className={`w-5 h-5 ${color}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "rejected":
        return (
          <svg
            className={`w-5 h-5 ${color}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "resubmitted":
        return (
          <svg
            className={`w-5 h-5 ${color}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "completed":
        return (
          <svg
            className={`w-5 h-5 ${color}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return (
          <svg
            className={`w-5 h-5 ${color}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  if (loading) {
    if (!showSkeleton) return null;
    return (
      <div
        className={`rounded-2xl p-6 ${isDark ? "bg-white/[0.02] border border-white/[0.05]" : "card"}`}
      >
        <div className="animate-[pulse_1s_ease-in-out_infinite]">
          <div
            className={`h-6 rounded w-1/4 mb-4 ${isDark ? "bg-white/10" : "bg-gray-200"}`}
          ></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-20 rounded ${isDark ? "bg-white/10" : "bg-gray-200"}`}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl p-6 ${isDark ? "bg-white/[0.02] border border-white/[0.05]" : "card"}`}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <svg
            className={`w-6 h-6 ${isDark ? "text-indigo-400" : "text-primary-600"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2
            className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          >
            Request History
          </h2>
        </div>

        <div className="w-44 z-50 relative">
          <CustomSelect
            value={filter}
            onChange={setFilter}
            isDark={isDark}
            options={[
              { value: "all", label: "All Status" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "completed", label: "Completed" },
            ]}
          />
        </div>
      </div>

      {history.length === 0 ? (
        <div
          className={`p-12 text-center rounded-2xl border shadow-sm ${
            isDark
              ? "bg-[#282a2d] border-[#3c4043]"
              : "bg-white border-gray-200"
          }`}
        >
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isDark ? "bg-slate-800" : "bg-slate-100"
            }`}
          >
            <svg
              className={`w-8 h-8 ${isDark ? "text-slate-500" : "text-slate-400"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3
            className={`text-lg font-bold mb-1 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            No records
          </h3>
          <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            No clearance history found
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-xl p-4 transition-all duration-200 ${
                isDark
                  ? "bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04]"
                  : "border border-gray-200 hover:shadow-md"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getActionIcon(entry.action_taken)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${getStatusColor(entry.new_status)}`}
                    >
                      {entry.new_status
                        ? entry.new_status.charAt(0).toUpperCase() +
                          entry.new_status.slice(1).replace("_", " ")
                        : "Unknown"}
                    </span>
                    {entry.previous_status && (
                      <span
                        className={`text-xs ${isDark ? "text-slate-500" : "text-gray-500"}`}
                      >
                        from {entry.previous_status}
                      </span>
                    )}
                  </div>

                  <p
                    className={`text-sm font-medium mb-1 ${isDark ? "text-white" : "text-gray-900"}`}
                  >
                    Request {entry.action_taken}{" "}
                    {entry.admin?.full_name
                      ? `by ${entry.admin.full_name} (${formatAdminRole(entry.admin.role)})`
                      : ""}
                  </p>

                  {isAdmin && entry.request?.profiles && (
                    <p
                      className={`text-sm mb-1 ${isDark ? "text-slate-400" : "text-gray-600"}`}
                    >
                      Student: {entry.request.profiles.full_name} (
                      {entry.request.profiles.student_number})
                    </p>
                  )}

                  {entry.comments && (
                    <p
                      className={`text-sm italic mb-2 ${isDark ? "text-slate-400" : "text-gray-600"}`}
                    >
                      "{entry.comments}"
                    </p>
                  )}

                  <p
                    className={`text-xs ${isDark ? "text-slate-600" : "text-gray-500"}`}
                  >
                    {new Date(entry.timestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
