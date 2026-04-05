import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { getClearanceComments, createClearanceComment, updateClearanceComment, deleteClearanceComment, authAxios } from "../../services/api";
import { ChatBubbleIcon } from "../ui/Icons";
import { motion, AnimatePresence } from "framer-motion";
import useRealtimeSubscription from "../../hooks/useRealtimeSubscription";
import { useAuth } from "../../contexts/AuthContext";
import data from '@emoji-mart/data/sets/14/google.json';
import Picker from '@emoji-mart/react';

const applyRichTextFormat = (e, type) => {
  e.preventDefault();
  const parent = e.currentTarget.closest('.richtext-container');
  if (!parent) return;
  const textarea = parent.querySelector('textarea');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);
  
  let newText = '';
  let selLen = selectedText.length;
  
  if (type === 'clear' && !selLen) {
    const freshText = textarea.value.replace(/[*_]/g, '').replace(/^- /gm, '');
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    nativeInputValueSetter.call(textarea, freshText);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(freshText.length, freshText.length); }, 0);
    return;
  }

  switch (type) {
    case 'bold': newText = `**${selectedText || 'bold'}**`; break;
    case 'italic': newText = `*${selectedText || 'italic'}*`; break;
    case 'underline': newText = `__${selectedText || 'underline'}__`; break;
    case 'list': newText = `\n- ${selectedText || 'list item'}`; break;
    case 'clear': newText = selectedText.replace(/[*_]/g, '').replace(/^- /gm, ''); break;
  }
  
  const updatedText = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  nativeInputValueSetter.call(textarea, updatedText);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  
  setTimeout(() => {
    textarea.focus();
    if (!selLen && type !== 'clear') {
       let selStart = start;
       if (type === 'bold') selStart += 2;
       if (type === 'italic') selStart += 1;
       if (type === 'underline') selStart += 2;
       if (type === 'list') selStart += 3;
       textarea.setSelectionRange(selStart, selStart + (type === 'list' ? 9 : type === 'italic' ? 6 : type === 'bold' ? 4 : 9));
    } else {
       const newCursor = start + newText.length;
       textarea.setSelectionRange(newCursor, newCursor);
    }
  }, 0);
};

const renderMarkdown = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  return <div className="space-y-[2px]">{lines.map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-1"></div>;
    const isList = line.trim().startsWith('- ');
    let content = isList ? line.substring(line.indexOf('- ') + 2) : line;
    
    // Split by markdown tags
    const parts = content.split(/(\*\*.*?\*\*|__.*?__|\*.*?\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('__') && part.endsWith('__')) {
        return <u key={j} style={{ textUnderlineOffset: '2px' }}>{part.slice(2, -2)}</u>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={j} className="italic">{part.slice(1, -1)}</em>;
      }
      return part;
    });

    if (isList) {
      return (
        <div key={i} className="flex gap-2">
          <span className="select-none font-bold mx-0.5">•</span>
          <div>{parts}</div>
        </div>
      );
    }
    return <div key={i}>{parts}</div>;
  })}</div>;
};

export default function RequestComments({
  requestId,
  userId,
  isDarkMode = false,
}) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(null);
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState(false);

  const [optimisticReactions, setOptimisticReactions] = useState({});
  const reactionTimers = useRef({});
  const pendingReactionActions = useRef({});
  const virtualIds = useRef({});
  const deletedVirtualIds = useRef(new Set());

  useEffect(() => {
    setOptimisticReactions(prev => {
       const newStates = { ...prev };
       for (const key in newStates) {
          if (!pendingReactionActions.current[key]) {
             delete newStates[key];
          }
       }
       return newStates;
    });
  }, [comments]);

  const REACTION_REGEX = /^\[\[REAC:([a-z]+):([a-zA-Z0-9-]+)\]\]$/i;
  const validComments = [];
  const reactionComments = [];
  
  comments.forEach(c => {
    const match = c.comment_text.match(REACTION_REGEX);
    if (match) {
      reactionComments.push({ ...c, reacType: match[1].toLowerCase(), targetId: match[2] });
    } else {
      validComments.push(c);
    }
  });

  const getReactionsForComment = (commentId) => {
    const strCommentId = String(commentId);
    const reacs = reactionComments.filter(r => r.targetId === strCommentId);
    const latestPerUser = {};
    reacs.forEach(r => {
      if (!latestPerUser[r.commenter_id] || new Date(r.created_at) > new Date(latestPerUser[r.commenter_id].created_at)) {
        latestPerUser[r.commenter_id] = r;
      }
    });
    
    let activeReactions = Object.values(latestPerUser);
    
    // Apply Optimistic Override if exists
    const optObj = optimisticReactions[strCommentId];
    if (optObj) {
      if (optObj.action === 'DELETE') {
         activeReactions = activeReactions.filter(r => r.commenter_id !== userId);
      } else if (optObj.action === 'SET') {
         const existing = activeReactions.find(r => r.commenter_id === userId);
         if (existing) {
            existing.reacType = optObj.type;
         } else {
            activeReactions.push({ commenter_id: userId, reacType: optObj.type });
         }
      }
    }
    
    const counts = {};
    activeReactions.forEach(r => {
      counts[r.reacType] = (counts[r.reacType] || 0) + 1;
    });
    
    return { counts, userReaction: activeReactions.find(r => r.commenter_id === userId) || null, activeReactions };
  };

  const getDbReaction = (commentId) => {
    const strCommentId = String(commentId);
    const reacs = reactionComments.filter(r => r.targetId === strCommentId && r.commenter_id === userId);
    if (reacs.length === 0) return null;
    const latest = reacs.reduce((latest, r) => new Date(r.created_at) > new Date(latest.created_at) ? r : latest);
    if (deletedVirtualIds.current.has(latest.id)) return null;
    return latest;
  };

  const handleToggleReaction = (commentId, type) => {
    const strCommentId = String(commentId);
    
    setOptimisticReactions(prev => {
      const dbReaction = getDbReaction(commentId);
      const existingOpt = prev[strCommentId];
      
      let currentState = null;
      if (existingOpt) {
        if (existingOpt.action === 'SET') currentState = existingOpt.type;
      } else if (dbReaction) {
        currentState = dbReaction.reacType;
      }

      let newAction;
      let newType;
       
      if (currentState === type) {
          newAction = 'DELETE';
          newType = null;
      } else {
          newAction = 'SET';
          newType = type;
      }
       
      const nextState = {
         ...prev,
         [strCommentId]: { action: newAction, type: newType }
      };
      pendingReactionActions.current[strCommentId] = nextState[strCommentId];
      return nextState;
    });

    if (reactionTimers.current[strCommentId]) {
      clearTimeout(reactionTimers.current[strCommentId]);
    }

    reactionTimers.current[strCommentId] = setTimeout(async () => {
      const finalOpt = pendingReactionActions.current[strCommentId];
      if (!finalOpt) return;
      delete pendingReactionActions.current[strCommentId];

      const dbReaction = getDbReaction(commentId);

      try {
        if (finalOpt.action === 'DELETE') {
          const idToDelete = dbReaction?.id || virtualIds.current[strCommentId];
          if (idToDelete) {
            deletedVirtualIds.current.add(idToDelete);
            await authAxios.delete(`/comments/${idToDelete}`);
            delete virtualIds.current[strCommentId];
            fetchComments({ showLoading: false });
          }
        } else if (finalOpt.action === 'SET') {
          const existingId = dbReaction?.id || virtualIds.current[strCommentId];
          if (existingId) {
            if (dbReaction?.reacType !== finalOpt.type) {
              await authAxios.put(`/comments/${existingId}`, { user_id: userId, comment_text: `[[REAC:${finalOpt.type}:${commentId}]]` });
              fetchComments({ showLoading: false });
            }
          } else {
            const res = await authAxios.post(`/comments/${requestId}/comments`, { user_id: userId, comment_text: `[[REAC:${finalOpt.type}:${commentId}]]`, visibility: "all" });
            if (res?.data?.comment?.id) {
               virtualIds.current[strCommentId] = res.data.comment.id;
            }
            fetchComments({ showLoading: false });
          }
        }
      } catch (e) {
        if (e.response?.status !== 404) {
          toast.error("Failed to update reaction");
        }
        setOptimisticReactions(prev => {
           const newObj = { ...prev };
           delete newObj[strCommentId];
           return newObj;
        });
      }
    }, 400);
  };

  const REACTION_TYPES = [
    { id: "like", icon: "👍", name: "Like" },
    { id: "love", icon: "❤️", name: "Love" },
    { id: "care", icon: "🤗", name: "Care" },
    { id: "haha", icon: "😂", name: "Haha" },
    { id: "wow", icon: "😮", name: "Wow" },
    { id: "sad", icon: "😢", name: "Sad" },
    { id: "angry", icon: "😡", name: "Angry" },
  ];

  const loadingTimerRef = useRef(null);

  const fetchComments = useCallback(async (options) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = setTimeout(() => setLoading(true), 150);
    }
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
        // Let postgres_changes handle cross-client sync completely
      } else {
        toast.error(response.error || "Failed to post reply");
      }
    } catch (error) {
      toast.error("Error posting reply: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async (commentId, originalTag) => {
    if (!editCommentText.trim()) return;
    
    const finalComment = originalTag ? `${originalTag} ${editCommentText.trim()}` : editCommentText.trim();
    
    // OPTIMISTIC UPDATE: Instant UI response
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, comment_text: finalComment } : c));
    setEditingCommentId(null);
    
    try {
      const response = await updateClearanceComment(commentId, userId, finalComment);
      if (response.success) {
        toast.success("Comment updated successfully");
        // Optimistic UI provides instant feedback, postgres_changes syncs it permanently
      } else {
        toast.error(response.error || "Failed to update comment");
        fetchComments({ showLoading: false }); // rollback
      }
    } catch (error) {
      toast.error("Failed to update comment: " + error.message);
      fetchComments({ showLoading: false }); // rollback
    }
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    
    // OPTIMISTIC DELETE
    setComments(prev => prev.filter(c => c.id !== commentId));
    
    try {
      const response = await deleteClearanceComment(commentId);
      if (response.success) {
        toast.success("Comment deleted successfully");
        // Optimitic UI deleted it, postgres_changes syncs it permanently
      } else {
        toast.error(response.error || "Failed to delete comment");
      }
    } catch (error) {
      toast.error("Failed to delete comment: " + error.message);
    }
  };

  const unresolvedCount = validComments.filter((c) => !c.is_resolved && c.commenter_id !== userId).length;



  if (validComments.length === 0) {
    return (
      <div className={`flex flex-col mt-4 pt-4 border-t transition-all duration-300 ${isDarkMode ? "border-[#3c4043]" : "border-[#e8eaed]"}`}>
        <div className={`px-2 py-2 mb-2 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <ChatBubbleIcon className={`w-[18px] h-[18px] ${isDarkMode ? "text-primary-400" : "text-primary-600"}`} />
            <h4 className={`text-[14px] font-medium tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
              Feedback & Comments
            </h4>
          </div>
        </div>
        <div className={`mt-4 pt-4 border-t flex flex-col items-center justify-center p-6 transition-colors ${isDarkMode ? "border-[#3c4043] text-[#9aa0a6]" : "border-[#e8eaed] text-[#5f6368]"}`}>
          <ChatBubbleIcon className="w-6 h-6 mb-2 opacity-50" />
          <p className="text-[14px] font-medium tracking-tight" style={{ fontFamily: "Google Sans, sans-serif" }}>No feedback yet.</p>
        </div>
        <div className="pt-3 pb-4 pr-[18px] bg-transparent">
          <form onSubmit={handleReplySubmit} className="flex items-end gap-[13px] group/form">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px] overflow-hidden text-white shadow-sm flex-shrink-0 mb-[7px] ${isDarkMode ? "bg-blue-600/80 p-0" : "bg-primary-500"}`}>
              {user?.user_metadata?.avatar_url || profile?.avatar_url ? (
                <img src={user?.user_metadata?.avatar_url || profile?.avatar_url} alt="You" className="w-full h-full object-cover" />
              ) : (
                (profile?.full_name?.charAt(0) || user?.user_metadata?.full_name?.charAt(0) || "U").toUpperCase()
              )}
            </div>
            <div className={`flex-1 flex flex-col transition-all duration-300 relative group/input bg-white border ${replyText.trim().length > 0 ? "rounded-[16px] border-primary-600 ring-1 ring-primary-600" : "rounded-[24px] focus-within:rounded-[16px] border-[#dadce0] focus-within:border-primary-600 focus-within:ring-1 focus-within:ring-primary-600"} ${isDarkMode ? "!bg-transparent !border-[#5f6368] focus-within:!border-primary-400 focus-within:!ring-primary-400" : ""}`}>
              <textarea
                disabled={submitting}
                placeholder="Add a comment..."
                className={`w-full resize-none bg-transparent outline-none px-4 py-[11px] text-[14px] leading-relaxed ${isDarkMode ? "text-[#e8eaed] placeholder-[#9aa0a6]" : "text-[#202124] placeholder-[#5f6368]"}`}
                style={{ minHeight: '44px', overflow: 'hidden' }}
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
                className={`absolute right-2 bottom-1.5 p-1.5 rounded-full flex items-center justify-center transition-all ${submitting || !replyText.trim() ? "opacity-30 cursor-not-allowed text-gray-500" : isDarkMode ? "text-primary-400 hover:bg-primary-900/30" : "text-primary-600 hover:bg-primary-50 active:scale-95"}`}
              >
                {submitting ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 -rotate-45 ml-0.5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </form>
          <div className={`mt-2 flex justify-between items-center text-[10px] ${isDarkMode ? "text-[#5f6368]" : "text-[#9aa0a6]"}`}>
            <span></span>
            <span className="mr-8 pr-1">Press <strong className="font-medium text-[11px]">Enter</strong> inside to send</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col mt-4 pt-4 border-t transition-all duration-300 ${isDarkMode ? "border-[#3c4043]" : "border-[#e8eaed]"}`}>
      <div className={`px-2 py-2 mb-2 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <ChatBubbleIcon className={`w-[18px] h-[18px] ${isDarkMode ? "text-primary-400" : "text-primary-600"}`} />
          <h4 className={`text-[14px] font-medium tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
            Feedback & Comments
          </h4>
        </div>
        {unresolvedCount > 0 && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-[0.05em] uppercase border shadow-sm transition-colors ${isDarkMode ? "bg-[#3c4043] text-[#9aa0a6] border-[#5f6368]" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
            {unresolvedCount === 1 ? "1 COMMENT" : `${unresolvedCount} COMMENTS`}
          </span>
        )}
      </div>

      <div className={`px-2 py-4 space-y-5 bg-transparent`}>
        {validComments.map((comment) => (
          <div key={comment.id} className="group flex gap-4 text-left">
            <div className={`w-[36px] h-[36px] mt-1 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[13px] overflow-hidden text-white shadow-sm ${comment.is_resolved ? (isDarkMode ? "bg-emerald-600/80" : "bg-[#34a853]") : (isDarkMode ? "bg-blue-600/80" : "bg-primary-500")}`}>
              {(comment.commenter_id === userId && (user?.user_metadata?.avatar_url || profile?.avatar_url)) ? (
                <img src={user?.user_metadata?.avatar_url || profile?.avatar_url} alt="You" className="w-full h-full object-cover" />
              ) : comment.avatar_url ? (
                <img src={comment.avatar_url} alt={comment.commenter_name} className="w-full h-full object-cover" />
              ) : (
                comment.commenter_name?.charAt(0).toUpperCase() || "?"
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col items-start relative">
              <div className="flex items-baseline justify-between gap-2 mb-1 w-full relative">
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
              <div className="relative w-full flex flex-col items-start overflow-visible">
                  {editingCommentId === comment.id ? (
                    <motion.div
                      key="edit"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="w-full mt-1.5 relative group/edit-input richtext-container flex flex-col z-10"
                    >
                      <div 
                        className={`relative z-10 transition-all duration-300 border bg-white focus-within:ring-1 focus-within:ring-primary-600 focus-within:border-primary-600 ${isDarkMode ? "!bg-transparent !border-[#5f6368] focus-within:!border-primary-400 focus-within:!ring-primary-400" : "border-[#dadce0]"}`}
                        style={{ borderRadius: "12px" }}
                      >
                        <textarea
                          autoFocus
                          value={editCommentText}
                          onChange={(e) => {
                            setEditCommentText(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          className={`w-full px-4 py-[11px] text-[14px] leading-relaxed resize-none bg-transparent outline-none ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
                          style={{ minHeight: '60px', overflow: 'hidden' }}
                          rows={1}
                        />
                        {/* Embedded Formatter for Editing */}
                        <div className={`flex items-center gap-[5px] px-3 pb-2 transition-opacity duration-200 text-[#5f6368] ${isDarkMode ? "text-[#9aa0a6]" : ""}`}>
                          <button type="button" onMouseDown={(e) => applyRichTextFormat(e, 'bold')} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
                            <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Bold</div>
                          </button>
                          <button type="button" onMouseDown={(e) => applyRichTextFormat(e, 'italic')} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
                            <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Italic</div>
                          </button>
                          <button type="button" onMouseDown={(e) => applyRichTextFormat(e, 'underline')} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>
                            <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Underline</div>
                          </button>
                          <button type="button" onMouseDown={(e) => applyRichTextFormat(e, 'list')} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>
                            <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Bulleted list</div>
                          </button>
                          <button type="button" onMouseDown={(e) => applyRichTextFormat(e, 'clear')} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/></svg>
                            <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Clear formatting</div>
                          </button>
                          <button type="button" onMouseDown={(e) => { e.preventDefault(); setShowEditEmojiPicker(showEditEmojiPicker === comment.id ? null : comment.id); }} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
                            <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Insert emoji</div>
                          </button>
                        </div>
                        {/* Floating Picker for Editing */}
                        {showEditEmojiPicker === comment.id && (
                          <div className="absolute bottom-full mb-2 left-0 z-[150] rounded-[16px] overflow-hidden shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)]" onMouseDown={(e) => e.stopPropagation()}>
                            <Picker 
                              data={data}
                              theme={isDarkMode ? 'dark' : 'light'} 
                              set="google"
                              previewPosition="none"
                              skinTonePosition="none"
                              navPosition="top"
                              perLine={8}
                              maxFrequentRows={0}
                              onEmojiSelect={(emoji) => {
                                const textarea = document.querySelector(`.richtext-container textarea`);
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const currentVal = textarea.value;
                                const newVal = currentVal.substring(0, start) + emoji.native + currentVal.substring(end);
                                setEditCommentText(newVal);
                                setShowEditEmojiPicker(null);
                                textarea.focus();
                                setTimeout(() => textarea.setSelectionRange(start + emoji.native.length, start + emoji.native.length), 0);
                              }} 
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-end gap-2 mt-2 px-1">
                        <button onClick={() => setEditingCommentId(null)} className={`px-4 py-[7px] text-[14px] font-bold transition-colors ${isDarkMode ? "text-primary-400 hover:bg-primary-900/20" : "text-[#5f6368] hover:bg-black/5"} rounded-[4px]`} style={{ fontFamily: "Google Sans, sans-serif" }}>CANCEL</button>
                        <button onClick={() => submitEdit(comment.id, comment.comment_text.match(/^(\[TO:[^\]]+\]\s*)/)?.[1]?.trim() || "")} className={`px-4 py-[7px] text-[14px] font-bold transition-colors ${isDarkMode ? "bg-primary-900/60 text-primary-200 hover:bg-primary-800/80" : "bg-primary-500 text-white hover:bg-primary-600 hover:shadow shadow-sm border border-transparent hover:border-black/10"} rounded-[4px]`} style={{ fontFamily: "Google Sans, sans-serif" }}>SAVE CHANGES</button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="view"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className={`mt-1 py-2.5 px-4 rounded-tl-[4px] text-[14px] leading-relaxed inline-block max-w-[calc(100%-80px)] sm:max-w-max break-words relative z-10 group/bubble ${comment.is_resolved ? (isDarkMode ? "bg-[#3c4043]/50 text-[#9aa0a6]" : "bg-white border border-[#e8eaed] text-[#5f6368] opacity-75") : (isDarkMode ? "bg-[#3c4043] text-[#e8eaed]" : "bg-white shadow-sm border border-[#e8eaed] text-[#202124]")}`}
                      style={{ borderRadius: "16px", borderTopLeftRadius: "4px" }}
                    >
                      {(() => {
                          const reacs = getReactionsForComment(comment.id);
                          const hasReactions = reacs.activeReactions.length > 0;
                          return (
                            <>
                              <div className="whitespace-pre-wrap">{renderMarkdown(comment.comment_text.replace(/^\[TO:[^\]]+\]\s*/, ""))}</div>
                              
                              {hasReactions && (
                                <div className={`absolute -bottom-2 -right-2 flex items-center gap-[2px] px-1.5 py-0.5 rounded-full shadow-sm text-[11px] font-bold z-10 ${isDarkMode ? "bg-[#28292a] border border-[#3c4043] text-[#e8eaed]" : "bg-white border border-slate-200 text-slate-600"}`}>
                                  <div className="flex -space-x-1">
                                    {Object.keys(reacs.counts).slice(0, 3).map((rType) => (
                                      <span key={rType} className="z-10 bg-inherit rounded-full">{REACTION_TYPES.find(r => r.id === rType)?.icon}</span>
                                    ))}
                                  </div>
                                  {reacs.activeReactions.length > 1 && <span className="ml-[1px] font-medium text-[10.5px]">{reacs.activeReactions.length}</span>}
                                </div>
                              )}
                              
                              {/* Reaction & Action Trigger Button (Hover) */}
                              <div className="absolute top-1/2 -translate-y-1/2 left-[calc(100%+8px)] opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-200 flex items-center gap-1 z-20 before:absolute before:inset-0 before:-top-4 before:-bottom-4 before:z-[-1]">
                                 <div className="relative group/reaction flex items-center">
                                   <button className={`p-[5.5px] rounded-full hover:scale-110 active:scale-95 transition-all ${isDarkMode ? "text-slate-400 hover:text-yellow-400 bg-[#303134]" : "text-slate-400 hover:text-yellow-500 bg-white shadow-sm border border-slate-100"}`}>
                                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                   </button>
                                   
                                   <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-1.5 rounded-[32px] shadow-xl flex gap-[2px] opacity-0 pointer-events-none group-hover/reaction:opacity-100 group-hover/reaction:pointer-events-auto transition-all duration-200 origin-bottom scale-95 group-hover/reaction:scale-100 after:content-[''] after:absolute after:-bottom-4 after:left-0 after:w-full after:h-4 ${isDarkMode ? "bg-[#28292a] border border-[#3c4043]" : "bg-white border border-slate-100"}`}>
                                     {REACTION_TYPES.map(rt => (
                                       <button key={rt.id} onClick={(e) => { e.stopPropagation(); handleToggleReaction(comment.id, rt.id); }} className={`hover:scale-125 hover:-translate-y-2 transition-all duration-200 text-[20px] px-[2px] relative transform-gpu hover:z-30 rounded-full w-[30px] h-[30px] flex items-center justify-center ${reacs.userReaction?.reacType === rt.id ? (isDarkMode ? 'bg-primary-900/30 ring-1 ring-primary-500/50' : 'bg-primary-50 ring-1 ring-primary-300') : ''}`} title={rt.name}>
                                         <span className="leading-none drop-shadow-sm">{rt.icon}</span>
                                       </button>
                                     ))}
                                   </div>
                                 </div>

                                 {comment.commenter_id === userId && (
                                   <>
                                      <button onClick={(e) => { e.stopPropagation(); setEditCommentText(comment.comment_text.replace(/^\[TO:[^\]]+\]\s*/, "")); setEditingCommentId(comment.id); }} className={`group/btn relative p-1.5 rounded-full hover:scale-110 active:scale-95 transition-all ${isDarkMode ? "text-slate-400 hover:text-primary-400 bg-[#303134]" : "text-slate-400 hover:text-primary-600 bg-white shadow-sm border border-slate-100"}`}>
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>
                                          Edit
                                        </div>
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); deleteComment(comment.id); }} className={`group/btn relative p-1.5 rounded-full hover:scale-110 active:scale-95 transition-all ${isDarkMode ? "text-slate-400 hover:text-rose-400 bg-[#303134]" : "text-slate-400 hover:text-rose-500 bg-white shadow-sm border border-slate-100"}`}>
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>
                                          Delete
                                        </div>
                                      </button>
                                   </>
                                 )}
                              </div>
                            </>
                          );
                      })()}
                    </motion.div>
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 pb-4 pr-[18px] bg-transparent">
        <form onSubmit={handleReplySubmit} className="flex items-end gap-[13px] group/form">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px] overflow-hidden text-white shadow-sm flex-shrink-0 mb-[7px] ${isDarkMode ? "bg-blue-600/80 p-0" : "bg-primary-500"}`}>
            {(user?.user_metadata?.avatar_url || profile?.avatar_url) ? (
              <img src={user?.user_metadata?.avatar_url || profile?.avatar_url} alt="You" className="w-full h-full object-cover" />
            ) : (
              (profile?.full_name?.charAt(0) || user?.user_metadata?.full_name?.charAt(0) || "U").toUpperCase()
            )}
          </div>
          <div className={`flex-1 flex flex-col transition-all duration-300 relative group/input bg-white border richtext-container ${replyText.trim().length > 0 ? "rounded-[16px] border-primary-600 ring-1 ring-primary-600" : "rounded-[24px] focus-within:rounded-[12px] border-[#dadce0] focus-within:border-primary-600 focus-within:ring-1 focus-within:ring-primary-600"} ${isDarkMode ? "!bg-transparent !border-[#5f6368] focus-within:!border-primary-400 focus-within:!ring-primary-400" : ""}`}>
            <textarea
              disabled={submitting}
              placeholder="Add a comment..."
              className={`w-full resize-none bg-transparent outline-none px-4 py-[11px] text-[14px] leading-relaxed ${isDarkMode ? "text-[#e8eaed] placeholder-[#9aa0a6]" : "text-[#202124] placeholder-[#5f6368]"}`}
              style={{ minHeight: '44px', overflow: 'hidden' }}
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
            {/* Formatting Toolbar */}
            <div className={`flex items-center gap-[5px] px-3 transition-all duration-200 text-[#5f6368] ${isDarkMode ? "text-[#9aa0a6]" : ""} ${replyText.trim() || showReplyEmojiPicker ? "opacity-100 h-[36px] pb-2 visible" : "opacity-0 h-0 invisible group-focus-within/input:opacity-100 group-focus-within/input:h-[36px] group-focus-within/input:pb-2 group-focus-within/input:visible"}`}>
              <button type="button" onMouseDown={(e) => applyRichTextFormat(e, 'bold')} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
                <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Bold</div>
              </button>
              <button type="button" onMouseDown={(e) => applyRichTextFormat(e, 'italic')} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
                <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Italic</div>
              </button>
              <button type="button" onMouseDown={(e) => applyRichTextFormat(e, 'underline')} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>
                <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Underline</div>
              </button>
              <button type="button" onMouseDown={(e) => applyRichTextFormat(e, 'list')} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>
                <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Bulleted list</div>
              </button>
              <button type="button" onMouseDown={(e) => applyRichTextFormat(e, 'clear')} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/></svg>
                <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Clear formatting</div>
              </button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); setShowReplyEmojiPicker(p => !p); }} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
                <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Insert emoji</div>
              </button>
            </div>
            
            {/* Floating Picker for Main Reply */}
            {showReplyEmojiPicker && (
              <div className="absolute bottom-full mb-2 left-0 z-[150] rounded-[16px] overflow-hidden shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)]" onMouseDown={(e) => e.stopPropagation()}>
                <Picker 
                  data={data}
                  theme={isDarkMode ? 'dark' : 'light'} 
                  set="google"
                  previewPosition="none"
                  skinTonePosition="none"
                  navPosition="top"
                  perLine={8}
                  maxFrequentRows={0}
                  onEmojiSelect={(emoji) => {
                    const textarea = document.querySelector(`.richtext-container textarea`);
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const currentVal = textarea.value;
                    const newVal = currentVal.substring(0, start) + emoji.native + currentVal.substring(end);
                    setReplyText(newVal);
                    setShowReplyEmojiPicker(false);
                    textarea.focus();
                    setTimeout(() => textarea.setSelectionRange(start + emoji.native.length, start + emoji.native.length), 0);
                  }} 
                />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting || !replyText.trim()}
            className={`flex-shrink-0 p-[5px] rounded-full mb-1 transition-colors ${submitting || !replyText.trim() ? "text-slate-400 cursor-not-allowed" : "text-primary-600 hover:bg-primary-50 active:scale-95"} ${isDarkMode && (submitting || !replyText.trim()) ? "!text-[#5f6368]" : isDarkMode && replyText.trim() ? "!text-primary-400 !hover:bg-[#3c4043]" : ""}`}
            title="Post comment"
          >
            {submitting ? (
              <svg className="animate-spin h-[22px] w-[22px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-[22px] h-[22px] -ml-[1px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
           </button>
        </form>
        <div className={`mt-[6px] pl-[56px] text-[#9aa0a6] text-[11px] font-medium tracking-tight ${isDarkMode ? "text-[#5f6368]" : ""}`}>
          Press <strong className="font-semibold text-slate-400">Enter</strong> inside to send
        </div>
      </div>
    </div>
  );
}
