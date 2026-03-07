import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { getClearanceComments } from "../services/api";
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
} from "../components/ui/Icons";

const API_URL = import.meta.env.VITE_API_URL;

const UnresolvedBadge = ({ count = 0 }) => {
  if (count <= 0) return null;
  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fce8e6] text-[#c5221f] border border-transparent"
    >
      {count === 1 ? "Unresolved" : `${count} Unresolved`}
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
  children,
  isDarkMode = false,
}) => {
  const isLast = index === total - 1;
  const statusConfig = {
    approved: {
      color: "bg-[#1e8e3e]",
      bg: isDarkMode ? "bg-[#303e33] border border-transparent" : "bg-[#e6f4ea] border border-transparent",
      badge: isDarkMode ? "bg-transparent text-[#81c995]" : "bg-transparent text-[#137333]",
      icon: <CheckIcon className="w-5 h-5 text-white" />,
      label: "Approved",
      iconBg: isDarkMode ? "bg-[#81c995]" : "bg-[#1e8e3e]",
    },
    rejected: {
      color: isDarkMode ? "bg-[#f28b82]" : "bg-[#d93025]",
      bg: isDarkMode ? "bg-[#45272a] border border-[#fce8e6]" : "bg-[#fce8e6] border border-[#fce8e6]",
      badge: isDarkMode ? "bg-transparent text-[#f28b82]" : "bg-transparent text-[#c5221f]",
      icon: <XMarkIcon className="w-5 h-5 text-white" />,
      label: "Rejected",
      iconBg: isDarkMode ? "bg-[#f28b82]" : "bg-[#d93025]",
    },
    pending: {
      color: isDarkMode ? "bg-[#8ab4f8]" : "bg-[#1a73e8]",
      bg: isDarkMode ? "bg-[#282a2d] border border-[#5f6368] shadow-sm" : "bg-white border border-[#dadce0] shadow-sm",
      badge: isDarkMode ? "bg-[#422c00] text-[#fde293] border-transparent" : "bg-[#fef7e0] text-[#b06000] border-transparent",
      icon: <ClockIcon className="w-4.5 h-4.5 text-white" />,
      label: "Pending",
      iconBg: isDarkMode ? "bg-[#8ab4f8]" : "bg-[#1a73e8]",
    },
    locked: {
      color: isDarkMode ? "bg-[#5f6368]" : "bg-[#dadce0]",
      bg: isDarkMode ? "bg-[#303134] border border-transparent grayscale opacity-80" : "bg-[#f8f9fa] border border-transparent grayscale opacity-80",
      badge: isDarkMode ? "bg-[#3c4043] text-[#9aa0a6] border-transparent" : "bg-[#f1f3f4] text-[#5f6368] border-transparent",
      icon: <ClockIcon className="w-4.5 h-4.5 text-gray-400" />,
      label: "Locked",
      iconBg: isDarkMode ? "bg-[#3c4043]" : "bg-[#f1f3f4]",
    },
  };

  const config = statusConfig[stage.status] || statusConfig.pending;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 200, damping: 25 }}
      className="relative"
    >
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center flex-shrink-0">
          <motion.div
            whileHover={{ scale: stage.status === 'locked' ? 1 : 1.05 }}
            className={`relative w-10 h-10 rounded-full ${config.iconBg} flex items-center justify-center z-10 ${stage.status !== 'locked' ? 'shadow-sm' : ''}`}
            onClick={onToggle}
          >
            {config.icon}
          </motion.div>
          {!isLast && (
            <div
              className={`w-0.5 flex-1 min-h-[50px] ${
                stage.status === "approved" ? "bg-[#1e8e3e]" : "bg-[#dadce0]"
              }`}
            />
          )}
        </div>

        <div className={`flex-1 ${isLast ? "pb-0" : "pb-6"}`}>
          <div
            className={`rounded-2xl p-4 transition-all duration-200 ${config.bg} ${
              isExpanded && stage.status !== 'locked' ? "ring-2 ring-[#e8f0fe]" : ""
            } ${stage.status !== 'locked' ? 'cursor-pointer hover:shadow-md' : ''}`}
            onClick={stage.status !== 'locked' ? onToggle : undefined}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-9 h-9 rounded-full ${config.iconBg} bg-opacity-10 flex items-center justify-center`}
                >
                  <div className={`text-${config.iconBg.replace('bg-', '')}`}>
                     {stage.iconComponent}
                  </div>
                </div>
                <div>
                  <h4 className={`font-medium text-[15px] ${isDarkMode ? (stage.status === 'locked' ? 'text-[#9aa0a6]' : 'text-[#e8eaed]') : (stage.status === 'locked' ? 'text-[#5f6368]' : 'text-[#202124]')}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                    {stage.title}
                  </h4>
                  <p className={`text-[13px] mt-0.5 ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                    {stage.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${config.badge}`}
                >
                  {config.label}
                </span>
                <UnresolvedBadge count={unresolvedCount} />
                {hasComments && !stage.hasChildren && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewComments();
                    }}
                    className="w-7 h-7 rounded-lg bg-orange-100 hover:bg-orange-200 flex items-center justify-center transition-colors"
                    title="View comments"
                  >
                    <ChatBubbleIcon className="w-4 h-4 text-orange-600" />
                  </motion.button>
                )}
                {children && (
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-gray-400"
                  >
                    <ChevronDownIcon className="w-4 h-4" />
                  </motion.div>
                )}
              </div>
            </div>

            <AnimatePresence>
              {isExpanded && children && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 pt-3 border-t border-gray-200/50">
                    {children}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {stage.comments && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`mt-2 px-5 py-3 rounded-xl text-sm border ${isDarkMode ? 'bg-[#303134] border-[#5f6368] text-[#e8eaed]' : 'bg-[#f8f9fa] border-[#dadce0] text-[#3c4043]'}`}
            >
              <span className={`font-semibold ${isDarkMode ? 'text-[#ffffff]' : 'text-[#202124]'}`}>Note:</span> {stage.comments}
            </motion.div>
          )}
        </div>
      </div>
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
      badge: isDarkMode ? "bg-emerald-400 bg-opacity-[0.15] text-emerald-400 border border-emerald-400/20" : "bg-emerald-50 text-emerald-700 border border-transparent",
    },
    rejected: { 
      dot: isDarkMode ? "bg-red-400" : "bg-red-500", 
      badge: isDarkMode ? "bg-red-400 bg-opacity-[0.15] text-red-400 border border-red-400/20" : "bg-red-50 text-red-700 border border-transparent" 
    },
    pending: { 
      dot: isDarkMode ? "bg-[#fde293]" : "bg-amber-500", 
      badge: isDarkMode ? "bg-[#422c00] text-[#fde293] border border-[#fde293]/20" : "bg-amber-50 text-amber-700 border border-transparent" 
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
      className={`group flex items-center justify-between p-3 rounded-xl transition-all duration-200 cursor-pointer border ${isDarkMode ? 'hover:bg-[#3c4043] hover:border-[#5f6368] border-transparent' : 'hover:bg-white/80 hover:shadow-md hover:shadow-green-500/5 border-transparent hover:border-green-100'}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-5 h-px transition-colors ${isDarkMode ? 'bg-[#5f6368] group-hover:bg-[#9aa0a6]' : 'bg-gray-300 group-hover:bg-green-300'}`} />
          <div
            className={`w-3 h-3 rounded-full ${colors.dot} shadow-sm ring-2 ring-offset-1 ${isDarkMode ? 'ring-offset-[#202124] ring-[#3c4043]' : 'ring-offset-white ring-gray-200'} ${approval.status === "pending" ? "animate-pulse" : ""}`}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={`font-medium text-sm transition-colors ${isDarkMode ? 'text-[#e8eaed] group-hover:text-white' : 'text-gray-800 group-hover:text-gray-900'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
              {approval.professor?.full_name || "Unknown Professor"}
            </p>
            <CommentIndicator hasComment={hasComment} />
          </div>
          {hasComment && (
            <p className={`text-xs mt-0.5 italic truncate max-w-[250px] ${isDarkMode ? 'text-[#9aa0a6]' : 'text-gray-400'}`}>
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
           className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDarkMode ? 'text-[#8ab4f8]' : 'text-green-400'}`}
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

const CommentPopupModal = ({
  target,
  requestId: _requestId,
  studentId: _studentId,
  onClose,
  clearanceComments = [],
}) => {
  if (!target) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-green-200/60 bg-gradient-to-br from-white via-green-50/30 to-emerald-50/20 shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-green-100/60 bg-white/90 backdrop-blur-md rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
              <ChatBubbleIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-gray-900">
                {target.title}
              </h4>
              <p className="text-xs text-gray-500">
                {target.type === "professor"
                  ? "Professor feedback & comments"
                  : "Stage comments & discussion"}
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors text-gray-400"
          >
            <XMarkIcon className="w-4 h-4" />
          </motion.button>
        </div>

        <div className="p-6">
          {(() => {
            let specificComments = [];

            if (target.type === "professor" && target.approval) {
              specificComments = clearanceComments.filter(
                (c) => c.commenter_id === target.approval.professor_id,
              );

              if (target.approval.comments && target.approval.comments.trim()) {
                specificComments = [
                  {
                    id: `approval-${target.approval.id}`,
                    commenter_name:
                      target.approval.professor?.full_name || "Professor",
                    commenter_role: "professor",
                    comment_text: target.approval.comments,
                    created_at:
                      target.approval.approved_at || target.approval.created_at,
                    is_resolved: false,
                    isApprovalComment: true,
                  },
                  ...specificComments,
                ];
              }
            } else if (target.type === "stage") {
              const roleMap = {
                library: "library_admin",
                cashier: "cashier_admin",
                registrar: "registrar_admin",
              };
              const role = roleMap[target.key];
              specificComments = clearanceComments.filter(
                (c) => c.commenter_role === role,
              );

              if (target.stageComment && target.stageComment.trim()) {
                specificComments = [
                  {
                    id: `stage-${target.key}`,
                    commenter_name: target.title,
                    commenter_role: role || "admin",
                    comment_text: target.stageComment,
                    is_resolved: false,
                    isStageComment: true,
                  },
                  ...specificComments,
                ];
              }
            }

            const unresolvedCount = specificComments.filter(
              (c) => !c.is_resolved,
            ).length;

            if (specificComments.length === 0) {
              return (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                    <ChatBubbleIcon className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-400">
                    No comments yet
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    {target.type === "professor"
                      ? "This professor hasn't left any feedback"
                      : "This office hasn't left any feedback"}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`w-2 h-2 rounded-full ${unresolvedCount > 0 ? "bg-orange-500" : "bg-green-500"}`}
                  />
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {specificComments.length} Comment
                    {specificComments.length !== 1 ? "s" : ""}
                    {unresolvedCount > 0 && ` · ${unresolvedCount} unresolved`}
                  </p>
                </div>
                {specificComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`border-l-4 pl-4 py-3 rounded-r-xl bg-white shadow-sm ${
                      comment.is_resolved
                        ? "border-green-300 opacity-60"
                        : target.type === "professor"
                          ? "border-purple-400"
                          : "border-blue-400"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          comment.is_resolved
                            ? "bg-green-400"
                            : target.type === "professor"
                              ? "bg-gradient-to-br from-purple-400 to-indigo-500"
                              : "bg-gradient-to-br from-blue-400 to-indigo-500"
                        }`}
                      >
                        <span className="text-white text-xs font-bold">
                          {comment.commenter_name?.charAt(0) || "?"}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900">
                            {comment.commenter_name}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              comment.commenter_role === "professor" ||
                              comment.commenter_role === "department_head"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {comment.commenter_role === "professor"
                              ? "Professor"
                              : comment.commenter_role === "library_admin"
                                ? "Library"
                                : comment.commenter_role === "cashier_admin"
                                  ? "Cashier"
                                  : comment.commenter_role === "registrar_admin"
                                    ? "Registrar"
                                    : "Admin"}
                          </span>
                          {comment.is_resolved ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                              Resolved
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-medium">
                              Unresolved
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-sm whitespace-pre-wrap leading-relaxed mt-1 ${
                            comment.is_resolved
                              ? "text-gray-400 line-through decoration-1"
                              : "text-gray-700"
                          }`}
                        >
                          {comment.comment_text}
                        </p>
                        {comment.created_at && (
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(comment.created_at).toLocaleString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </motion.div>
    </motion.div>
  );
};

const ProgressBar = ({ stages }) => {
  const approved = stages.filter((s) => s.status === "approved").length;
  const total = stages.length;
  const pct = total > 0 ? (approved / total) * 100 : 0;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[14px] font-medium text-[#5f6368]">
          Overall Progress
        </span>
        <span className="text-[13px] font-bold text-[#1a73e8]">
          {approved}/{total} stages complete
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-[#f1f3f4]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
          className="h-full rounded-full bg-[#1a73e8]"
        />
      </div>
    </div>
  );
};

export default function StudentDashboardGraduation({
  studentId,
  studentInfo,
  onSignOut,
  onOpenSettings,
  isDarkMode = false,
}) {
  const [clearanceStatus, setClearanceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [activeView, setActiveView] = useState("status");
  const [expandedStages, setExpandedStages] = useState({ professors: true });
  const [cancelling, setCancelling] = useState(false);
  const [commentTarget, setCommentTarget] = useState(null);
  const [clearanceComments, setClearanceComments] = useState([]);

  const fetchClearanceComments = async (reqId) => {
    if (!reqId) return;
    try {
      const commentsRes = await getClearanceComments(reqId, studentId);
      if (commentsRes.success) setClearanceComments(commentsRes.comments || []);
    } catch (e) {
      console.warn("Could not fetch clearance comments:", e);
    }
  };

  useEffect(() => {
    document.title = "Student Dashboard | ISU Graduation Clearance";
    fetchClearanceStatus();
  }, []);

  useEffect(() => {
    const reqId =
      clearanceStatus?.request?.request_id || clearanceStatus?.request?.id;
    if (!reqId) return;
    const interval = setInterval(() => fetchClearanceComments(reqId), 10000);
    return () => clearInterval(interval);
  }, [clearanceStatus]);

  const fetchClearanceStatus = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/graduation/status/${studentId}`,
      );
      if (response.data.success) {
        setClearanceStatus(response.data);

        const reqId =
          response.data.request?.request_id || response.data.request?.id;
        await fetchClearanceComments(reqId);
      }
    } catch (error) {
      console.error("Error fetching clearance status:", error);
      toast.error("Failed to load clearance status");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const response = await axios.post(`${API_URL}/graduation/apply`, {
        student_id: studentId,
      });
      if (response.data.success) {
        toast.success("Graduation clearance application submitted!");
        fetchClearanceStatus();
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to apply for clearance",
      );
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = async () => {
    if (
      !window.confirm(
        "Are you sure you want to cancel your graduation clearance request?",
      )
    )
      return;
    setCancelling(true);
    try {
      const response = await axios.delete(
        `${API_URL}/graduation/cancel/${studentId}`,
      );
      if (response.data.success) {
        toast.success("Request cancelled");
        fetchClearanceStatus();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to cancel clearance");
    } finally {
      setCancelling(false);
    }
  };

  const toggleStage = (key) =>
    setExpandedStages((prev) => ({ ...prev, [key]: !prev[key] }));

  const openProfessorComments = async (approval) => {
    const reqId =
      clearanceStatus?.request?.request_id || clearanceStatus?.request?.id;

    await fetchClearanceComments(reqId);
    setCommentTarget({
      type: "professor",
      key: `professor-${approval.id}`,
      title: approval.professor?.full_name || "Professor",
      requestId: reqId,
      approval,
    });
  };

  const openStageComments = async (stage) => {
    const reqId =
      clearanceStatus?.request?.request_id || clearanceStatus?.request?.id;

    await fetchClearanceComments(reqId);
    setCommentTarget({
      type: "stage",
      key: stage.key,
      title: stage.title,
      requestId: reqId,
      stageComment: stage.comments || null,
    });
  };

  const closeCommentPanel = () => setCommentTarget(null);

  const buildStages = () => {
    if (!clearanceStatus?.request) return [];
    const r = clearanceStatus.request;

    const PROF_ORDER = [
      "Department Chairman",
      "College Dean",
      "Director Student Affairs",
      "NSTP Director",
      "Executive Officer",
      "Dean Graduate School",
    ];

    const profApprovals = (clearanceStatus.professorApprovals || [])
      .slice()
      .sort((a, b) => {
        const idxA = PROF_ORDER.indexOf(a.professor?.full_name);
        const idxB = PROF_ORDER.indexOf(b.professor?.full_name);
        return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
      });

    let isLocked = false;

    const profStages = profApprovals.map((approval) => {
      const name = approval.professor?.full_name || "Unknown Professor";
      const profClearanceComments = clearanceComments.filter(
        (c) => c.commenter_id === approval.professor_id
      );
      const unresolvedCount =
        profClearanceComments.filter((c) => !c.is_resolved).length +
        (approval.comments && approval.comments.trim() && approval.status !== "approved" ? 1 : 0);

      const hasComments =
        profClearanceComments.length > 0 || !!(approval.comments && approval.comments.trim());

      let status = approval.status;
      if (isLocked && status === "pending") {
        status = "locked";
      }
      if (approval.status !== "approved") {
        isLocked = true;
      }

      return {
        key: `prof-${approval.id}`,
        title: name,
        description: "Professor Approval",
        iconComponent: <UsersIcon className="w-4 h-4 text-white" />,
        status,
        comments: approval.comments,
        hasChildren: false,
        hasComments,
        unresolvedCount,
        approval,
        type: "professor",
      };
    });

    const adminStages = [
      {
        key: "library",
        title: "Library Clearance",
        description: "Check for unsettled books and obligations",
        iconComponent: <BookOpenIcon className="w-4 h-4 text-white" />,
        status: isLocked && r.library_status === "pending" ? "locked" : r.library_status || "pending",
        comments: r.library_comments,
        hasComments: !!(r.library_comments && r.library_comments.trim()),
        unresolvedCount: r.library_comments ? 1 : 0,
        type: "stage"
      },
      {
        key: "cashier",
        title: "Cashier Clearance",
        description: "Verify financial obligations",
        iconComponent: <BanknotesIcon className="w-4 h-4 text-white" />,
        status: (isLocked || r.library_status !== "approved") && r.cashier_status === "pending" ? "locked" : r.cashier_status || "pending",
        comments: r.cashier_comments,
        hasComments: !!(r.cashier_comments && r.cashier_comments.trim()),
        unresolvedCount: r.cashier_comments ? 1 : 0,
        type: "stage"
      },
      {
        key: "registrar",
        title: "Registrar Final Approval",
        description: "Final validation and certificate generation",
        iconComponent: <BuildingLibraryIcon className="w-4 h-4 text-white" />,
        status: (isLocked || r.library_status !== "approved" || r.cashier_status !== "approved") && r.registrar_status === "pending" ? "locked" : r.registrar_status || "pending",
        comments: r.registrar_comments,
        hasComments: !!(r.registrar_comments && r.registrar_comments.trim()),
        unresolvedCount: r.registrar_comments ? 1 : 0,
        type: "stage"
      },
    ];

    return [...profStages, ...adminStages];
  };

  const unresolvedCommentCount = clearanceStatus?.unresolvedCommentCount || 0;

  const theme = {
    name: "ISU Clearance",
    abbrev: "SC",
    dashboardTitle: "Student Dashboard",
    sidebarGradient: isDarkMode ? "bg-[#202124] border-r border-[#3c4043]" : "bg-white border-r border-[#dadce0]",
    sidebarActive: isDarkMode ? "bg-[#4285f4] bg-opacity-[0.15] text-[#8ab4f8]" : "bg-[#e8f0fe] text-[#1a73e8]",
    sidebarInactive: isDarkMode ? "text-[#e8eaed] hover:bg-[#3c4043]" : "text-[#3c4043] hover:bg-[#f1f3f4]",
    accentGradient: isDarkMode ? "bg-[#8ab4f8] text-[#202124]" : "bg-[#1a73e8]",
    dotColor: "bg-[#1e8e3e]",
    bg: isDarkMode ? "bg-[#202124]" : "bg-[#f8f9fa]",
    topbar: isDarkMode ? "bg-[#202124] border-b border-[#3c4043]" : "bg-white border-b border-[#dadce0]",
    topbarText: isDarkMode ? "text-[#e8eaed]" : "text-[#202124]",
    topbarSub: isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]",
    topbarBtn: isDarkMode ? "hover:bg-[#3c4043]" : "hover:bg-[#f1f3f4]",
  };

  const menuItems = [
    {
      id: "status",
      label: "Clearance Status",
      icon: <ChartBarIcon className="w-5 h-5" />,
    },
    {
      id: "certificate",
      label: "Certificate",
      icon: <AcademicCapIcon className="w-5 h-5" />,
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
      }}
      onSignOut={onSignOut}
      onOpenSettings={onOpenSettings}
    >
      {activeView === "status" && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mb-2">
            <h2 className={`text-[28px] font-normal tracking-tight ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
              Graduation Clearance
            </h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
              Track your graduation clearance progress
            </p>
          </div>

          {loading ? (
            <GlassCard isDark={isDarkMode} className="p-12 border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-3xl">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-[#1a73e8] border-t-transparent rounded-full animate-spin" />
                <p className="text-[14px] font-medium text-[#5f6368]">
                  Loading clearance status...
                </p>
              </div>
            </GlassCard>
          ) : !clearanceStatus?.hasRequest ? (
            <GlassCard isDark={isDarkMode} className="p-12 text-center border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-3xl">
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isDarkMode ? 'bg-[#303134]' : 'bg-[#e8f0fe]'}`}
                >
                  <AcademicCapIcon className={`w-10 h-10 ${isDarkMode ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`} />
                </motion.div>
                <h3 className={`text-[22px] font-normal mb-3 ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                  Apply for Graduation Clearance
                </h3>
                <p className={`mb-8 max-w-md mx-auto text-[14px] leading-relaxed ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                  Start your graduation clearance process. All professors and
                  offices must approve before you can graduate.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleApply}
                  disabled={applying}
                  className="px-6 py-2.5 bg-[#1a73e8] text-white rounded-full font-medium text-sm hover:shadow-md hover:bg-[#1557b0] disabled:opacity-50 transition-all duration-200"
                >
                  {applying
                    ? "Submitting..."
                    : "Apply for Clearance"}
                </motion.button>
              </div>
            </GlassCard>
          ) : (
            <>
              <GlassCard isDark={isDarkMode} className="p-6 border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-3xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-[#303134]' : 'bg-[#f1f3f4]'}`}>
                      <AcademicCapIcon className={`w-6 h-6 ${isDarkMode ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`} />
                    </div>
                    <div>
                      <p className={`text-[12px] font-medium mb-1 uppercase tracking-wider ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                        Applied on{" "}
                        {new Date(
                          clearanceStatus.request.created_at,
                        ).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className={`font-medium text-[15px] ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`}>
                          Current Stage:
                        </h3>
                        <span className={`px-3.5 py-1 rounded-full text-[13px] font-semibold border border-transparent ${isDarkMode ? 'bg-[#4285f4] bg-opacity-[0.15] text-[#8ab4f8]' : 'bg-[#e8f0fe] text-[#1a73e8]'}`}>
                          {clearanceStatus.request.current_stage}
                        </span>
                        {unresolvedCommentCount > 0 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#fce8e6] text-[#c5221f] border border-transparent"
                          >
                            <ChatBubbleIcon className="w-3.5 h-3.5" />
                            {unresolvedCommentCount} unresolved comment
                            {unresolvedCommentCount !== 1 ? "s" : ""}
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: '#fce8e6' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex items-center gap-1.5 px-4 py-2 text-[#d93025] hover:text-[#c5221f] rounded-full font-medium transition-all duration-200 text-sm disabled:opacity-50"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    {cancelling ? "Cancelling..." : "Cancel"}
                  </motion.button>
                </div>
              </GlassCard>

              <GlassCard isDark={isDarkMode} className="p-8 border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-3xl">
                <h3 className={`text-[20px] font-normal mb-1 ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                  Clearance Progress Tree
                </h3>
                <p className={`text-[14px] mb-6 ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                  Click on each stage to expand details · Click a professor row
                  to view comments
                </p>
                <ProgressBar stages={buildStages()} />
                <div className="mt-4">
                  {buildStages().map((stage, i) => (
                    <StageNode
                      key={stage.key}
                      stage={stage}
                      index={i}
                      total={buildStages().length}
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
                        if (stage.type === "professor") {
                          openProfessorComments(stage.approval);
                        } else {
                          openStageComments(stage);
                        }
                      }}
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </div>
              </GlassCard>
            </>
          )}
        </div>
      )}

      {activeView === "certificate" && (
        <div className="max-w-4xl mx-auto space-y-6">
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
      <AnimatePresence mode="wait">
        {commentTarget && (
          <CommentPopupModal
            key={commentTarget.key}
            target={commentTarget}
            requestId={commentTarget.requestId}
            studentId={studentId}
            onClose={closeCommentPanel}
            clearanceComments={clearanceComments}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
