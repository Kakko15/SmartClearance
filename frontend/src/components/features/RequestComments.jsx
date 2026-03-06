import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  getClearanceComments,
  createClearanceComment,
  resolveClearanceComment,
  deleteClearanceComment,
} from "../../services/api";
import CommentCard from "./CommentCard";
import AddCommentForm from "./AddCommentForm";
import { ConfirmModal } from "../ui/Modal";

export default function RequestComments({
  requestId,
  userId,
  userRole = "student",
  isDarkMode = false,
}) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState({
    show: false,
    commentId: null,
  });

  const isStudent = userRole === "student";

  const fetchComments = useCallback(async () => {
    try {
      const response = await getClearanceComments(requestId, userId);
      if (response.success) {
        setComments(response.comments || []);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  }, [requestId, userId]);

  useEffect(() => {
    fetchComments();

    const interval = setInterval(fetchComments, 5000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  const handleCreateComment = async (commentText, visibility) => {
    setSubmitting(true);
    try {
      const response = await createClearanceComment(
        requestId,
        userId,
        commentText,
        visibility,
      );
      if (response.success) {
        toast.success("Comment posted!");
        fetchComments();
      } else {
        toast.error(response.error || "Failed to post comment");
      }
    } catch (error) {
      toast.error("Error posting comment: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (commentId) => {
    try {
      const response = await resolveClearanceComment(commentId, userId);
      if (response.success) {
        toast.success(response.message);
        fetchComments();
      } else {
        toast.error(response.error || "Failed to update comment");
      }
    } catch (error) {
      toast.error("Error: " + error.message);
    }
  };

  const handleDelete = (commentId) => {
    setDeleteConfirm({ show: true, commentId });
  };

  const confirmDelete = async () => {
    const { commentId } = deleteConfirm;
    setDeleteConfirm({ show: false, commentId: null });

    try {
      const response = await deleteClearanceComment(commentId, userId);
      if (response.success) {
        toast.success("Comment deleted!");
        fetchComments();
      } else {
        toast.error(response.error || "Failed to delete comment");
      }
    } catch (error) {
      toast.error("Error: " + error.message);
    }
  };

  const filteredComments = comments.filter((c) => {
    if (filter === "unresolved") return !c.is_resolved;
    if (filter === "resolved") return c.is_resolved;
    return true;
  });

  const unresolvedCount = comments.filter((c) => !c.is_resolved).length;
  const resolvedCount = comments.filter((c) => c.is_resolved).length;

  const getBadgeColor = () => {
    if (comments.length === 0)
      return isDarkMode
        ? "bg-slate-600 text-slate-300"
        : "bg-gray-200 text-gray-600";
    if (unresolvedCount > 0) return "bg-red-500 text-white";
    return "bg-green-500 text-white";
  };

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isDarkMode
          ? "bg-slate-800/50 border-slate-600"
          : "bg-white border-gray-200"
      }`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-4 transition-colors ${
          isDarkMode ? "hover:bg-slate-700/50" : "hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              isDarkMode ? "bg-blue-900/40" : "bg-blue-100"
            }`}
          >
            <svg
              className={`w-5 h-5 ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <div className="text-left">
            <h4
              className={`font-semibold text-sm ${isDarkMode ? "text-white" : "text-gray-900"}`}
            >
              Comments & Discussion
            </h4>
            <p
              className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}
            >
              {comments.length} comment{comments.length !== 1 ? "s" : ""}
              {unresolvedCount > 0 && ` · ${unresolvedCount} unresolved`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${getBadgeColor()}`}
          >
            {comments.length === 0
              ? "💬"
              : unresolvedCount > 0
                ? `🔴 ${unresolvedCount}`
                : "✅"}
          </span>

          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""} ${isDarkMode ? "text-slate-400" : "text-gray-400"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div
          className={`border-t p-4 ${isDarkMode ? "border-slate-600" : "border-gray-200"}`}
        >
          {!isStudent && (
            <div className="mb-4">
              <AddCommentForm
                onSubmit={handleCreateComment}
                isSubmitting={submitting}
                isDarkMode={isDarkMode}
              />
            </div>
          )}

          {comments.length > 0 && (
            <div className="flex gap-1 mb-4">
              {[
                { key: "all", label: "All", count: comments.length },
                {
                  key: "unresolved",
                  label: "Unresolved",
                  count: unresolvedCount,
                },
                { key: "resolved", label: "Resolved", count: resolvedCount },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    filter === tab.key
                      ? isDarkMode
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-blue-500 text-white shadow-md"
                      : isDarkMode
                        ? "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p
                className={`text-sm mt-2 ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}
              >
                Loading comments...
              </p>
            </div>
          ) : filteredComments.length === 0 ? (
            <div
              className={`text-center py-8 rounded-lg ${isDarkMode ? "bg-slate-700/30" : "bg-gray-50"}`}
            >
              <svg
                className={`w-10 h-10 mx-auto mb-2 ${isDarkMode ? "text-slate-500" : "text-gray-300"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p
                className={`text-sm ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}
              >
                {filter !== "all" ? `No ${filter} comments` : "No comments yet"}
              </p>
              {filter === "all" && !isStudent && (
                <p
                  className={`text-xs mt-1 ${isDarkMode ? "text-slate-500" : "text-gray-400"}`}
                >
                  Be the first to comment!
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredComments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  userId={userId}
                  userRole={userRole}
                  onResolve={handleResolve}
                  onDelete={handleDelete}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, commentId: null })}
        onConfirm={confirmDelete}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
