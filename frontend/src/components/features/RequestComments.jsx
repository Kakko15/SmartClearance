import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { getClearanceComments, createClearanceComment } from "../../services/api";
import { ChatBubbleIcon } from "../ui/Icons";
import useRealtimeSubscription from "../../hooks/useRealtimeSubscription";

export default function RequestComments({
  requestId,
  userId,
  isDarkMode = false,
}) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyText, setReplyText] = useState("");

  const loadingTimerRef = useRef(null);

  const fetchComments = useCallback(async () => {
    loadingTimerRef.current = setTimeout(() => setLoading(true), 150);
    try {
      const response = await getClearanceComments(requestId, userId);
      if (response.success) {
        setComments(response.comments || []);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      setLoading(false);
    }
  }, [requestId, userId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Live updates when comments are added/updated/deleted
  useRealtimeSubscription("clearance_comments", fetchComments, {
    filter: `clearance_id=eq.${requestId}`,
  });

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setSubmitting(true);
    try {
      const response = await createClearanceComment(
        requestId,
        userId,
        replyText.trim(),
        "all"
      );
      if (response.success) {
        toast.success("Reply sent successfully");
        setReplyText("");
        
        // Let postgres_changes handle cross-client sync
        fetchComments();
      } else {
        toast.error(response.error || "Failed to post reply");
      }
    } catch (error) {
      toast.error("Error posting reply: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const unresolvedCount = comments.filter((c) => !c.is_resolved && c.commenter_id !== userId).length;

  if (loading) {
    return (
      <div className={`mt-2 rounded-2xl border transition-all duration-300 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-[#dadce0] shadow-[0_1px_2px_0_rgba(60,64,67,0.1)]"}`}>
        <div className={`px-5 py-4 border-b flex items-center justify-between ${isDarkMode ? "border-[#3c4043] bg-[#2d2f31]" : "border-[#e8eaed] bg-slate-50/50"}`}>
          <div className="flex items-center gap-2">
            <div className={`w-[18px] h-[18px] rounded-full animate-pulse ${isDarkMode ? "bg-[#5f6368]" : "bg-blue-200"}`} />
            <h4 className={`h-4 w-40 rounded animate-pulse ${isDarkMode ? "bg-[#5f6368]" : "bg-gray-200"}`} />
          </div>
        </div>
        <div className={`p-6 text-center flex flex-col items-center justify-center transition-colors ${isDarkMode ? "bg-[#202124]/50" : "bg-[#f8fafd]"}`}>
           <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 animate-pulse ${isDarkMode ? "bg-[#3c4043]" : "bg-gray-200"}`} />
           <div className={`h-4 w-32 rounded animate-pulse mb-2 ${isDarkMode ? "bg-[#5f6368]" : "bg-gray-200"}`} />
           <div className={`h-3 w-48 rounded animate-pulse ${isDarkMode ? "bg-[#3c4043]" : "bg-gray-100"}`} />
        </div>
        <div className={`p-4 border-t ${isDarkMode ? "border-[#3c4043] bg-[#2d2f31]" : "border-[#e8eaed] bg-white"}`}>
          <div className={`w-full rounded-2xl border py-3.5 pl-4 flex items-center animate-pulse ${isDarkMode ? "bg-[#202124] border-[#5f6368]" : "bg-[#f1f3f4] border-transparent"}`} style={{ minHeight: '52px' }}>
            <div className={`h-4 w-48 rounded ${isDarkMode ? "bg-[#5f6368]" : "bg-gray-200"}`} />
          </div>
        </div>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className={`mt-2 rounded-2xl border transition-all duration-300 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-[#dadce0] shadow-[0_1px_2px_0_rgba(60,64,67,0.1)]"}`}>
         <div className={`px-5 py-4 border-b flex items-center justify-between ${isDarkMode ? "border-[#3c4043] bg-[#2d2f31]" : "border-[#e8eaed] bg-slate-50/50"}`}>
        <div className="flex items-center gap-2">
          <ChatBubbleIcon className={`w-[18px] h-[18px] ${isDarkMode ? "text-primary-400" : "text-primary-600"}`} />
          <h4 className={`text-[14px] font-medium tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
            Feedback & Comments
          </h4>
        </div>
      </div>
      <div className={`p-6 text-center transition-colors ${isDarkMode ? "bg-[#202124]/50" : "bg-[#f8fafd]"}`}>
        <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 ${isDarkMode ? "bg-[#3c4043]" : "bg-white border border-[#e8eaed] shadow-sm"}`}>
          <ChatBubbleIcon className={`w-6 h-6 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`} />
        </div>
        <p className={`text-[14px] font-medium tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>No feedback yet</p>
        <p className={`text-[13px] mt-1 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
          When reviewers leave comments, they will appear here.
        </p>
      </div>
       <div className={`p-4 border-t ${isDarkMode ? "border-[#3c4043] bg-[#2d2f31]" : "border-[#e8eaed] bg-white"}`}>
        <form onSubmit={handleReplySubmit} className="relative flex items-end gap-3">
          <textarea
            disabled={submitting}
            placeholder="Reply to this thread..."
            className={`w-full flex-1 resize-none rounded-2xl border pl-4 pr-12 py-3.5 text-[14px] focus:outline-none focus:ring-1 transition-all max-h-[140px] ${isDarkMode ? "bg-[#202124] border-[#5f6368] text-[#e8eaed] placeholder-[#9aa0a6] focus:border-primary-400 focus:ring-primary-400" : "bg-[#f1f3f4] border-transparent text-[#202124] placeholder-[#5f6368] hover:bg-[#e8eaed] focus:bg-white focus:border-primary-500 focus:ring-primary-500 shadow-inner"}`}
            style={{ minHeight: '52px', overflow: 'hidden' }}
            value={replyText}
            onChange={(e) => {
              setReplyText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = (e.target.scrollHeight) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleReplySubmit(e);
              }
            }}
            rows={1}
          />
          <button
            type="submit"
            disabled={submitting || !replyText.trim()}
            className={`absolute right-3 bottom-2.5 p-2 rounded-xl flex items-center justify-center transition-all ${submitting || !replyText.trim() ? "opacity-30 cursor-not-allowed" : isDarkMode ? "hover:bg-[#3c4043] bg-primary-900/30 text-primary-400" : "hover:bg-primary-50 active:scale-95 bg-primary-500 text-white shadow-md hover:shadow-lg hover:bg-primary-600"}`}
          >
            {submitting ? (
              <svg className="animate-spin h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
         <div className={`mt-2 flex justify-between items-center text-[11px] ${isDarkMode ? "text-[#5f6368]" : "text-[#9aa0a6]"}`}>
           <span></span>
           <span className="mr-1">Press <strong className="font-medium text-[12px]">Enter</strong> inside to send</span>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col mt-2 rounded-2xl overflow-hidden transition-all duration-300 ${isDarkMode ? "bg-[#282a2d] border border-[#3c4043]" : "bg-white border border-[#dadce0] shadow-[0_1px_2px_0_rgba(60,64,67,0.1)]"}`}>
      <div className={`px-5 py-4 border-b flex items-center justify-between ${isDarkMode ? "border-[#3c4043] bg-[#2d2f31]" : "border-[#e8eaed] bg-slate-50/50"}`}>
        <div className="flex items-center gap-2">
          <ChatBubbleIcon className={`w-[18px] h-[18px] ${isDarkMode ? "text-primary-400" : "text-primary-600"}`} />
          <h4 className={`text-[14px] font-medium tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
            Feedback & Comments
          </h4>
        </div>
        {unresolvedCount > 0 && (
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase ${isDarkMode ? "bg-[#fce8e6]/10 text-[#f28b82] border border-[#f28b82]/30" : "bg-[#fce8e6] text-[#c5221f] border border-[#f2b8b5]"}`}>
            {unresolvedCount} Unresolved
          </span>
        )}
      </div>

      <div className={`p-5 max-h-[360px] overflow-y-auto space-y-5 ${isDarkMode ? "bg-[#202124] scrollbar-thin scrollbar-thumb-[#3c4043]" : "bg-[#f8fafd] scrollbar-thin scrollbar-thumb-gray-200"}`}>
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-4">
            <div className={`w-[36px] h-[36px] rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[13px] text-white shadow-sm ${comment.is_resolved ? "bg-[#34a853]" : "bg-primary-500"}`}>
              {comment.commenter_name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0 flex flex-col items-start">
              <div className="flex items-baseline justify-between gap-2 mb-1 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium text-[14px] ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
                    {comment.commenter_name}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-semibold tracking-wider ${comment.commenter_role === "signatory" || comment.commenter_role === "department_head" ? isDarkMode ? "bg-purple-900/30 text-purple-300 border-purple-800/50" : "bg-purple-50 text-purple-700 border-purple-200" : isDarkMode ? "bg-blue-900/30 text-blue-300 border-blue-800/50" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                    {comment.commenter_role === "signatory" ? "Signatory" : comment.commenter_role === "librarian" ? "Library" : comment.commenter_role === "cashier" ? "Cashier" : comment.commenter_role === "registrar" ? "Registrar" : comment.commenter_role === "student" ? "Student" : "Staff"}
                  </span>
                </div>
                {comment.created_at && (
                  <span className={`text-[12px] whitespace-nowrap ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                    {new Date(comment.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <div className={`mt-1 py-2.5 px-4 rounded-[16px] rounded-tl-[4px] text-[14px] leading-relaxed relative max-w-[90%] inline-block ${comment.is_resolved ? (isDarkMode ? "bg-[#3c4043]/50 text-[#9aa0a6]" : "bg-white border border-[#e8eaed] text-[#5f6368] opacity-75") : (isDarkMode ? "bg-[#3c4043] text-[#e8eaed]" : "bg-white shadow-sm border border-[#e8eaed] text-[#202124]")}`}>
                {comment.comment_text.replace(/^\[TO:[^\]]+\]\s*/, "")}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={`p-4 border-t ${isDarkMode ? "border-[#3c4043] bg-[#2d2f31]" : "border-[#e8eaed] bg-white"}`}>
        <form onSubmit={handleReplySubmit} className="relative flex items-end gap-3">
          <textarea
            disabled={submitting}
            placeholder="Reply to this thread..."
            className={`w-full flex-1 resize-none rounded-2xl border pl-4 pr-12 py-3.5 text-[14px] focus:outline-none focus:ring-1 transition-all max-h-[140px] ${isDarkMode ? "bg-[#202124] border-[#5f6368] text-[#e8eaed] placeholder-[#9aa0a6] focus:border-primary-400 focus:ring-primary-400" : "bg-[#f1f3f4] border-transparent text-[#202124] placeholder-[#5f6368] hover:bg-[#e8eaed] focus:bg-white focus:border-primary-500 focus:ring-primary-500 shadow-inner"}`}
            style={{ minHeight: '52px', overflow: 'hidden' }}
            value={replyText}
            onChange={(e) => {
              setReplyText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = (e.target.scrollHeight) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleReplySubmit(e);
              }
            }}
            rows={1}
          />
          <button
            type="submit"
            disabled={submitting || !replyText.trim()}
            className={`absolute right-3 bottom-2.5 p-2 rounded-xl flex items-center justify-center transition-all ${submitting || !replyText.trim() ? "opacity-30 cursor-not-allowed" : isDarkMode ? "hover:bg-[#3c4043] bg-primary-900/30 text-primary-400" : "hover:bg-primary-50 active:scale-95 bg-primary-500 text-white shadow-md hover:shadow-lg hover:bg-primary-600"}`}
          >
            {submitting ? (
              <svg className="animate-spin h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
        <div className={`mt-2 flex justify-between items-center text-[11px] ${isDarkMode ? "text-[#5f6368]" : "text-[#9aa0a6]"}`}>
           <span></span>
           <span className="mr-1">Press <strong className="font-medium text-[12px]">Enter</strong> inside to send</span>
        </div>
      </div>
    </div>
  );
}
