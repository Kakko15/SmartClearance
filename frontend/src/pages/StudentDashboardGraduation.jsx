import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { getClearanceComments, createClearanceComment, updateClearanceComment, deleteClearanceComment, authAxios } from "../services/api";
import { getStudentTheme } from "../constants/dashboardThemes";
import useRealtimeSubscription from "../hooks/useRealtimeSubscription";
import GraduationCertificate from "../components/features/GraduationCertificate";
import DashboardLayout, {
  GlassCard,
  StatusBadge,
} from "../components/ui/DashboardLayout";
import {
  ChartBarIcon,
  AcademicCapIcon,
  UsersIcon,
  BookOpenIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  ChevronDownIcon,
  DocumentCheckIcon,
  ChatBubbleIcon,
  ArrowUpTrayIcon,
  DocumentIcon,
  BellIcon,
  UserIcon,
  HomeIcon,
} from "../components/ui/Icons";
import StudentOverview from "../components/features/StudentOverview";
import StudentRequestHistory from "../components/features/StudentRequestHistory";
import StudentNotifications from "../components/features/StudentNotifications";
import StudentProfile from "../components/features/StudentProfile";
import ApplicationModal from "../components/features/ApplicationModal";
import data from '@emoji-mart/data/sets/14/google.json';
import Picker from '@emoji-mart/react';

const applyRichTextFormat = (e, type) => {
  e.preventDefault();
  const form = e.target.closest('form, .richtext-container');
  if (!form) return;
  const textarea = form.querySelector('textarea');
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

const UnresolvedBadge = ({ count = 0 }) => {
  if (count <= 0) return null;
  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-[0.05em] uppercase bg-slate-100 text-slate-600 border border-slate-200 shadow-sm transition-colors"
    >
      {count === 1 ? "1 COMMENT" : `${count} COMMENTS`}
    </motion.span>
  );
};

const CommentIndicator = ({ hasComment }) => {
  if (!hasComment) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1 text-orange-500"
      title="Has comments — click to view"
    >
      <ChatBubbleIcon className="w-3.5 h-3.5" />
    </motion.div>
  );
};

const StageNode = ({
  stage,
  index,
  total,
  isExpanded,
  onToggle,
  unresolvedCount,
  hasComments,
  onViewComments,
  onRequestReevaluation,
  onUploadDocument,
  children,
  isDarkMode = false,
}) => {
  const indexStr = (index + 1).toString().padStart(2, '0');

  const statusConfig = {
    approved: {
      bg: isDarkMode ? "bg-[#202124] border-[#3c4043]" : "bg-white border-[#dadce0]",
      icon: <CheckIcon className="w-5 h-5 text-emerald-500" />,
      iconBg: isDarkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600",
      badge: "COMPLETED",
      badgeBg: isDarkMode ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-600 text-white shadow-sm",
    },
    rejected: {
      bg: isDarkMode ? "bg-[#202124] border-[#3c4043] border-l-4 border-l-rose-500" : "bg-white border-[#dadce0] border-l-4 border-l-rose-500 shadow-sm",
      icon: <XMarkIcon className="w-5 h-5 text-rose-500" />,
      iconBg: isDarkMode ? "bg-rose-500/10 text-rose-400" : "bg-rose-50 text-rose-600",
      badge: "REJECTED",
      badgeBg: isDarkMode ? "bg-rose-500/20 text-rose-400" : "bg-rose-600 text-white shadow-sm",
    },
    pending: {
      bg: isDarkMode 
        ? "bg-[#202124] border-[#3c4043] border-l-4 border-l-primary-500 shadow-md" 
        : "bg-white border-[#dadce0] border-l-4 border-l-primary-500 shadow-[0_4px_16px_rgba(0,0,0,0.06)]",
      icon: <ClockIcon className="w-5 h-5 text-primary-500" />,
      iconBg: isDarkMode ? "bg-primary-500/10 text-primary-400" : "bg-primary-50 text-primary-600",
      badge: "PENDING",
      badgeBg: isDarkMode ? "bg-primary-500/20 text-primary-400" : "bg-primary-100 text-primary-700 font-bold",
    },
    locked: {
      bg: isDarkMode ? "bg-transparent border-[#3c4043]/30" : "bg-transparent border-slate-200/60",
      icon: null,
      iconBg: isDarkMode ? "bg-[#282a2d] text-slate-500" : "bg-slate-100 text-slate-400",
      badge: "LOCKED",
      badgeBg: isDarkMode ? "bg-transparent text-[#5f6368] border border-[#3c4043]/50" : "bg-transparent text-slate-400 border border-slate-200",
    },
  };

  const config = statusConfig[stage.status] || statusConfig.pending;
  const isLocked = stage.status === "locked";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.4 }}
      className={`w-full rounded-[24px] transition-all duration-300 transform-gpu ${config.bg} border ${!isLocked ? "cursor-pointer hover:shadow-md" : ""}`}
      onClick={!isLocked ? onToggle : undefined}
    >
      <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="relative flex-shrink-0">
            <motion.div
              layout
              className={`w-[48px] h-[48px] sm:w-[52px] sm:h-[52px] rounded-full flex items-center justify-center overflow-hidden shadow-sm transition-all duration-300 ${!stage.avatarUrl ? (isLocked ? (isDarkMode ? "bg-[#282a2d] text-slate-500" : "bg-slate-100 text-slate-400") : "bg-[#4caf50] text-white") : (isLocked ? "opacity-50 grayscale transition-all" : "")}`}
            >
              {stage.avatarUrl ? (
                <img src={stage.avatarUrl} alt={stage.title} className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className={`text-[20px] sm:text-[22px] ${isLocked ? "font-medium" : "font-bold"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
                  {stage.title?.charAt(0).toUpperCase()}
                </span>
              )}
            </motion.div>
          </div>
          
          <div className="flex flex-col">
            <h4 className={`text-[17px] sm:text-[19px] tracking-tight mb-0.5 transition-all duration-300 ${isLocked ? "font-medium" : "font-bold"} ${isDarkMode ? (isLocked ? "text-slate-400" : "text-[#e8eaed]") : (isLocked ? "text-slate-400" : "text-[#202124]")}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
              {stage.title}
            </h4>
            <p className={`text-[13px] sm:text-[14px] leading-relaxed transition-all duration-300 ${isDarkMode ? (isLocked ? "text-slate-500" : "text-slate-300") : (isLocked ? "text-slate-300" : "text-slate-500")}`}>
              {stage.description}
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 self-start sm:self-auto pl-[68px] sm:pl-0">
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-[0.05em] ${config.badgeBg} uppercase`}>
            {config.badge}
          </span>
          <UnresolvedBadge count={unresolvedCount} />

          {/* Action Buttons */}
          {(!isLocked) && (
            <div className="flex items-center gap-2">
              {stage.status === "rejected" && onRequestReevaluation && (
                <button onClick={(e) => { e.stopPropagation(); onRequestReevaluation(stage); }} className={`group/btn relative px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all shadow-sm ${isDarkMode ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-400" : "bg-rose-100 hover:bg-rose-200 text-rose-700"}`}>
                  Evaluate
                  <div className={`pointer-events-none absolute -top-9 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[12px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>
                    Re-evaluate
                  </div>
                </button>
              )}
              
              {stage.status !== "locked" && !stage.hasChildren && onUploadDocument && (
                <button onClick={(e) => { e.stopPropagation(); onUploadDocument(stage); }} className={`group/btn relative w-9 h-9 flex items-center justify-center rounded-xl transition-all ${isDarkMode ? "bg-transparent hover:bg-blue-500/20 text-blue-400 border border-[#3c4043]" : "bg-white hover:bg-blue-50 text-blue-600 border border-slate-200"}`}>
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  <div className={`pointer-events-none absolute -top-9 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[12px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>
                    Upload File
                  </div>
                </button>
              )}
              
              {hasComments && !stage.hasChildren && (
                <button onClick={(e) => { e.stopPropagation(); onViewComments(); }} className={`group/btn relative w-9 h-9 flex items-center justify-center rounded-xl transition-all ${isDarkMode ? "bg-transparent hover:bg-orange-500/20 text-orange-400 border border-[#3c4043]" : "bg-white hover:bg-orange-50 text-orange-600 border border-slate-200"}`}>
                  <ChatBubbleIcon className="w-4 h-4" />
                  <div className={`pointer-events-none absolute -top-9 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[12px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>
                    Comments
                  </div>
                </button>
              )}
              
              <div className={`group/btn relative w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                <div className={`pointer-events-none absolute -top-9 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[12px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>
                  {isExpanded ? "Collapse" : "Expand"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && children && (
          <motion.div layout onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className={`mx-6 mb-6 pt-5 border-t ${isDarkMode ? "border-[#3c4043]" : "border-slate-100"} relative z-20`}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {stage.comments && (
        <div className="px-6 pb-6">
          <div className={`p-4 rounded-xl text-[13px] leading-relaxed flex items-start gap-3 backdrop-blur-md ${isDarkMode ? "bg-primary-500/10 border border-primary-500/20 text-primary-100" : "bg-primary-50/50 border border-primary-100 text-slate-700"}`}>
            <ChatBubbleIcon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDarkMode ? "text-primary-400" : "text-primary-600"}`} />
            <div>
              <span className={`font-semibold block mb-1 ${isDarkMode ? "text-primary-300" : "text-primary-700"}`}>
                System Note &mdash; {stage.title}
              </span>
              <p className="opacity-90">{stage.comments}</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const ProfessorCard = ({
  approval,
  index,
  onViewComments,
  clearanceComments = [],
  isDarkMode = false,
}) => {
  const statusColors = {
    approved: {
      dot: isDarkMode ? "bg-emerald-400" : "bg-emerald-500",
      badge: isDarkMode
        ? "bg-emerald-400 bg-opacity-[0.15] text-emerald-400 border border-emerald-400/20"
        : "bg-emerald-50 text-emerald-700 border border-transparent",
    },
    rejected: {
      dot: isDarkMode ? "bg-red-400" : "bg-red-500",
      badge: isDarkMode
        ? "bg-red-400 bg-opacity-[0.15] text-red-400 border border-red-400/20"
        : "bg-red-50 text-red-700 border border-transparent",
    },
    pending: {
      dot: isDarkMode ? "bg-[#fde293]" : "bg-amber-500",
      badge: isDarkMode
        ? "bg-[#422c00] text-[#fde293] border border-[#fde293]/20"
        : "bg-amber-50 text-amber-700 border border-transparent",
    },
  };
  const colors = statusColors[approval.status] || statusColors.pending;

  const hasClearanceComments = clearanceComments.some(
    (c) => c.commenter_id === approval.professor_id,
  );
  const hasApprovalComment = !!(approval.comments && approval.comments.trim());
  const hasComment = hasApprovalComment || hasClearanceComments;
  const clearanceCommentCount = clearanceComments.filter(
    (c) => c.commenter_id === approval.professor_id && !c.is_resolved,
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={(e) => {
        e.stopPropagation();
        onViewComments(approval);
      }}
      className={`group flex items-center justify-between p-3 rounded-xl transition-all duration-200 cursor-pointer border ${isDarkMode ? "hover:bg-[#3c4043] hover:border-[#5f6368] border-transparent" : "hover:bg-white/80 hover:shadow-md hover:shadow-green-500/5 border-transparent hover:border-green-100"}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-5 h-px transition-colors ${isDarkMode ? "bg-[#5f6368] group-hover:bg-[#9aa0a6]" : "bg-gray-300 group-hover:bg-green-300"}`}
          />
          <div
            className={`w-3 h-3 rounded-full ${colors.dot} shadow-sm ring-2 ring-offset-1 ${isDarkMode ? "ring-offset-[#202124] ring-[#3c4043]" : "ring-offset-white ring-gray-200"} ${approval.status === "pending" ? "animate-pulse" : ""}`}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p
              className={`font-medium text-sm transition-colors ${isDarkMode ? "text-[#e8eaed] group-hover:text-white" : "text-gray-800 group-hover:text-gray-900"}`}
              style={{ fontFamily: "Google Sans, sans-serif" }}
            >
              {approval.professor?.full_name || "Unknown Signatory"}
            </p>
            <CommentIndicator hasComment={hasComment} />
          </div>
          {hasComment && (
            <p
              className={`text-xs mt-0.5 italic truncate max-w-[250px] ${isDarkMode ? "text-[#9aa0a6]" : "text-gray-400"}`}
            >
              "{approval.comments}"
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}
        >
          {approval.status}
        </span>
        {hasComment && (
          <UnresolvedBadge
            count={clearanceCommentCount + (hasApprovalComment ? 1 : 0)}
          />
        )}
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 0 }}
          whileHover={{ opacity: 1, x: 0 }}
          className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDarkMode ? "text-primary-400" : "text-primary-500"}`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );
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

const InlineCommentThread = ({
  stage,
  requestId,
  studentId,
  clearanceComments = [],
  onCommentAdded,
  isDarkMode,
  user,
  studentInfo
}) => {
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [showMainEmojiPicker, setShowMainEmojiPicker] = useState(false);
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(null);
  const threadRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // If clicking outside the entire comment thread, close the emoji pickers
      if (threadRef.current && !threadRef.current.contains(e.target)) {
        setShowMainEmojiPicker(false);
        setShowEditEmojiPicker(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setIsSubmitting(true);
    try {
      const targetTag = stage.type === "signatory" && stage.approval ? `[TO:${stage.approval.professor_id}]` : `[TO:${stage.key}]`;
      const finalComment = `${targetTag} ${replyText.trim()}`;

      const { data } = await authAxios.post(
        `/comments/${requestId}/comments`,
        {
          user_id: studentId,
          comment_text: finalComment,
          visibility: "all",
        }
      );

      if (data.success) {
        toast.success("Reply sent successfully");
        setReplyText("");
        
        // Let postgres_changes handle cross-client sync
        if (onCommentAdded) onCommentAdded();
      } else {
        throw new Error(data.error || "Failed to post reply");
      }
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || "Failed to post reply.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitEdit = async (commentId, originalTag) => {
    if (!editCommentText.trim()) return;
    try {
      const finalComment = originalTag ? `${originalTag} ${editCommentText.trim()}` : editCommentText.trim();
      const response = await authAxios.put(`/comments/${commentId}`, {
        user_id: studentId,
        comment_text: finalComment
      });
      if (response.data.success) {
        toast.success("Comment updated successfully");
        setEditingCommentId(null);
        if (onCommentAdded) onCommentAdded();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update comment");
    }
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      const response = await authAxios.delete(`/comments/${commentId}`);
      if (response.data.success) {
        toast.success("Comment deleted successfully");
        if (onCommentAdded) onCommentAdded();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to delete comment");
    }
  };

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
  }, [clearanceComments]);

  const REACTION_REGEX = /^\[\[REAC:([a-z]+):([a-zA-Z0-9-]+)\]\]$/i;
  const validComments = [];
  const reactionComments = [];
  
  clearanceComments.forEach(c => {
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
         activeReactions = activeReactions.filter(r => r.commenter_id !== studentId);
      } else if (optObj.action === 'SET') {
         const existing = activeReactions.find(r => r.commenter_id === studentId);
         if (existing) {
            existing.reacType = optObj.type;
         } else {
            activeReactions.push({ commenter_id: studentId, reacType: optObj.type });
         }
      }
    }
    
    const counts = {};
    activeReactions.forEach(r => {
      counts[r.reacType] = (counts[r.reacType] || 0) + 1;
    });
    
    return { counts, userReaction: activeReactions.find(r => r.commenter_id === studentId) || null, activeReactions };
  };
  
  const getDbReaction = (commentId) => {
    const strCommentId = String(commentId);
    const reacs = reactionComments.filter(r => r.targetId === strCommentId && r.commenter_id === studentId);
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
            if (onCommentAdded) onCommentAdded();
          }
        } else if (finalOpt.action === 'SET') {
          const existingId = dbReaction?.id || virtualIds.current[strCommentId];
          if (existingId) {
            if (dbReaction?.reacType !== finalOpt.type) {
              await authAxios.put(`/comments/${existingId}`, { user_id: studentId, comment_text: `[[REAC:${finalOpt.type}:${commentId}]]` });
              if (onCommentAdded) onCommentAdded();
            }
          } else {
            const res = await authAxios.post(`/comments/${requestId}/comments`, { user_id: studentId, comment_text: `[[REAC:${finalOpt.type}:${commentId}]]`, visibility: "all" });
            if (res?.data?.comment?.id) {
               virtualIds.current[strCommentId] = res.data.comment.id;
            }
            if (onCommentAdded) onCommentAdded();
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

  let specificComments = [];

  const isTargetComment = (c) => {
    if (c.commenter_id !== studentId) return false;
    const tTag = stage.type === "signatory" && stage.approval ? `[TO:${stage.approval.professor_id}]` : `[TO:${stage.key}]`;
    if (c.comment_text.startsWith(tTag)) return true;
    if (!c.comment_text.includes("[TO:")) {
      // Show untagged legacy comments if this stage has comments or is pending/rejected
      const roleMap = { library: "librarian", cashier: "cashier", registrar: "registrar" };
      const role = stage.type === "stage" ? roleMap[stage.key] : "signatory";
      const hasStaffComments = validComments.some(sc => sc.commenter_role === role || sc.commenter_id === stage.approval?.professor_id);
      return hasStaffComments || stage.status !== "approved";
    }
    return false;
  };

  if (stage.type === "signatory" && stage.approval) {
    specificComments = validComments.filter(
      (c) => c.commenter_id === stage.approval.professor_id || isTargetComment(c),
    );

    if (stage.approval.comments && stage.approval.comments.trim()) {
      specificComments = [
        {
          id: `approval-${stage.approval.id}`,
          commenter_name: stage.approval.professor?.full_name || "Signatory",
          commenter_role: "signatory",
          comment_text: stage.approval.comments,
          created_at: stage.approval.approved_at || stage.approval.created_at,
          is_resolved: false,
          isApprovalComment: true,
        },
        ...specificComments,
      ];
    }
  } else if (stage.type === "stage") {
    const roleMap = {
      library: "librarian",
      cashier: "cashier",
      registrar: "registrar",
    };
    const role = roleMap[stage.key];
    specificComments = validComments.filter(
      (c) => c.commenter_role === role || isTargetComment(c)
    );

    if (stage.comments && stage.comments.trim()) {
      specificComments = [
        {
          id: `stage-${stage.key}`,
          commenter_name: stage.title,
          commenter_role: role || "admin",
          comment_text: stage.comments,
          is_resolved: false,
          isStageComment: true,
        },
        ...specificComments,
      ];
    }
  }

  const unresolvedCount = specificComments.filter(
    (c) => !c.is_resolved && c.commenter_id !== studentId
  ).length;

  if (specificComments.length === 0) {
    return (
      <div className={`mt-4 pt-4 border-t flex flex-col items-center justify-center p-6 transition-colors ${isDarkMode ? "border-[#3c4043] text-[#9aa0a6]" : "border-[#e8eaed] text-[#5f6368]"}`}>
        <ChatBubbleIcon className="w-6 h-6 mb-2 opacity-50" />
        <p className="text-[14px] font-medium tracking-tight" style={{ fontFamily: "Google Sans, sans-serif" }}>No feedback yet.</p>
      </div>
    );
  }

  return (
    <>
      <div ref={threadRef} className={`flex flex-col mt-4 pt-4 border-t transition-all duration-300 ${isDarkMode ? "border-[#3c4043]" : "border-[#e8eaed]"}`}>
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

      <div className={`px-2 py-4 space-y-5 bg-transparent ${isDarkMode ? "" : ""}`}>
        {specificComments.map((comment) => {
          const isOwnComment = comment.commenter_id === studentId && !comment.isApprovalComment && !comment.isStageComment;
          const matchTag = comment.comment_text.match(/^(\[TO:[^\]]+\]\s*)/);
          const originalTag = matchTag ? matchTag[1].trim() : "";
          const displayStr = comment.comment_text.replace(/^\[TO:[^\]]+\]\s*/, "");
          
          return (
          <div key={comment.id} className="group flex gap-4">
            <div className={`w-[36px] h-[36px] mt-1 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[13px] text-white shadow-sm overflow-hidden ${comment.is_resolved ? "bg-[#34a853]" : "bg-primary-500"}`}>
              {(comment.commenter_id === studentId && (user?.user_metadata?.avatar_url || studentInfo?.avatar_url)) ? (
                <img src={user?.user_metadata?.avatar_url || studentInfo?.avatar_url} alt="You" className="w-full h-full object-cover" />
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
              
              {editingCommentId === comment.id ? (
                <div className="w-full mt-1.5 mb-2 relative group/edit-input richtext-container flex flex-col">
                  {/* Google Classroom Edit Container style */}
                  <div className={`relative transition-all duration-300 border rounded-[12px] bg-white focus-within:ring-1 focus-within:ring-primary-600 focus-within:border-primary-600 ${isDarkMode ? "!bg-transparent !border-[#5f6368] focus-within:!border-primary-400 focus-within:!ring-primary-400" : "border-[#dadce0]"}`}>
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
                          onEmojiSelect={(emoji) => setEditCommentText(p => p + emoji.native)} 
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setEditingCommentId(null)} className={`px-4 py-[7px] text-[14px] font-bold transition-colors ${isDarkMode ? "text-primary-400 hover:bg-primary-900/20" : "text-[#5f6368] hover:bg-black/5"} rounded-[4px]`} style={{ fontFamily: "Google Sans, sans-serif" }}>CANCEL</button>
                    <button onClick={() => submitEdit(comment.id, originalTag)} className={`px-4 py-[7px] text-[14px] font-bold transition-colors ${isDarkMode ? "bg-primary-900/60 text-primary-200 hover:bg-primary-800/80" : "bg-primary-500 text-white hover:bg-primary-600 hover:shadow shadow-sm border border-transparent hover:border-black/10"} rounded-[4px]`} style={{ fontFamily: "Google Sans, sans-serif" }}>SAVE CHANGES</button>
                  </div>
                </div>
              ) : (
                <div className="relative group/bubble max-w-full">
                  {(() => {
                    const reacs = getReactionsForComment(comment.id);
                    const hasReactions = reacs.activeReactions.length > 0;
                    return (
                      <>
                        <div className={`mt-1 py-2.5 px-4 rounded-[16px] rounded-tl-[4px] text-[14px] leading-relaxed inline-block max-w-full break-words relative ${comment.is_resolved ? (isDarkMode ? "bg-[#3c4043]/50 text-[#9aa0a6]" : "bg-white border border-[#e8eaed] text-[#5f6368] opacity-75") : (isDarkMode ? "bg-[#3c4043] text-[#e8eaed]" : "bg-white shadow-sm border border-[#e8eaed] text-[#202124]")}`}>
                          {renderMarkdown(displayStr)}
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
                        </div>
                        <div className="absolute top-1/2 -translate-y-1/2 left-full pl-2 opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-200 flex items-center gap-1 z-20 before:absolute before:inset-0 before:-top-4 before:-bottom-4 before:z-[-1]">
                           {!comment.isApprovalComment && !comment.isStageComment && (
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
                           )}
                           {isOwnComment && (
                             <>
                                <button onClick={(e) => { e.stopPropagation(); setEditCommentText(displayStr); setEditingCommentId(comment.id); }} className={`group/btn relative p-1.5 rounded-full hover:scale-110 active:scale-95 transition-all ${isDarkMode ? "text-slate-400 hover:text-primary-400 bg-[#303134]" : "text-slate-400 hover:text-primary-600 bg-white shadow-sm border border-slate-100"}`}>
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
                </div>
              )}
            </div>
          </div>
        )})}
      </div>

      <div className="pt-3 pb-4 pr-[18px] bg-transparent">
        <form onSubmit={handleReplySubmit} className="flex items-end gap-[13px] group/form">
          {/* Avatar (Left) */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px] overflow-hidden text-white shadow-sm flex-shrink-0 mb-[7px] ${isDarkMode ? "bg-blue-600/80 p-0" : "bg-primary-500"}`}>
            {(user?.user_metadata?.avatar_url || studentInfo?.avatar_url) ? (
              <img src={user?.user_metadata?.avatar_url || studentInfo?.avatar_url} alt="You" className="w-full h-full object-cover" />
            ) : (
              (studentInfo?.full_name?.charAt(0) || user?.user_metadata?.full_name?.charAt(0) || "U").toUpperCase()
            )}
          </div>

          {/* Input Flex Wrapper */}
          <div className={`flex-1 flex flex-col transition-all duration-300 relative group/input bg-white border ${replyText.trim().length > 0 ? "rounded-[16px] border-primary-600 ring-1 ring-primary-600" : "rounded-[24px] focus-within:rounded-[16px] border-[#dadce0] focus-within:border-primary-600 focus-within:ring-1 focus-within:ring-primary-600"} ${isDarkMode ? "!bg-transparent !border-[#5f6368] focus-within:!border-primary-400 focus-within:!ring-primary-400" : ""}`}>
            <textarea
              disabled={isSubmitting}
              placeholder="Add class comment..."
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
            <div className={`flex items-center gap-[5px] px-3 transition-all duration-200 text-[#5f6368] ${isDarkMode ? "text-[#9aa0a6]" : ""} ${replyText.trim() || showMainEmojiPicker ? "opacity-100 h-[36px] pb-2 visible" : "opacity-0 h-0 invisible group-focus-within/input:opacity-100 group-focus-within/input:h-[36px] group-focus-within/input:pb-2 group-focus-within/input:visible"}`}>
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
              <button type="button" onMouseDown={(e) => { e.preventDefault(); setShowMainEmojiPicker(p => !p); }} className={`group/btn relative p-1.5 rounded hover:bg-black/5 hover:text-gray-900 ${isDarkMode ? "hover:text-gray-200 hover:bg-white/10" : ""}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
                <div className={`pointer-events-none absolute top-full mt-1.5 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>Insert emoji</div>
              </button>
            </div>
            
            {/* Floating Picker for Main Reply */}
            {showMainEmojiPicker && (
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
                  onEmojiSelect={(emoji) => setReplyText(p => p + emoji.native)} 
                />
              </div>
            )}
          </div>
          
          {/* Send Arrow (Right/Outside) */}
          <button
            type="submit"
            disabled={isSubmitting || !replyText.trim()}
            className={`flex-shrink-0 p-[5px] rounded-full mb-1 transition-colors ${isSubmitting || !replyText.trim() ? "text-slate-400 cursor-not-allowed" : "text-primary-600 hover:bg-primary-50 active:scale-95"} ${isDarkMode && (isSubmitting || !replyText.trim()) ? "!text-[#5f6368]" : isDarkMode && replyText.trim() ? "!text-primary-400 !hover:bg-[#3c4043]" : ""}`}
            title="Post comment"
          >
            {isSubmitting ? (
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
           <span>Press <strong className={`font-bold text-[11.5px] text-[#5f6368] ${isDarkMode ? '!text-[#9aa0a6]' : ''}`}>Enter</strong> inside to send</span>
        </div>
      </div>
    </div>
    </>
  );
};

let documentsGlobalCache = null;
let documentsGlobalReqId = null;
let documentsGlobalRefreshKey = null;

const UploadedDocumentsList = ({ requestId, studentId, isDarkMode, refreshKey }) => {
  const [documents, setDocuments] = useState(() => {
    if (documentsGlobalReqId === requestId && documentsGlobalRefreshKey === refreshKey && documentsGlobalCache) return documentsGlobalCache;
    return [];
  });
  const [loading, setLoading] = useState(() => {
    return !(documentsGlobalReqId === requestId && documentsGlobalRefreshKey === refreshKey && documentsGlobalCache);
  });

  const loadingTimerRef = useRef(null);

  const fetchDocuments = useCallback(async (forced = false) => {
    if (!requestId) return;
    
    const hasCache = documentsGlobalReqId === requestId && documentsGlobalRefreshKey === refreshKey && documentsGlobalCache && !forced;
    if (!hasCache) {
      if (!loadingTimerRef.current) {
        // Only show skeleton if the request takes more than 150ms
        loadingTimerRef.current = setTimeout(() => setLoading(true), 150);
      }
    } else {
      setLoading(false);
    }
    
    try {
      const response = await authAxios.get(`/documents/request/${requestId}`);
      if (response.data.success) {
        const docs = response.data.documents || [];
        documentsGlobalCache = docs;
        documentsGlobalReqId = requestId;
        documentsGlobalRefreshKey = refreshKey;
        setDocuments(docs);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setLoading(false);
    }
  }, [requestId, refreshKey]);

  useEffect(() => {
    fetchDocuments(true);
  }, [refreshKey, fetchDocuments]);

  // Live updates when documents are added/removed
  useRealtimeSubscription("request_documents", () => fetchDocuments(true), {
    filter: `request_id=eq.${requestId}`,
    enabled: !!requestId,
  });

  const handleDelete = async (docId) => {
    // Optimistic Deletion
    const originalDocs = documents;
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    
    try {
      const response = await authAxios.delete(`/documents/${docId}`);
      if (response.data.success) {
        toast.success("Document deleted");
        
        // Let postgres_changes handle cross-client sync
        fetchDocuments(true);
      } else {
        setDocuments(originalDocs);
        toast.error("Failed to delete document");
      }
    } catch {
      setDocuments(originalDocs);
      toast.error("Failed to delete document");
    }
  };

  const getFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };



  if (documents.length === 0) {
    return (
      <div className={`mt-2 pt-2 transition-all duration-300`}>
        <div className={`px-2 py-3 mb-4 flex items-center justify-between border-b ${isDarkMode ? "border-[#3c4043]" : "border-slate-100"}`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${isDarkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
               <DocumentIcon className="w-4 h-4" />
            </div>
            <h4 className={`text-[15px] font-bold tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-slate-800"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
              Uploaded Documents
            </h4>
          </div>
          <span className={`text-[12px] font-bold px-3 py-1 rounded-full border shadow-sm ${isDarkMode ? "bg-slate-800 text-slate-400 border-[#3c4043]" : "bg-slate-50 text-slate-500 border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"}`}>
            0 Files
          </span>
        </div>
        <div className={`mx-2 mb-4 mt-2 px-6 py-8 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed transition-all duration-300 ${isDarkMode ? "border-[#3c4043] bg-[#282a2d]/50 hover:bg-[#282a2d] hover:border-[#5f6368]" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"}`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm ${isDarkMode ? "bg-[#3c4043] text-slate-400" : "bg-white text-slate-400 border border-slate-100"}`}>
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className={`text-[14px] font-bold mb-1 ${isDarkMode ? "text-[#e8eaed]" : "text-slate-700"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>No Documents Yet</p>
          <p className={`text-[13px] text-center max-w-[250px] leading-relaxed ${isDarkMode ? "text-[#9aa0a6]" : "text-slate-500"}`}>Upload the required files to complete this stage of your clearance.</p>
        </div>
      </div>
    );
  }
  return (
    <div className={`mt-2 pt-2 transition-all duration-300`}>
      <div className={`px-2 py-3 mb-4 flex items-center justify-between border-b ${isDarkMode ? "border-[#3c4043]" : "border-slate-100"}`}>
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${isDarkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
             <DocumentIcon className="w-4 h-4" />
          </div>
          <h4 className={`text-[15px] font-bold tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-slate-800"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
            Uploaded Documents
          </h4>
        </div>
        <span className={`text-[12px] font-bold px-3 py-1 rounded-full border shadow-sm ${isDarkMode ? "bg-blue-900/40 text-blue-300 border-blue-800/50" : "bg-white text-blue-700 border-blue-100 shadow-[0_2px_4px_rgba(59,130,246,0.1)]"}`}>
          {documents.length} File{documents.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="px-2 pb-4 bg-transparent">
        <AnimatePresence>
        {documents.map((doc) => {
          const isDocType = (doc.file_type?.includes("word") || doc.file_name?.endsWith(".docx") || doc.file_name?.endsWith(".doc"));
          const isPdfType = doc.file_type?.includes("pdf");
          const isExcelType = doc.file_type?.includes("excel") || doc.file_type?.includes("spreadsheet") || doc.file_name?.endsWith(".xls") || doc.file_name?.endsWith(".xlsx");
          const isImage = doc.file_type?.includes("image");
          
          let fileTypeVerbose = "Document";
          if (isDocType) fileTypeVerbose = "Microsoft Word";
          else if (isPdfType) fileTypeVerbose = "PDF Document";
          else if (isExcelType) fileTypeVerbose = "Microsoft Excel";
          else if (isImage) fileTypeVerbose = "Image";
          
          return (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0, overflow: 'hidden' }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            key={doc.id}
            className={`group mb-3 flex items-stretch p-0 rounded-[16px] border transition-all duration-300 ease-out relative z-10 ${
              isDarkMode 
                ? "bg-[#202124] border-[#3c4043] hover:border-blue-500/50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]" 
                : "bg-white border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-[0_8px_20px_-6px_rgba(59,130,246,0.2)]"
            }`}
          >
            {/* Left side: Information */}
            <div
              className={`flex flex-col justify-center min-w-0 flex-1 p-4 sm:p-5 cursor-pointer`}
              onClick={() => {
                if (doc.file_url) window.open(doc.file_url, "_blank", "noopener,noreferrer");
              }}
              title="Click to open"
            >
              <p 
                className={`text-[16px] sm:text-[18px] font-semibold truncate transition-colors duration-200 underline-offset-[3px] decoration-2 group-hover:underline ${
                  isDarkMode 
                    ? "text-[#e8eaed] decoration-[#e8eaed]/30" 
                    : "text-[#202124] decoration-[#202124]/30"
                }`}
                style={{ fontFamily: "Google Sans, sans-serif" }}
              >
                {doc.file_name}
              </p>
              
              <div className="mt-1 flex items-center gap-2">
                <p className={`text-[13px] sm:text-[14px] font-medium ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
                  {fileTypeVerbose}
                </p>
                <span className={`text-[11px] leading-none ${isDarkMode ? "text-[#5f6368]" : "text-slate-300"}`}>•</span>
                <p className={`text-[12px] font-medium ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}>
                  {getFileSize(doc.file_size)}
                </p>
              </div>
            </div>
            
            {/* Right side: Preview Thumbnail */}
            <div 
              className={`w-[110px] sm:w-[130px] flex-shrink-0 relative overflow-hidden rounded-r-[15px] border-l transition-colors duration-300 ${
                isDarkMode 
                  ? "border-[#3c4043] bg-[#282a2d]" 
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div 
                className="absolute inset-0 cursor-pointer pointer-events-auto"
                onClick={() => {
                  if (doc.file_url) window.open(doc.file_url, "_blank", "noopener,noreferrer");
                }}
              >
                {isImage && doc.file_url ? (
                  <img src={doc.file_url} alt={doc.file_name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className={`absolute inset-0 w-full h-full flex flex-col p-2.5 sm:p-3 opacity-70 transition-opacity duration-300 group-hover:opacity-100 ${isDarkMode ? "bg-[#3c4043]/50" : "bg-white"}`}>
                    <div className={`w-full h-2 mb-2 rounded-sm ${isDarkMode ? "bg-[#5f6368]" : "bg-slate-200"}`}></div>
                    <div className={`w-3/4 h-2 mb-3 rounded-sm ${isDarkMode ? "bg-[#5f6368]" : "bg-slate-200"}`}></div>
                    
                    <div className="flex gap-2 mb-2">
                       <div className={`w-1/3 h-8 rounded border ${isDarkMode ? "bg-[#3c4043] border-[#5f6368]" : "bg-slate-50 border-slate-100"}`}></div>
                       <div className={`flex-1 h-8 rounded border ${isDarkMode ? "bg-[#3c4043] border-[#5f6368]" : "bg-slate-50 border-slate-100"}`}></div>
                    </div>
                    
                    <div className={`w-full h-1.5 mb-1.5 rounded-sm ${isDarkMode ? "bg-[#5f6368]/70" : "bg-slate-100"}`}></div>
                    <div className={`w-full h-1.5 mb-1.5 rounded-sm ${isDarkMode ? "bg-[#5f6368]/70" : "bg-slate-100"}`}></div>
                    <div className={`w-5/6 h-1.5 mb-1.5 rounded-sm ${isDarkMode ? "bg-[#5f6368]/70" : "bg-slate-100"}`}></div>
                    <div className={`w-4/6 h-1.5 rounded-sm ${isDarkMode ? "bg-[#5f6368]/70" : "bg-slate-100"}`}></div>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 pointer-events-none" />
              </div>
            </div>

            {/* Overlay Action Buttons */}
            <div className={`absolute right-[110px] sm:right-[130px] top-1/2 -translate-y-1/2 -translate-x-4 opacity-0 group-hover:opacity-100 group-hover:-translate-x-2 transition-all duration-300 flex items-center gap-2 pointer-events-none group-hover:pointer-events-auto`}>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!doc.file_url) return;
                  try {
                    const response = await fetch(doc.file_url);
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = doc.file_name || "document";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                  } catch {
                    window.open(doc.file_url, "_blank", "noopener,noreferrer");
                  }
                }}
                className={`group/btn relative flex items-center justify-center p-2.5 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95 ${
                  isDarkMode 
                    ? "bg-[#303134] text-[#8ab4f8] border border-[#5f6368] hover:bg-[#3c4043]" 
                    : "bg-white text-blue-600 border border-slate-200 hover:bg-blue-50"
                }`}
              >
                <div className={`pointer-events-none absolute -top-9 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[12px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>
                  Download
                </div>
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              {doc.uploaded_by === studentId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(doc.id);
                  }}
                  className={`group/btn relative flex items-center justify-center p-2.5 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95 ${
                    isDarkMode 
                      ? "bg-[#303134] text-[#f28b82] border border-[#5f6368] hover:bg-[#5c1010]/30" 
                      : "bg-white text-rose-500 border border-slate-200 hover:bg-rose-50"
                  }`}
                >
                  <div className={`pointer-events-none absolute -top-9 left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[12px] font-medium opacity-0 shadow-sm transition-opacity duration-0 group-hover/btn:duration-200 group-hover/btn:delay-300 group-hover/btn:opacity-100 ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-[#e8eaed]" : "bg-white border-slate-200 text-slate-800"}`}>
                    Delete
                  </div>
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </motion.div>
        )})}
        </AnimatePresence>
      </div>
    </div>
  );
};

const DocumentUploadModal = ({ target, requestId, studentId, onClose, onUploadSuccess, isDarkMode }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(selected.type)) {
      toast.error("Invalid file type. Please upload PDF, JPG, or PNG only.");
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit.");
      return;
    }

    setFile(selected);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a document first.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    const newFile = new File([file], `[${target.title}] ${file.name}`, { type: file.type });

    formData.append("file", newFile);
    formData.append("request_id", requestId);
    formData.append("user_id", studentId);

    try {
      const response = await authAxios.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (response.data.success) {
        toast.success("Document uploaded successfully");
        if (onUploadSuccess) onUploadSuccess();
        
        // Let postgres_changes handle cross-client sync
        onClose();
      } else {
        throw new Error(response.data.error || "Upload failed");
      }
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  if (!target) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 px-4 sm:px-0" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-md rounded-3xl shadow-2xl border overflow-hidden ${isDarkMode ? "bg-[#282a2d] border-[#3c4043]" : "bg-white border-blue-100/60"}`}>
        <div className={`flex items-center justify-between px-6 py-5 border-b ${isDarkMode ? "border-[#3c4043]" : "border-blue-100/60"}`}>
          <div className="flex items-center gap-4">
             <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white flex-shrink-0">
                <ArrowUpTrayIcon className="w-5 h-5 text-white" />
             </div>
             <div>
                <h4 className={`font-bold text-[16px] tracking-tight ${isDarkMode ? "text-gray-100" : "text-gray-900"}`}>Upload Document</h4>
                <p className={`text-[13px] ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>For {target.title}</p>
             </div>
          </div>
          <motion.button type="button" whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? "bg-[#3c4043] text-gray-400 hover:text-red-400 hover:bg-red-500/10" : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500"}`}>
             <XMarkIcon className="w-4 h-4" />
          </motion.button>
        </div>

        <form onSubmit={handleUploadSubmit} className="p-6">
           <p className={`text-[14px] leading-relaxed mb-5 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
             Please upload your proof of payment or related clearance certificate for the <strong className={isDarkMode ? "text-blue-300" : "text-blue-700 font-semibold"}>{target.title}</strong> stage.
           </p>

           <div className="relative group">
             <div className={`absolute inset-0 bg-blue-500/5 rounded-2xl transition-transform duration-300 ${!file ? 'group-hover:scale-105' : ''} -z-10`} />
             <div className={`relative border-2 border-dashed rounded-2xl p-7 flex flex-col items-center justify-center gap-3 transition-colors duration-300 ${isDarkMode ? "border-blue-500/30 bg-[#282a2d] hover:border-blue-400/50" : "border-blue-200 bg-white hover:border-blue-300"} cursor-pointer min-h-[160px]`}>
                <motion.div animate={{ y: !file ? [0, -4, 0] : 0 }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
                  <DocumentIcon className={`w-12 h-12 ${isDarkMode ? "text-blue-400" : "text-blue-500"} drop-shadow-sm`} />
                </motion.div>
                <div className="text-center mt-2">
                   {file ? (
                     <span className={`font-semibold text-[15px] ${isDarkMode ? "text-blue-300" : "text-blue-700"}`}>{file.name}</span>
                   ) : (
                     <div className="flex flex-col items-center">
                       <span className={`font-semibold text-[15px] ${isDarkMode ? "text-blue-300" : "text-blue-700"}`}>Click to browse</span>
                       <span className={`text-[13px] mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>or drag and drop your file here</span>
                     </div>
                   )}
                   <p className={`text-[12px] mt-2 ${isDarkMode ? "text-gray-500" : "text-gray-400"} font-medium uppercase tracking-wider`}>PDF, JPG, PNG (Max 5MB)</p>
                </div>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={isUploading} onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
             </div>
           </div>

           <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={onClose} disabled={isUploading} className={`px-5 py-2.5 rounded-[14px] font-semibold text-sm transition-colors ${isDarkMode ? "text-gray-300 hover:bg-[#3c4043]" : "text-gray-600 hover:bg-gray-100"}`}>
                 Cancel
              </button>
              <button type="submit" disabled={isUploading || !file} className="px-5 py-2.5 rounded-[14px] bg-blue-600 font-semibold text-sm text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center min-w-[140px] active:scale-95">
                 {isUploading ? (
                    <span className="flex items-center gap-2">
                       <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       Uploading...
                    </span>
                 ) : "Upload File"}
              </button>
           </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const ProgressBar = () => null;

export default function StudentDashboardGraduation({
  studentId,
  studentInfo,
  user,
  onSignOut,
  onOpenSettings,
  onManageAccount,
  isDarkMode = false,
  toggleTheme,
}) {
  const [clearanceStatus, setClearanceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const urlTab = searchParams.get("tab");
  const activeView = urlTab || sessionStorage.getItem("tab_student") || "home";

  const setActiveView = useCallback(
    (viewId) => {
      setSearchParams({ tab: viewId });
      sessionStorage.setItem("tab_student", viewId);
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (!urlTab) {
      setSearchParams({ tab: activeView }, { replace: true });
    }

  }, []);
  const [expandedStages, setExpandedStages] = useState({ professors: true });
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);
  const [appPortion, setAppPortion] = useState("undergraduate");
  const [documentTarget, setDocumentTarget] = useState(null);
  const [clearanceComments, setClearanceComments] = useState([]);
  const [requestHistoryLog, setRequestHistoryLog] = useState([]);
  const [docRefreshTrigger, setDocRefreshTrigger] = useState(0);

  const fetchClearanceComments = useCallback(
    async (reqId) => {
      if (!reqId) return;
      try {
        const commentsRes = await getClearanceComments(reqId, studentId);
        if (commentsRes.success)
          setClearanceComments(commentsRes.comments || []);
      } catch (e) {
        console.warn("Could not fetch clearance comments:", e);
      }
    },
    [studentId],
  );

  const loadingTimerRef = useRef(null);
  const fetchClearanceStatus = useCallback(async (silent = false) => {
    if (!silent) {
      loadingTimerRef.current = setTimeout(() => setLoading(true), 150);
    }
    try {
      const response = await authAxios.get(`/graduation/status/${studentId}`);
      if (response.data.success) {
        setClearanceStatus(response.data);

        const reqId =
          response.data.request?.request_id || response.data.request?.id;
        await Promise.all([
          fetchClearanceComments(reqId),
          reqId ? authAxios.get(`/requests/${reqId}/history`)
            .then(res => setRequestHistoryLog(res.data.history || []))
            .catch(e => console.warn("Could not fetch clearance history:", e)) : Promise.resolve()
        ]);
      }
    } catch (error) {
      console.error("Error fetching clearance status:", error);
      if (!silent) toast.error("Failed to load clearance status");
    } finally {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      if (!silent) setLoading(false);
    }
  }, [studentId, fetchClearanceComments]);

  useEffect(() => {
    document.title = "Student Dashboard | ISU Graduation Clearance";
    fetchClearanceStatus();
  }, [fetchClearanceStatus]);

  const activeReqId =
    clearanceStatus?.request?.request_id || clearanceStatus?.request?.id;

  useRealtimeSubscription(
    "clearance_comments",
    () => {
      if (activeReqId) fetchClearanceComments(activeReqId);
    },
    { filter: `clearance_id=eq.${activeReqId}`, enabled: !!activeReqId },
  );

  useRealtimeSubscription("requests", () => fetchClearanceStatus(true));
  useRealtimeSubscription("professor_approvals", () => fetchClearanceStatus(true));
  useRealtimeSubscription("profiles", () => fetchClearanceStatus(true));

  useEffect(() => {
    const interval = setInterval(() => fetchClearanceStatus(true), 30000);
    return () => clearInterval(interval);
  }, [fetchClearanceStatus]);

  const cancelModalRef = useRef(null);
  useEffect(() => {
    if (!showCancelModal) return;

    const modal = cancelModalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length > 0) focusable[0].focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowCancelModal(false);
        return;
      }
      if (e.key !== "Tab") return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showCancelModal]);

  const handleApplyClick = (portion) => {
    setAppPortion(portion);
    setShowAppModal(true);
  };

  const handleApplySubmit = async (formData) => {
    setShowAppModal(false);
    setApplying(formData.portion);
    try {
      const response = await authAxios.post(`/graduation/apply`, {
        student_id: studentId,
        ...formData,
      });
      if (response.data.success) {
        toast.success("Graduation clearance application submitted!");
        fetchClearanceStatus();
      }
    } catch (error) {
      const msg =
        error.response?.data?.error || "Failed to apply for clearance";
      toast.error(msg);
      if (msg.includes("already have")) {
        fetchClearanceStatus();
      }
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = () => setShowCancelModal(true);

  const confirmCancel = async () => {
    setShowCancelModal(false);
    setCancelling(true);
    try {
      const response = await authAxios.delete(
        `/graduation/cancel/${studentId}`,
      );
      if (response.data.success) {
        toast.success("Request cancelled successfully");

        setClearanceStatus({ success: true, hasRequest: false });
        setClearanceComments([]);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to cancel clearance");
    } finally {
      setCancelling(false);
    }
  };

  const toggleStage = (key) =>
    setExpandedStages((prev) => ({ ...prev, [key]: !prev[key] }));



  const handleRequestReevaluation = async (stage) => {
    try {
      const reqId =
        clearanceStatus?.request?.request_id || clearanceStatus?.request?.id;
      const payload = {
        request_id: reqId,
        stage_type: stage.type,
        stage_key: stage.key,
      };
      if (stage.type === "signatory" && stage.approval) {
        payload.approval_id = stage.approval.id;
      }
      const response = await authAxios.post(
        "/graduation/request-reevaluation",
        payload,
      );
      if (response.data.success) {
        toast.success(response.data.message || "Re-evaluation requested");
        fetchClearanceStatus();
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to request re-evaluation",
      );
    }
  };

  const stages = useMemo(() => {
    if (!clearanceStatus?.request) return [];
    const r = clearanceStatus.request;
    const profApprovals = clearanceStatus.professorApprovals || [];

    const isUndergraduate = r.portion === "undergraduate";

    const findProf = (name) =>
      profApprovals.find((a) => a.professor?.full_name === name);

    const buildProfNode = (approval, locked, fallbackName) => {
      const name = approval?.professor?.full_name || fallbackName || "Unknown";
      const avatarUrl = approval?.professor?.avatar_url || null;

      const effectiveStatus = !approval
        ? locked
          ? "locked"
          : "pending"
        : locked && approval.status === "pending"
          ? "locked"
          : approval.status;
      const profCC = approval
        ? clearanceComments.filter(
            (c) => c.commenter_id === approval.professor_id,
          )
        : [];
      const unresolvedCount =
        profCC.filter((c) => !c.is_resolved).length +
        (approval?.comments &&
        approval.comments.trim() &&
        approval.status !== "approved"
          ? 1
          : 0);
      const hasComments =
        profCC.length > 0 || !!(approval?.comments && approval.comments.trim());
      return {
        key: approval ? `prof-${approval.id}` : `prof-missing-${fallbackName}`,
        title: name,
        description: "Clearance Approval",
        iconComponent: <UsersIcon className="w-4 h-4 text-white" />,
        avatarUrl,
        status: effectiveStatus,
        comments: approval?.comments || null,
        hasChildren: false,
        hasComments,
        unresolvedCount,
        approval: approval || null,
        type: "signatory",
      };
    };

    const buildAdminNode = (key, title, description, icon, locked) => {
      const sField = {
        library: "library_status",
        cashier: "cashier_status",
        registrar: "registrar_status",
      }[key];
      const cField = {
        library: "library_comments",
        cashier: "cashier_comments",
        registrar: "registrar_comments",
      }[key];
      const st = r[sField] || "pending";
      const cm = r[cField];
      const roleMap = { library: "librarian", cashier: "cashier", registrar: "registrar" };
      const role = roleMap[key];
      const adminCC = clearanceComments.filter(c => c.commenter_role === role);
      const ccUnresolved = adminCC.filter(c => !c.is_resolved).length;
      
      return {
        key,
        title,
        description,
        iconComponent: icon,
        status: locked && st === "pending" ? "locked" : st,
        comments: cm,
        hasComments: !!(cm && cm.trim()) || adminCC.length > 0,
        unresolvedCount: ccUnresolved + ((cm && st !== "approved") ? 1 : 0),
        type: "stage",
      };
    };

    const steps = isUndergraduate
      ? [
          { type: "prof", name: "Department Chairman" },
          { type: "prof", name: "College Dean" },
          { type: "prof", name: "Director Student Affairs" },
          {
            type: "admin",
            key: "library",
            title: "Campus Librarian",
            desc: "Library clearance and book obligations",
            icon: <BookOpenIcon className="w-4 h-4 text-white" />,
          },
          {
            type: "admin",
            key: "cashier",
            title: "Chief Accountant",
            desc: "Financial obligations clearance",
            icon: <BanknotesIcon className="w-4 h-4 text-white" />,
          },
          { type: "prof", name: "NSTP Director" },
          { type: "prof", name: "Executive Officer" },
        ]
      : [
          {
            type: "admin",
            key: "cashier",
            title: "Chief Accountant",
            desc: "Financial obligations clearance",
            icon: <BanknotesIcon className="w-4 h-4 text-white" />,
          },
          {
            type: "admin",
            key: "library",
            title: "Campus Librarian",
            desc: "Library clearance and book obligations",
            icon: <BookOpenIcon className="w-4 h-4 text-white" />,
          },
          {
            type: "admin",
            key: "registrar",
            title: "Student's Record Evaluator",
            desc: "Record evaluation and validation",
            icon: <BuildingLibraryIcon className="w-4 h-4 text-white" />,
          },
          { type: "prof", name: "Dean Graduate School" },
        ];

    const result = [];
    let isLocked = false;
    for (const step of steps) {
      if (step.type === "prof") {
        const node = buildProfNode(findProf(step.name), isLocked, step.name);
        result.push(node);
        if (node.status !== "approved") isLocked = true;
      } else {
        const sField = {
          library: "library_status",
          cashier: "cashier_status",
          registrar: "registrar_status",
        }[step.key];
        const node = buildAdminNode(
          step.key,
          step.title,
          step.desc,
          step.icon,
          isLocked,
        );
        result.push(node);
        if ((r[sField] || "pending") !== "approved") isLocked = true;
      }
    }
    return result;
  }, [clearanceStatus, clearanceComments]);

  const unresolvedCommentCount = clearanceStatus?.unresolvedCommentCount || 0;

  const handlePrintClearance = async () => {
    const r = clearanceStatus?.request;
    if (!r || stages.length === 0) return;

    const { default: jsPDF } = await import("jspdf");
    const { default: html2canvas } = await import("html2canvas");
    const QRCode = (await import("qrcode")).default;

    const studentName = (studentInfo?.full_name || "N/A").toUpperCase();
    const studentNum = studentInfo?.student_number || "N/A";
    const courseYear = studentInfo?.course_year || "N/A";
    const portion =
      r.portion === "undergraduate" ? "Undergraduate" : "Graduate";
    const dateApplied = new Date(r.created_at).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const today = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const verifyUrl = `${window.location.origin}/verify/${r.certificate_number || r.id}`;
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 80, margin: 1 });
    } catch {

    }

    const profApprovals = clearanceStatus.professorApprovals || [];
    const stageRows = stages
      .map((s, i) => {
        let approverName = "";
        let dateCleared = "";

        if (s.type === "signatory" && s.approval) {
          approverName = s.approval.professor?.full_name || "";
          if (s.status === "approved" && s.approval.approved_at) {
            dateCleared = new Date(s.approval.approved_at).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric", year: "numeric" },
            );
          }
        } else if (s.type === "stage") {
          const atField = {
            library: "library_approved_at",
            cashier: "cashier_approved_at",
            registrar: "registrar_approved_at",
          }[s.key];

          const byField = {
            library: "library_approved_by",
            cashier: "cashier_approved_by",
            registrar: "registrar_approved_by",
          }[s.key];
          if (r[atField] && s.status === "approved") {
            dateCleared = new Date(r[atField]).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
          }

          if (s.status === "approved") approverName = s.title;
        }

        const statusText =
          s.status === "approved"
            ? approverName
              ? `CLEARED — ${approverName}`
              : "CLEARED"
            : s.status === "rejected"
              ? "ON HOLD"
              : s.status === "locked"
                ? "LOCKED"
                : "PENDING";
        const statusColor =
          s.status === "approved"
            ? "#166534"
            : s.status === "rejected"
              ? "#b91c1c"
              : "#6b7280";
        return `<tr>
        <td style="border:1px solid #333;padding:5px 8px;text-align:center;">${i + 1}</td>
        <td style="border:1px solid #333;padding:5px 8px;">${s.title}</td>
        <td style="border:1px solid #333;padding:5px 8px;text-align:center;font-weight:bold;color:${statusColor};font-size:9px;">${statusText}</td>
        <td style="border:1px solid #333;padding:5px 8px;text-align:center;font-size:9px;">${dateCleared}</td>
        <td style="border:1px solid #333;padding:5px 8px;font-size:9px;color:#444;">${s.comments || ""}</td>
      </tr>`;
      })
      .join("");

    const approvedCount = stages.filter((s) => s.status === "approved").length;
    const totalCount = stages.length;

    const container = document.createElement("div");
    container.style.cssText =
      "position:absolute;left:-9999px;top:0;width:794px;background:#fff;";
    container.innerHTML = `
      <div style="font-family:'Times New Roman',Times,serif;color:#000;width:794px;background:#fff;padding:30px 60px 25px;">

        <!-- HEADER -->
        <div style="text-align:center;margin-bottom:2px;">
          <img src="${window.location.origin}/IsabelaLogo.jpg" style="width:55px;height:55px;display:block;margin:0 auto 4px;" crossorigin="anonymous" />
          <div style="font-size:14px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">ISABELA STATE UNIVERSITY</div>
          <div style="font-size:10px;font-style:italic;">Echague, Isabela</div>
        </div>
        <div style="text-align:center;font-size:8px;color:#777;margin-bottom:10px;">ISO 9001:2015 &nbsp;|&nbsp; ISO 14001:2015 &nbsp;|&nbsp; OHSAS 18001:2007</div>

        <!-- FORM TITLE -->
        <div style="text-align:center;border-top:1.5px solid #000;border-bottom:1.5px solid #000;padding:5px 0;margin-bottom:12px;">
          <div style="font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Graduation Clearance Form</div>
          <div style="font-size:8px;color:#666;margin-top:1px;">REG Form 07 &mdash; ${portion} Portion</div>
        </div>

        <!-- STUDENT INFO -->
        <table style="width:100%;border:none;font-size:10px;margin-bottom:12px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:50%;padding:3px 0;">
              <table style="width:100%;border:none;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:95px;font-weight:bold;padding:2px 0;white-space:nowrap;">ID No:</td>
                  <td style="padding:2px 0;border-bottom:1px solid #999;">${studentNum}</td>
                </tr>
              </table>
            </td>
            <td style="width:50%;padding:3px 0 3px 20px;">
              <table style="width:100%;border:none;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:95px;font-weight:bold;padding:2px 0;white-space:nowrap;">Date Applied:</td>
                  <td style="padding:2px 0;border-bottom:1px solid #999;">${dateApplied}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:3px 0;">
              <table style="width:100%;border:none;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:95px;font-weight:bold;padding:2px 0;white-space:nowrap;">Name:</td>
                  <td style="padding:2px 0;border-bottom:1px solid #999;font-weight:bold;">${studentName}</td>
                </tr>
              </table>
            </td>
            <td style="padding:3px 0 3px 20px;">
              <table style="width:100%;border:none;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:95px;font-weight:bold;padding:2px 0;white-space:nowrap;">Status:</td>
                  <td style="padding:2px 0;border-bottom:1px solid #999;">${r.is_completed ? "Completed" : "In Progress"}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:3px 0;">
              <table style="width:100%;border:none;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:95px;font-weight:bold;padding:2px 0;white-space:nowrap;">Program:</td>
                  <td style="padding:2px 0;border-bottom:1px solid #999;">${courseYear}</td>
                </tr>
              </table>
            </td>
            <td style="padding:3px 0 3px 20px;">
              <table style="width:100%;border:none;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:95px;font-weight:bold;padding:2px 0;white-space:nowrap;">Date Printed:</td>
                  <td style="padding:2px 0;border-bottom:1px solid #999;">${today}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- CLEARANCE TABLE -->
        <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:10px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="border:1px solid #333;padding:5px 8px;text-align:center;width:30px;font-weight:bold;">NO.</th>
              <th style="border:1px solid #333;padding:5px 8px;text-align:left;width:130px;font-weight:bold;">OFFICE / SIGNATORY</th>
              <th style="border:1px solid #333;padding:5px 8px;text-align:center;width:140px;font-weight:bold;">STATUS</th>
              <th style="border:1px solid #333;padding:5px 8px;text-align:center;width:80px;font-weight:bold;">DATE</th>
              <th style="border:1px solid #333;padding:5px 8px;text-align:left;font-weight:bold;">REMARKS</th>
            </tr>
          </thead>
          <tbody style="font-size:10px;">${stageRows}</tbody>
        </table>

        <!-- PROGRESS SUMMARY -->
        <div style="border:1px solid #333;padding:6px 10px;font-size:10px;margin-bottom:20px;background:#fafafa;">
          <strong>Progress: ${approvedCount} of ${totalCount} stages cleared</strong>
          &nbsp;&mdash;&nbsp;
          ${
            r.is_completed
              ? '<span style="color:#166534;font-weight:bold;">ALL STAGES CLEARED</span>'
              : `<span style="color:#92400e;">${totalCount - approvedCount} stage(s) remaining</span>`
          }
        </div>

        <!-- SIGNATURES -->
        <table style="width:100%;border:none;margin-top:35px;font-size:9px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:45%;text-align:center;padding-top:30px;">
              <div style="border-top:1px solid #000;display:inline-block;min-width:200px;padding-top:3px;">Student's Signature Over Printed Name</div>
            </td>
            <td style="width:10%;"></td>
            <td style="width:45%;text-align:center;padding-top:30px;">
              <div style="border-top:1px solid #000;display:inline-block;min-width:200px;padding-top:3px;">Registrar / Authorized Officer</div>
            </td>
          </tr>
        </table>

        <!-- FOOTER NOTE -->
        <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:18px;">
          <div style="flex:1;text-align:left;font-size:8px;color:#888;font-style:italic;">
            <strong>Effectivity: February 20, 2024</strong>&nbsp;&nbsp;&nbsp;&nbsp;<strong>Revision: 0</strong><br/>
              <em>Isui-ReO-Stc-001f</em><br/><br/>
              This document was generated by the SmartClearance System of Isabela State University.<br/>
            This is not an official clearance certificate. For official copies, please visit the Registrar's Office.
          </div>
          ${
            qrDataUrl
              ? `<div style="flex-shrink:0;margin-left:15px;text-align:center;">
            <img src="${qrDataUrl}" style="width:60px;height:60px;" />
            <div style="font-size:7px;color:#888;margin-top:2px;">Scan to verify</div>
          </div>`
              : ""
          }
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const img = container.querySelector("img");
    if (img && !img.complete) {
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }

    try {
      const canvas = await html2canvas(container.firstElementChild, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 794,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

      const pdfBlob = pdf.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank");
    } finally {
      document.body.removeChild(container);
    }
  };

  const theme = getStudentTheme(isDarkMode);

  const menuItems = [
    {
      id: "home",
      label: "Overview",
      icon: <HomeIcon className="w-5 h-5" />,
    },
    {
      id: "status",
      label: "Clearance Status",
      icon: <ChartBarIcon className="w-5 h-5" />,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <BellIcon className="w-5 h-5" />,
    },
    {
      id: "history",
      label: "Request History",
      icon: <ClockIcon className="w-5 h-5" />,
    },
    {
      id: "certificate",
      label: "Certificate",
      icon: <AcademicCapIcon className="w-5 h-5" />,
    },
    {
      id: "profile",
      label: "My Profile",
      icon: <UserIcon className="w-5 h-5" />,
    },
  ];

  return (
    <DashboardLayout
      theme={theme}
      menuItems={menuItems}
      activeView={activeView}
      setActiveView={setActiveView}
      userInfo={{
        name: studentInfo?.full_name,
        subtitle: studentInfo?.student_number,
        avatar: user?.user_metadata?.avatar_url,
      }}
      onSignOut={onSignOut}
      onOpenSettings={onOpenSettings}
      onManageAccount={onManageAccount}
      toggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
    >
      {activeView === "home" && (
        <StudentOverview
          studentInfo={studentInfo}
          clearanceStatus={clearanceStatus}
          stages={stages}
          setActiveView={setActiveView}
          isDarkMode={isDarkMode}
        />
      )}

      {activeView === "status" && (
        <div className="w-full max-w-[1600px] mx-auto space-y-6">
          <div className="mb-2">
            <h2
              className={`text-[28px] font-normal tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
              style={{ fontFamily: "Google Sans, sans-serif" }}
            >
              Student Clearance
            </h2>
            <p
              className={`text-sm mt-1 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
            >
              Track your student clearance progress
            </p>
          </div>

          {loading ? (
            <div className="space-y-6">
              <GlassCard
                isDark={isDarkMode}
                className="p-8 border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-3xl"
              >
                <div className="flex justify-between items-start mb-6 w-full">
                  <div className="flex gap-4">
                    <div
                      className={`p-3 rounded-2xl w-12 h-12 flex-shrink-0 animate-pulse ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}
                    />
                    <div>
                      <div
                        className={`h-6 w-32 rounded mb-2 animate-pulse ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}
                      />
                      <div
                        className={`h-4 w-48 rounded animate-pulse ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}
                      />
                    </div>
                  </div>
                  <div
                    className={`h-8 w-24 rounded-full animate-pulse ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}
                  />
                </div>
              </GlassCard>

              <GlassCard
                isDark={isDarkMode}
                className="p-8 border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-3xl"
              >
                <div
                  className={`h-6 w-48 rounded mb-2 animate-pulse ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}
                />
                <div
                  className={`h-4 w-64 rounded mb-8 animate-pulse ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}
                />

                <div className="space-y-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div
                          className={`w-10 h-10 rounded-full animate-pulse ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}
                        />
                        {i !== 4 && (
                          <div
                            className={`w-0.5 h-[50px] animate-pulse ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}
                          />
                        )}
                      </div>

                      <div className="flex-1 pb-6 w-full">
                        <div
                          className={`rounded-2xl p-4 flex items-center justify-between w-full h-[72px] animate-pulse ${isDarkMode ? "bg-slate-800/50" : "bg-slate-50"}`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-9 h-9 rounded-full ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`}
                            />
                            <div>
                              <div
                                className={`h-4 w-32 rounded mb-1.5 ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`}
                              />
                              <div
                                className={`h-3 w-48 rounded ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`}
                              />
                            </div>
                          </div>
                          <div
                            className={`h-6 w-16 rounded-full ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          ) : !clearanceStatus?.hasRequest ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-[1600px] mx-auto"
            >
              {}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="h-full relative group"
              >
                <GlassCard
                  isDark={isDarkMode}
                  className={`p-8 md:p-10 text-center flex flex-col justify-between h-full rounded-[24px] border ${isDarkMode ? "border-[#3c4043] bg-[#202124]" : "border-[#dadce0] bg-white"} shadow-[0_1px_2px_0_rgba(60,64,67,0.3)] hover:shadow-[0_4px_10px_0_rgba(60,64,67,0.15)] transition-all duration-300`}
                >
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${isDarkMode ? "bg-primary-400" : "bg-primary-600"} rounded-t-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  />

                  <div className="flex-1 flex flex-col items-center">
                    <motion.div
                      whileHover={{ scale: 1.05, rotate: -5 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 mt-2 ${isDarkMode ? "bg-primary-400/10" : "bg-primary-50"}`}
                    >
                      <AcademicCapIcon
                        className={`w-8 h-8 ${isDarkMode ? "text-primary-400" : "text-primary-600"}`}
                      />
                    </motion.div>

                    <h3
                      className={`text-[20px] font-medium mb-3 tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
                      style={{ fontFamily: "Google Sans, sans-serif" }}
                    >
                      Undergraduate Portion
                    </h3>
                    <p
                      className={`mb-8 text-[14px] leading-relaxed max-w-[280px] mx-auto ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
                    >
                      Standard clearance process including Department Chairman,
                      College Dean, and Executive Officer approvals.
                    </p>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleApplyClick("undergraduate")}
                    disabled={applying !== false}
                    className={`w-full py-2.5 rounded-full font-medium text-[14px] transition-all duration-200 border border-transparent ${
                      applying !== false
                        ? "opacity-50 cursor-not-allowed"
                        : isDarkMode
                          ? "hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)] bg-primary-400 text-dark-bg hover:bg-primary-300"
                          : "hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] bg-primary-600 text-white hover:bg-primary-700"
                    }`}
                    style={{ fontFamily: "Google Sans, sans-serif" }}
                  >
                    {applying === "undergraduate"
                      ? "Applying..."
                      : "Select Undergraduate"}
                  </motion.button>
                </GlassCard>
              </motion.div>

              {}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  ease: [0.2, 0, 0, 1],
                  delay: 0.05,
                }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="h-full relative group"
              >
                <GlassCard
                  isDark={isDarkMode}
                  className={`p-8 md:p-10 text-center flex flex-col justify-between h-full rounded-[24px] border ${isDarkMode ? "border-[#3c4043] bg-[#202124]" : "border-[#dadce0] bg-white"} shadow-[0_1px_2px_0_rgba(60,64,67,0.3)] hover:shadow-[0_4px_10px_0_rgba(60,64,67,0.15)] transition-all duration-300`}
                >
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${isDarkMode ? "bg-secondary-400" : "bg-secondary-600"} rounded-t-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  />

                  <div className="flex-1 flex flex-col items-center">
                    <motion.div
                      whileHover={{ scale: 1.05, rotate: 5 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 mt-2 ${isDarkMode ? "bg-secondary-400/10" : "bg-secondary-50"}`}
                    >
                      <BookOpenIcon
                        className={`w-8 h-8 ${isDarkMode ? "text-secondary-400" : "text-secondary-600"}`}
                      />
                    </motion.div>

                    <h3
                      className={`text-[20px] font-medium mb-3 tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
                      style={{ fontFamily: "Google Sans, sans-serif" }}
                    >
                      Graduate Portion
                    </h3>
                    <p
                      className={`mb-8 text-[14px] leading-relaxed max-w-[280px] mx-auto ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
                    >
                      Specialized clearance process for Master's and Doctoral
                      students requiring Graduate School approval.
                    </p>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleApplyClick("graduate")}
                    disabled={applying !== false}
                    className={`w-full py-2.5 rounded-full font-medium text-[14px] transition-all duration-200 border border-transparent ${
                      applying !== false
                        ? "opacity-50 cursor-not-allowed"
                        : isDarkMode
                          ? "hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)] bg-secondary-400 text-dark-bg hover:bg-secondary-300"
                          : "hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] bg-secondary-600 text-white hover:bg-secondary-700"
                    }`}
                    style={{ fontFamily: "Google Sans, sans-serif" }}
                  >
                    {applying === "graduate"
                      ? "Applying..."
                      : "Select Graduate"}
                  </motion.button>
                </GlassCard>
              </motion.div>
            </motion.div>
          ) : (
            <>
              <GlassCard
                isDark={isDarkMode}
                className={`p-5 sm:p-7 border ${isDarkMode ? "border-[#3c4043] bg-[#202124]" : "border-slate-200 bg-white"} shadow-sm rounded-[24px] relative overflow-hidden transition-all duration-300`}
              >
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-8">
                  {}
                  <div className="flex items-start md:items-center gap-5 sm:gap-6 flex-1">
                    {}
                    <div className="relative flex-shrink-0 mt-1 md:mt-0">
                      <div
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-300 ${isDarkMode ? "bg-primary-900/20 text-primary-400 shadow-[#000]/20" : "bg-gradient-to-br from-primary-50 to-primary-100/80 text-primary-600"}`}
                      >
                        <AcademicCapIcon className="w-8 h-8 drop-shadow-sm" />
                      </div>
                      <div
                        className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-md ${isDarkMode ? "bg-[#202124]" : "bg-white"}`}
                      >
                        <div className="w-4 h-4 rounded-full bg-secondary-500 shadow-[0_0_10px_rgba(234,179,8,0.6)] animate-pulse" />
                      </div>
                    </div>

                    {}
                    <div className="flex flex-col gap-2.5 flex-1">
                      {}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.05em] ${isDarkMode ? "bg-[#3c4043]/50 text-[#e8eaed]" : "bg-slate-100 text-slate-600"}`}
                        >
                          <ClockIcon className="w-4 h-4 opacity-70" />
                          <span>
                            Applied{" "}
                            {new Date(clearanceStatus.request.created_at)
                              .toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                              .toUpperCase()}
                          </span>
                        </div>
                        <span
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.05em] shadow-sm border ${isDarkMode ? "bg-[#3c4043] text-[#e8eaed] border-[#5f6368]" : "bg-white text-slate-800 border-slate-200"}`}
                        >
                          {clearanceStatus.request.portion === "undergraduate"
                            ? "Undergraduate Portion"
                            : "Graduate Portion"}
                        </span>
                      </div>

                      {}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-0.5">
                        <h3
                          className={`font-normal text-[16px] ${isDarkMode ? "text-[#9aa0a6]" : "text-slate-600"}`}
                          style={{ fontFamily: "Google Sans, sans-serif" }}
                        >
                          Current Stage:
                        </h3>
                        <div
                          className={`px-4 py-1.5 rounded-full text-[15px] font-bold flex items-center gap-2.5 border transition-all ${isDarkMode ? "bg-primary-900/10 text-primary-400 border-primary-500/30" : "bg-white text-primary-600 border-primary-500"}`}
                          style={{ fontFamily: "Google Sans, sans-serif" }}
                        >
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                          </span>
                          {clearanceStatus.request.current_stage}
                        </div>

                        {unresolvedCommentCount > 0 && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 20,
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[#fce8e6] text-[#c5221f] border border-[#f28b82]/30"
                          >
                            <ChatBubbleIcon className="w-4 h-4 text-[#ea4335]" />
                            {unresolvedCommentCount} Action Required
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </div>

                  {}
                  <div
                    className={`hidden md:block w-px h-16 ${isDarkMode ? "bg-[#3c4043]" : "bg-slate-200"}`}
                  />

                  <div className="flex-shrink-0 w-full md:w-auto">
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className={`group flex items-center justify-center gap-2 w-full md:w-auto px-6 py-2.5 rounded-full font-bold transition-all duration-200 active:scale-[0.98] text-[13px] uppercase tracking-wide disabled:opacity-50 ${
                        isDarkMode
                          ? "bg-transparent text-rose-400 hover:bg-rose-500/10"
                          : "bg-transparent text-rose-600 hover:bg-rose-50"
                      }`}
                    >
                      {cancelling ? (
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      ) : (
                        <XMarkIcon className="w-4 h-4 transition-transform group-hover:rotate-90" />
                      )}
                      <span>
                        {cancelling ? "Cancelling..." : "Cancel Application"}
                      </span>
                    </button>
                  </div>
                </div>
              </GlassCard>

              <div className="w-full">
                {/* Top Bento Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-2">
                  
                  {/* Left: The Next Milestone Hero Card */}
                  <div className={`col-span-1 lg:col-span-2 rounded-[32px] p-8 sm:p-10 flex flex-col justify-center relative overflow-hidden shadow-sm border ${isDarkMode ? "bg-[#0B3D2B] border-[#135A42] shadow-[0_8px_30px_-5px_rgba(0,0,0,0.4)]" : "bg-[#074F34] border-[#074F34]/90 shadow-[0_8px_30px_-5px_rgba(7,79,52,0.3)]"} text-white group`}>
                    <div className="absolute right-0 top-0 w-96 h-96 bg-white opacity-5 mix-blend-overlay rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3 transition-transform duration-1000 group-hover:scale-110 pointer-events-none" />
                    
                    <div className="relative z-10 w-full h-full flex flex-col justify-center">
                       <span className={`inline-block w-max px-3 py-1.5 mb-6 text-[11px] font-bold tracking-[0.2em] uppercase rounded-full ${isDarkMode ? "bg-primary-500/20 text-primary-300 border border-primary-500/30" : "bg-white/10 text-emerald-100 border border-white/20"} backdrop-blur-md`}>
                         Next Milestone
                       </span>

                       {(() => {
                         const currentPending = stages.find(s => s.status === "pending" || s.status === "rejected");
                         const isDone = stages.length > 0 && stages.every(s => s.status === 'approved');

                         if (currentPending) {
                            return (
                              <>
                                <h2 className="text-[32px] sm:text-[40px] font-bold leading-tight tracking-tight mb-4" style={{ fontFamily: "Google Sans, sans-serif" }}>
                                  {currentPending.title}
                                </h2>
                                <p className="text-[15px] sm:text-[16px] text-emerald-50/90 max-w-xl leading-relaxed mb-8">
                                  {currentPending.description || "Review the requirements, submit necessary documents, and address any feedback quickly to proceed."}
                                </p>
                                <div className="flex flex-wrap items-center gap-4 mt-auto">
                                   {currentPending.status === "rejected" && handleRequestReevaluation && (
                                     <button className="px-6 py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-bold transition-all shadow-lg active:scale-95" onClick={(e) => { e.stopPropagation(); handleRequestReevaluation(currentPending); }}>
                                        Request Re-eval
                                     </button>
                                   )}
                                   <button onClick={() => setExpandedStages(prev => ({ ...prev, [currentPending.key]: true }))} className={`px-6 py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2 ${isDarkMode ? "bg-white text-[#0B3D2B] hover:bg-emerald-50" : "bg-emerald-400 text-[#074F34] hover:bg-emerald-300"}`}>
                                      Check Details
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                   </button>
                                </div>
                              </>
                            );
                         } else {
                            return (
                              <>
                                <h2 className="text-[32px] sm:text-[40px] font-bold leading-tight tracking-tight mb-4" style={{ fontFamily: "Google Sans, sans-serif" }}>
                                  {isDone ? "Clearance Complete" : "No Active Milestone"}
                                </h2>
                                <p className="text-[15px] sm:text-[16px] text-emerald-50/90 max-w-xl leading-relaxed mb-8">
                                  {isDone ? "Congratulations! Your university clearance is fully processed and approved." : "All submitted requirements are currently under review."}
                                </p>
                              </>
                            );
                         }
                       })()}
                    </div>
                  </div>

                  {/* Right: Progress Compact Card */}
                  <div className={`col-span-1 rounded-[32px] p-8 flex flex-col relative overflow-hidden transition-colors border shadow-sm ${isDarkMode ? "bg-[#202124] border-[#3c4043]" : "bg-slate-50 border-slate-200"}`}>
                    {(() => {
                       const approved = stages.filter(s => s.status === 'approved').length;
                       const total = stages.length;
                       const pct = total > 0 ? (approved / total) * 100 : 0;
                       
                       return (
                         <div className="w-full h-full flex flex-col justify-between gap-6 relative z-10">
                           <div className="flex items-center gap-4">
                              <div className={`w-[48px] h-[48px] rounded-[14px] flex items-center justify-center shadow-md border ${isDarkMode ? "bg-[#282a2d] text-primary-400 border-[#3c4043]" : "bg-white text-[#074F34] border-slate-100"}`}>
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                              </div>
                              <h3 className={`text-[19px] font-bold ${isDarkMode ? "text-white" : "text-slate-800"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>Progress</h3>
                           </div>
                           
                           <div className="flex flex-col flex-1 items-center justify-center -mt-4">
                              <div className="relative flex items-end">
                                <span className={`text-[86px] sm:text-[96px] font-black tracking-tighter leading-none ${pct === 100 ? (isDarkMode ? "text-emerald-400" : "text-emerald-600") : (isDarkMode ? "text-white" : "text-slate-800")}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
                                  {Math.round(pct)}
                                </span>
                                <span className={`text-[24px] font-bold pb-[18px] ml-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>%</span>
                              </div>
                              <span className={`text-[11px] font-bold tracking-[0.25em] uppercase mt-2 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Completion Rate</span>
                           </div>

                           <div className="mt-auto">
                             <div className="flex justify-between items-center text-[13px] font-bold mb-3">
                               <span className={isDarkMode ? "text-slate-400" : "text-slate-500"}>{approved} Stages Cleared</span>
                               <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>of {total}</span>
                             </div>
                             <div className={`h-3 w-full rounded-full overflow-hidden shadow-inner ${isDarkMode ? "bg-[#303134]" : "bg-slate-200"}`}>
                               <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, delay: 0.2 }} className={`h-full rounded-full ${isDarkMode ? "bg-emerald-500" : "bg-[#074F34]"}`} />
                             </div>
                           </div>
                         </div>
                       );
                    })()}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-8 mb-4 px-2">
                  <h3 className={`text-[23px] font-bold tracking-tight ${isDarkMode ? "text-white" : "text-slate-800"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>All Clearances</h3>
                  <button onClick={handlePrintClearance} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold tracking-wider uppercase transition-all shadow-sm print:hidden ${isDarkMode ? "bg-[#3c4043] hover:bg-[#5f6368] text-[#e8eaed]" : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300"}`} title="Print clearance progress">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Record
                  </button>
                </div>
                
                <div className="flex flex-col gap-4">
                  {stages.map((stage, i) => (
                    <StageNode
                      key={stage.key}
                      stage={stage}
                      index={i}
                      total={stages.length}
                      isExpanded={expandedStages[stage.key]}
                      onToggle={() =>
                        setExpandedStages((prev) => ({
                          ...prev,
                          [stage.key]: !prev[stage.key],
                        }))
                      }
                      unresolvedCount={stage.unresolvedCount}
                      hasComments={stage.hasComments}
                      onViewComments={() => {
                        setExpandedStages((prev) => ({
                          ...prev,
                          [stage.key]: true,
                        }));
                      }}
                      onUploadDocument={() => setDocumentTarget(stage)}
                      onRequestReevaluation={handleRequestReevaluation}
                      isDarkMode={isDarkMode}
                    >
                      <UploadedDocumentsList
                        requestId={activeReqId}
                        studentId={studentId}
                        isDarkMode={isDarkMode}
                        refreshKey={`${clearanceStatus?.request?.updated_at || ""}-${docRefreshTrigger}`}
                      />
                      <InlineCommentThread
                        stage={stage}
                        requestId={activeReqId}
                        studentId={studentId}
                        clearanceComments={clearanceComments}
                        onCommentAdded={() => fetchClearanceComments(activeReqId)}
                        isDarkMode={isDarkMode}
                        user={user}
                        studentInfo={studentInfo}
                      />
                    </StageNode>
                  ))}
                </div>
              </div>

              {/* Activity Timeline Section */}
              {requestHistoryLog && requestHistoryLog.length > 0 && (
                <GlassCard
                  isDark={isDarkMode}
                  className={`p-6 sm:p-9 border-none shadow-[0_4px_12px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.02)] rounded-[28px] mt-6 ${isDarkMode ? "bg-[#202124]" : "bg-white"}`}
                >
                  <div className="flex items-center gap-3 mb-8">
                    <div className={`p-2.5 rounded-xl ${isDarkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                      <ClockIcon className="w-6 h-6" />
                    </div>
                    <h3 className={`text-[22px] font-medium tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`} style={{ fontFamily: "Google Sans, sans-serif" }}>
                      Clearance Activity Timeline
                    </h3>
                  </div>

                  <div className="space-y-6">
                    {requestHistoryLog.map((logItem, idx) => {
                      const date = new Date(logItem.created_at);

                      let color = "blue";
                      if (logItem.action === "approved" || logItem.action === "created") color = "emerald";
                      if (logItem.action === "rejected") color = "red";

                      let actorName = logItem.stage_name ? logItem.stage_name.charAt(0).toUpperCase() + logItem.stage_name.slice(1) : (logItem.profiles?.full_name || "System");
                      if (logItem.action === "created") actorName = "You";

                      let titleText = logItem.action === "created" ? "Applied for clearance" : `${actorName} ${logItem.action}`;
                      if (logItem.action === "commented") titleText = `${actorName} left a comment`;

                      return (
                         <div key={logItem.id} className="relative pl-8 sm:pl-10">
                           {/* Connecting Line */}
                           {idx !== requestHistoryLog.length - 1 && (
                             <div className={`absolute left-[11px] sm:left-[15px] top-[30px] bottom-[-24px] w-[2px] rounded-full ${isDarkMode ? "bg-[#3c4043]" : "bg-gray-100"}`} />
                           )}

                           {/* Dot */}
                           <div className={`absolute left-0 sm:left-1 top-1 w-6 h-6 rounded-full flex items-center justify-center ring-[4px] sm:ring-[6px] ${isDarkMode ? "ring-[#202124]" : "ring-white"}
                              ${color === 'emerald' ? 'bg-[#10b981]' : color === 'red' ? 'bg-[#ef4444]' : 'bg-[#3b82f6]'}`}
                           >
                             <div className={`w-2 h-2 rounded-full ${isDarkMode ? "bg-[#202124]" : "bg-white"}`} />
                           </div>

                           <div className="bg-transparent mt-[2px]">
                             <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1 sm:gap-4 mb-2">
                               <h4 className={`font-semibold text-[15px] tracking-tight ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                                 {titleText}
                               </h4>
                               <span className={`text-[13px] font-medium whitespace-nowrap ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                 {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}
                               </span>
                             </div>
                             {logItem.comments && (
                               <div className={`p-4 rounded-xl border text-[14px] leading-relaxed ${isDarkMode ? "bg-[#282a2d] border-[#3c4043] text-gray-300" : "bg-gray-50/80 border-gray-100 text-gray-700"}`}>
                                  {logItem.comments}
                               </div>
                             )}
                           </div>
                         </div>
                      );
                    })}
                  </div>
                </GlassCard>
              )}
            </>
          )}
        </div>
      )}

      {activeView === "history" && (
        <div className="w-full max-w-[1600px] mx-auto space-y-6">
          <div className="mb-2">
            <h2
              className={`text-[28px] font-normal tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
              style={{ fontFamily: "Google Sans, sans-serif" }}
            >
              Request History
            </h2>
            <p
              className={`text-sm mt-1 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
            >
              View your past clearance requests and their outcomes
            </p>
          </div>
          <StudentRequestHistory
            studentId={studentId}
            isDarkMode={isDarkMode}
          />
        </div>
      )}

      {activeView === "certificate" && (
        <div className="w-full max-w-[1600px] mx-auto space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-1 text-gray-900">
              Graduation Certificate
            </h2>
            <p className="text-gray-500">
              Download or print your graduation clearance certificate
            </p>
          </div>
          {clearanceStatus?.request?.certificate_generated ? (
            <GraduationCertificate
              requestId={clearanceStatus.request.request_id}
              studentId={studentId}
              studentInfo={studentInfo}
            />
          ) : (
            <GlassCard className="p-12 text-center">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-5"
              >
                <DocumentCheckIcon className="w-10 h-10 text-gray-400" />
              </motion.div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                Certificate Not Yet Available
              </h3>
              <p className="max-w-md mx-auto text-gray-500">
                Your certificate will be generated once the Registrar approves
                your clearance.
              </p>
            </GlassCard>
          )}
        </div>
      )}

      {activeView === "notifications" && (
        <div className="w-full max-w-[1600px] mx-auto space-y-6">
          <div className="mb-2">
            <h2
              className={`text-[28px] font-normal tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
              style={{ fontFamily: "Google Sans, sans-serif" }}
            >
              Notifications
            </h2>
            <p
              className={`text-sm mt-1 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
            >
              Stay updated on your clearance progress
            </p>
          </div>
          <StudentNotifications isDarkMode={isDarkMode} />
        </div>
      )}

      {activeView === "profile" && (
        <div className="w-full max-w-[1600px] mx-auto space-y-6">
          <div className="mb-2">
            <h2
              className={`text-[28px] font-normal tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`}
              style={{ fontFamily: "Google Sans, sans-serif" }}
            >
              My Profile
            </h2>
            <p
              className={`text-sm mt-1 ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}`}
            >
              View and manage your account information
            </p>
          </div>
          <StudentProfile
            studentInfo={studentInfo}
            user={user}
            isDarkMode={isDarkMode}
          />
        </div>
      )}

      <AnimatePresence mode="wait">
      </AnimatePresence>
      <AnimatePresence>
        {showAppModal && (
          <ApplicationModal
            isOpen={showAppModal}
            onClose={() => setShowAppModal(false)}
            onSubmit={handleApplySubmit}
            portion={appPortion}
            studentInfo={studentInfo}
            isDarkMode={isDarkMode}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCancelModal && (
          <div
            ref={cancelModalRef}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
          >
            {}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute inset-0 bg-[#202124]/40 backdrop-blur-[4px]"
              onClick={() => setShowCancelModal(false)}
            />

            {}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-[420px] rounded-[28px] overflow-hidden flex flex-col shadow-[0_24px_38px_3px_rgba(0,0,0,0.14),0_9px_46px_8px_rgba(0,0,0,0.12),0_11px_15px_-7px_rgba(0,0,0,0.2)] ${
                isDarkMode ? "bg-[#28292a]" : "bg-white"
              }`}
              style={{ fontFamily: "'Google Sans', 'Inter', sans-serif" }}
            >
              {}
              <div
                className={`h-[6px] w-full ${isDarkMode ? "bg-[#f28b82]/90" : "bg-[#d93025]"}`}
              />

              {}
              <div className="px-7 pt-8 pb-2 sm:px-9 sm:pt-9 sm:pb-4 flex flex-col items-center text-center">
                {}
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-colors ${
                    isDarkMode
                      ? "bg-red-900/30 text-[#f28b82]"
                      : "bg-red-50 text-[#d93025]"
                  }`}
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>

                {}
                <h3
                  id="cancel-modal-title"
                  className={`text-[24px] font-medium mb-3 leading-tight tracking-[-0.015em] ${
                    isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"
                  }`}
                >
                  Cancel clearance?
                </h3>

                {}
                <p
                  className={`text-[15px] leading-[24px] font-normal ${
                    isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"
                  }`}
                >
                  This action will permanently discard your current graduation
                  clearance progress and all approvals.
                </p>
              </div>

              {}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-7 pb-8 pt-6 sm:px-9 sm:pb-9">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className={`w-full sm:w-auto flex-1 py-3 px-5 rounded-full text-[15px] font-medium transition-all duration-200 active:scale-[0.98] ${
                    isDarkMode
                      ? "bg-transparent text-[#e8eaed] hover:bg-[#3c4043]"
                      : "bg-transparent text-[#3c4043] hover:bg-[#f1f3f4]"
                  }`}
                >
                  Keep Request
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={cancelling}
                  className={`w-full sm:w-auto flex-1 py-3 px-5 rounded-full text-[15px] font-medium transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 ${
                    cancelling ? "opacity-70 cursor-not-allowed" : ""
                  } ${
                    isDarkMode
                      ? "bg-[#f28b82] text-[#202124] hover:bg-[#f5a19a] shadow-sm"
                      : "bg-[#d93025] text-white hover:bg-[#c5221f] shadow-[0_1px_2px_rgba(217,48,37,0.3)]"
                  }`}
                >
                  {cancelling ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 h-5 w-5 text-current"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    "Yes, Cancel It"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {documentTarget && (
          <DocumentUploadModal
            target={documentTarget}
            requestId={clearanceStatus?.request?.id || clearanceStatus?.request?.request_id}
            studentId={studentId}
            onClose={() => setDocumentTarget(null)}
            onUploadSuccess={() => {
              fetchClearanceStatus(true);
              setDocRefreshTrigger(prev => prev + 1);
            }}
            isDarkMode={isDarkMode}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
