import { useState, useEffect } from "react";

export default function CommentCard({
  comment,
  userId,
  userRole,
  onResolve,
  onDelete,
  isDarkMode = false,
}) {
  const [deleteTimeLeft, setDeleteTimeLeft] = useState(null);

  useEffect(() => {
    if (comment.commenter_id !== userId) return;

    const updateTimer = () => {
      const created = new Date(comment.created_at);
      const now = new Date();
      const diffMs = 5 * 60 * 1000 - (now - created);

      if (diffMs <= 0) {
        setDeleteTimeLeft(null);
      } else {
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        setDeleteTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [comment.created_at, comment.commenter_id, userId]);

  const canResolve = () => {
    if (userRole === "student") return false;
    const isAuthor = comment.commenter_id === userId;
    const isSuperAdmin = userRole === "super_admin";
    const isRegistrar = userRole === "registrar_admin";
    return isAuthor || isSuperAdmin || isRegistrar;
  };

  const canDelete = () => {
    if (userRole === "student") return false;
    const isSuperAdmin = userRole === "super_admin";
    if (isSuperAdmin) return true;

    const isAuthor = comment.commenter_id === userId;
    return isAuthor;
  };

  const getRoleBadge = (role) => {
    const roleMap = {
      student: {
        label: "Student",
        bg: "bg-blue-100 text-blue-700 border-blue-200",
        darkBg: "bg-blue-900/30 text-blue-300 border-blue-700",
      },
      professor: {
        label: "Professor",
        bg: "bg-purple-100 text-purple-700 border-purple-200",
        darkBg: "bg-purple-900/30 text-purple-300 border-purple-700",
      },
      department_head: {
        label: "Dept. Head",
        bg: "bg-purple-100 text-purple-700 border-purple-200",
        darkBg: "bg-purple-900/30 text-purple-300 border-purple-700",
      },
      library_admin: {
        label: "Library Admin",
        bg: "bg-amber-100 text-amber-700 border-amber-200",
        darkBg: "bg-amber-900/30 text-amber-300 border-amber-700",
      },
      cashier_admin: {
        label: "Cashier Admin",
        bg: "bg-emerald-100 text-emerald-700 border-emerald-200",
        darkBg: "bg-emerald-900/30 text-emerald-300 border-emerald-700",
      },
      registrar_admin: {
        label: "Registrar Admin",
        bg: "bg-indigo-100 text-indigo-700 border-indigo-200",
        darkBg: "bg-indigo-900/30 text-indigo-300 border-indigo-700",
      },
      super_admin: {
        label: "Super Admin",
        bg: "bg-red-100 text-red-700 border-red-200",
        darkBg: "bg-red-900/30 text-red-300 border-red-700",
      },
    };
    const info = roleMap[role] || {
      label: role,
      bg: "bg-gray-100 text-gray-700 border-gray-200",
      darkBg: "bg-gray-800 text-gray-300 border-gray-600",
    };
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${isDarkMode ? info.darkBg : info.bg}`}
      >
        {info.label}
      </span>
    );
  };

  const getVisibilityBadge = () => {
    if (comment.visibility === "all") return null;
    const label =
      comment.visibility === "admins_only"
        ? "🔒 Admins Only"
        : "🎓 Professors Only";
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          isDarkMode
            ? "bg-yellow-900/30 text-yellow-300 border border-yellow-700"
            : "bg-yellow-100 text-yellow-700 border border-yellow-200"
        }`}
      >
        {label}
      </span>
    );
  };

  const isResolved = comment.is_resolved;

  return (
    <div
      className={`border-l-4 pl-4 py-3 rounded-r-lg transition-all ${
        isResolved
          ? isDarkMode
            ? "border-green-600 bg-slate-800/30 opacity-70"
            : "border-green-400 bg-green-50/50 opacity-70"
          : isDarkMode
            ? "border-blue-500 bg-slate-700/50"
            : "border-blue-500 bg-gray-50"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${
              isResolved
                ? "bg-green-500"
                : isDarkMode
                  ? "bg-blue-600"
                  : "bg-blue-500"
            }`}
          >
            {comment.commenter_name?.charAt(0)?.toUpperCase() || "?"}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-medium text-sm ${isDarkMode ? "text-white" : "text-gray-900"}`}
              >
                {comment.commenter_name}
              </span>
              {getRoleBadge(comment.commenter_role)}
              {getVisibilityBadge()}
            </div>
            <span
              className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}
            >
              {new Date(comment.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isResolved ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium">
              ✅ Resolved
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium">
              🔴 Unresolved
            </span>
          )}

          {canResolve() && (
            <button
              onClick={() => onResolve(comment.id)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                isResolved
                  ? isDarkMode
                    ? "bg-yellow-900/30 text-yellow-300 hover:bg-yellow-800/50"
                    : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  : isDarkMode
                    ? "bg-green-900/30 text-green-300 hover:bg-green-800/50"
                    : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
              title={isResolved ? "Mark as unresolved" : "Mark as resolved"}
            >
              {isResolved ? "Unresolve" : "Resolve"}
            </button>
          )}

          {canDelete() && (
            <button
              onClick={() => onDelete(comment.id)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                isDarkMode
                  ? "bg-red-900/30 text-red-300 hover:bg-red-800/50"
                  : "bg-red-100 text-red-700 hover:bg-red-200"
              }`}
              title={
                deleteTimeLeft ? `Delete (${deleteTimeLeft} left)` : "Delete"
              }
            >
              🗑{" "}
              {deleteTimeLeft && <span className="ml-1">{deleteTimeLeft}</span>}
            </button>
          )}
        </div>
      </div>

      <p
        className={`text-sm whitespace-pre-wrap ${
          isResolved
            ? isDarkMode
              ? "text-slate-400 line-through decoration-1"
              : "text-gray-500"
            : isDarkMode
              ? "text-slate-200"
              : "text-gray-700"
        }`}
      >
        {comment.comment_text}
      </p>

      {isResolved && comment.resolved_at && (
        <p
          className={`text-xs mt-1 ${isDarkMode ? "text-slate-500" : "text-gray-400"}`}
        >
          Resolved{" "}
          {new Date(comment.resolved_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
