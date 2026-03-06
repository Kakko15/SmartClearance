import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

export default function RequestHistory({ studentId, isAdmin = false }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchHistory = useCallback(async () => {
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
          setHistory(
            enrichedHistory.filter((h) => h.request?.student_id === studentId),
          );
        } else {
          setHistory(enrichedHistory);
        }
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [filter, studentId, isAdmin]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatAdminRole = (role) => {
    if (!role) return "Admin";

    return role
      .replace("_admin", "")
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: "badge-pending",
      approved: "badge-approved",
      on_hold: "badge-rejected",
      rejected: "badge-rejected",
      completed: "badge-completed",
    };
    return badges[status] || "badge";
  };

  const getActionIcon = (action) => {
    switch (action) {
      case "created":
        return (
          <svg
            className="w-5 h-5 text-blue-500"
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
            className="w-5 h-5 text-green-500"
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
            className="w-5 h-5 text-red-500"
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
            className="w-5 h-5 text-amber-500"
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
            className="w-5 h-5 text-blue-500"
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
            className="w-5 h-5 text-gray-500"
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
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <svg
            className="w-6 h-6 text-primary-600"
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
          <h2 className="text-xl font-bold text-gray-900">Request History</h2>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
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
          <p className="text-gray-500">No history found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getActionIcon(entry.action_taken)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`badge ${getStatusBadge(entry.new_status)}`}
                    >
                      {entry.new_status
                        ? entry.new_status.charAt(0).toUpperCase() +
                          entry.new_status.slice(1).replace("_", " ")
                        : "Unknown"}
                    </span>
                    {entry.previous_status && (
                      <span className="text-xs text-gray-500">
                        from {entry.previous_status}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-900 font-medium mb-1">
                    Request {entry.action_taken}{" "}
                    {entry.admin?.full_name
                      ? `by ${entry.admin.full_name} (${formatAdminRole(entry.admin.role)})`
                      : ""}
                  </p>

                  {isAdmin && entry.request?.profiles && (
                    <p className="text-sm text-gray-600 mb-1">
                      Student: {entry.request.profiles.full_name} (
                      {entry.request.profiles.student_number})
                    </p>
                  )}

                  {entry.comments && (
                    <p className="text-sm text-gray-600 italic mb-2">
                      "{entry.comments}"
                    </p>
                  )}

                  <p className="text-xs text-gray-500">
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
