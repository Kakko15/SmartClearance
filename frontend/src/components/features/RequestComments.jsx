import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  getClearanceComments,
  createClearanceComment,
  deleteClearanceComment,
  updateClearanceComment,
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

  const handleEdit = async (commentId, newText) => {
    try {
      const response = await updateClearanceComment(commentId, userId, newText);
      if (response.success) {
        toast.success("Comment updated!");
        fetchComments();
      } else {
        toast.error(response.error || "Failed to update comment");
      }
    } catch (error) {
      toast.error("Error updating comment: " + error.message);
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

  const getBadgeColor = () => {
    if (comments.length === 0)
      return isDarkMode
        ? "bg-slate-600 text-slate-300"
        : "bg-gray-200 text-gray-600";
    return "bg-blue-500 text-white";
  };

  return (
    <div
      className={`rounded-[16px] border transition-all ${
        isDarkMode
          ? "bg-[#282a2d] border-[#3c4043]"
          : "bg-white border-[#dadce0]"
      }`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-4 rounded-[16px] transition-colors ${
          isDarkMode ? "hover:bg-[#3c4043]/50" : "hover:bg-[#f8f9fa]"
        }`}
      >
        <div className="flex items-center gap-3 w-full">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isDarkMode ? "bg-[#8ab4f8]/20" : "bg-[#e8f0fe]"
            }`}
          >
            <svg
              className={`w-5 h-5 ${isDarkMode ? "text-[#8ab4f8]" : "text-[#1a73e8]"}`}
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
          <div className="text-left flex-1">
            <h4
              className={`font-medium text-[16px] leading-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
              style={{ fontFamily: 'Google Sans, sans-serif' }}
            >
              Comments & Discussion
            </h4>
            <p
              className={`text-[13px] mt-0.5 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
            >
              {comments.length} comment{comments.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span
            className={`text-[12px] font-medium px-2.5 py-0.5 rounded-full ${
              comments.length === 0 
                ? (isDarkMode ? "bg-[#3c4043] text-[#9aa0a6]" : "bg-[#f1f3f4] text-[#5f6368]") 
                : (isDarkMode ? "bg-[#8ab4f8] text-[#202124]" : "bg-[#1a73e8] text-white")
            }`}
          >
            {comments.length === 0 ? "0" : comments.length}
          </span>

          <svg
            className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""} ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
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
          className={`border-t px-4 pt-4 pb-5 rounded-b-[16px] ${isDarkMode ? "border-[#3c4043] bg-[#282a2d]" : "border-[#dadce0] bg-white"}`}
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



          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p
                className={`text-sm mt-2 ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}
              >
                Loading comments...
              </p>
            </div>
          ) : comments.length === 0 ? (
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
                No comments yet
              </p>
              {!isStudent && (
                <p
                  className={`text-xs mt-1 ${isDarkMode ? "text-slate-500" : "text-gray-400"}`}
                >
                  Be the first to comment!
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  userId={userId}
                  userRole={userRole}
                  onEdit={handleEdit}
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
