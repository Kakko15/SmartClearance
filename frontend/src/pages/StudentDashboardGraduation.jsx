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
      bg: isDarkMode ? "bg-[#1e8e3e]/10 border border-[#1e8e3e]/20" : "bg-white border border-[#dadce0] shadow-[0_1px_2px_0_rgba(60,64,67,0.1),0_1px_3px_1px_rgba(60,64,67,0.05)]",
      badge: isDarkMode ? "bg-[#1e8e3e]/20 text-[#81c995]" : "bg-[#e6f4ea] text-[#137333]",
      icon: <CheckIcon className="w-5 h-5 text-white" />,
      label: "Approved",
      iconBg: isDarkMode ? "bg-[#81c995]" : "bg-[#1e8e3e]",
    },
    rejected: {
      color: isDarkMode ? "bg-[#f28b82]" : "bg-[#d93025]",
      bg: isDarkMode ? "bg-[#d93025]/10 border border-[#d93025]/20" : "bg-white border border-[#dadce0] shadow-[0_1px_2px_0_rgba(60,64,67,0.1),0_1px_3px_1px_rgba(60,64,67,0.05)]",
      badge: isDarkMode ? "bg-[#f28b82]/20 text-[#f28b82]" : "bg-[#fce8e6] text-[#c5221f]",
      icon: <XMarkIcon className="w-5 h-5 text-white" />,
      label: "Rejected",
      iconBg: isDarkMode ? "bg-[#f28b82]" : "bg-[#d93025]",
    },
    pending: {
      color: isDarkMode ? "bg-[#8ab4f8]" : "bg-[#1a73e8]",
      bg: isDarkMode ? "bg-[#202124] border border-[#8ab4f8]/30 shadow-md ring-1 ring-[#8ab4f8]/20" : "bg-white border border-[#1a73e8]/20 shadow-[0_1px_3px_0_rgba(26,115,232,0.15),0_4px_8px_3px_rgba(26,115,232,0.05)] ring-1 ring-[#1a73e8]/10",
      badge: isDarkMode ? "bg-[#8ab4f8]/15 text-[#8ab4f8]" : "bg-[#e8f0fe] text-[#1967d2]",
      icon: <ClockIcon className="w-4.5 h-4.5 text-white" />,
      label: "In Progress",
      iconBg: isDarkMode ? "bg-[#8ab4f8]" : "bg-[#1a73e8]",
    },
    locked: {
      color: isDarkMode ? "bg-[#5f6368]" : "bg-[#dadce0]",
      bg: isDarkMode ? "bg-transparent border border-dashed border-[#5f6368]" : "bg-[#f8f9fa] border border-dashed border-[#dadce0]",
      badge: isDarkMode ? "bg-[#3c4043] text-[#9aa0a6]" : "bg-white text-[#5f6368] border border-[#dadce0]",
      icon: <ClockIcon className={`w-4.5 h-4.5 ${isDarkMode ? 'text-[#9aa0a6]' : 'text-gray-400'}`} />,
      label: "Locked",
      iconBg: isDarkMode ? "bg-[#3c4043]" : "bg-white border-2 border-[#dadce0]",
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
            onClick={stage.status !== 'locked' ? onToggle : undefined}
          >
            {config.icon}
          </motion.div>
          {!isLast && (
            <div
              className={`w-[2px] flex-1 min-h-[50px] ${stage.status === "approved" ? "bg-[#1e8e3e]" : (isDarkMode ? "bg-[#5f6368]" : "bg-[#dadce0]")}`}
            />
          )}
        </div>

        <div className={`flex-1 ${isLast ? "pb-0" : "pb-7"}`}>
          <div
            className={`rounded-[20px] p-5 transition-all duration-200 ${config.bg} ${isExpanded && stage.status !== 'locked' ? (isDarkMode ? "ring-2 ring-[#8ab4f8]/30" : "ring-2 ring-[#e8f0fe]") : ""} ${stage.status !== 'locked' ? 'cursor-pointer hover:shadow-md' : 'opacity-80'}`}
            onClick={stage.status !== 'locked' ? onToggle : undefined}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-white/5' : 'bg-black/5'} flex items-center justify-center`}
                >
                  <div className={`${isDarkMode ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
                    {stage.iconComponent}
                  </div>
                </div>
                <div>
                  <h4 className={`font-medium text-[16px] tracking-tight ${isDarkMode ? (stage.status === 'locked' ? 'text-[#9aa0a6]' : 'text-[#e8eaed]') : (stage.status === 'locked' ? 'text-[#5f6368]' : 'text-[#202124]')}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                    {stage.title}
                  </h4>
                  <p className={`text-[13px] mt-0.5 font-normal leading-relaxed ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                    {stage.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${config.badge}`}
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
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? "bg-orange-900/40 hover:bg-orange-800/60" : "bg-orange-50 hover:bg-orange-100"
                      }`}
                    title="View comments"
                  >
                    <ChatBubbleIcon className={`w-4 h-4 ${isDarkMode ? "text-orange-400" : "text-orange-600"}`} />
                  </motion.button>
                )}
                {children && (
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"}
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
                  <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-[#3c4043]' : 'border-[#dadce0]'}`}>
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
              className={`mt-2.5 px-5 py-3.5 rounded-2xl text-[13px] leading-relaxed border shadow-sm ${isDarkMode ? 'bg-[#303134] border-[#5f6368] text-[#e8eaed]' : 'bg-[#fff8e1] border-[#fde293] text-[#3c4043]'}`}
            >
              <span className={`font-semibold mr-1 ${isDarkMode ? 'text-[#ffffff]' : 'text-[#f29900]'}`}>Note:</span> {stage.comments}
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
          className={`opacity-0 group-hover:opacity-100 transition-opacity ${isDarkMode ? 'text-primary-400' : 'text-primary-500'}`}
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
                    className={`border-l-4 pl-4 py-3 rounded-r-xl bg-white shadow-sm ${comment.is_resolved
                      ? "border-green-300 opacity-60"
                      : target.type === "professor"
                        ? "border-purple-400"
                        : "border-blue-400"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${comment.is_resolved
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
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${comment.commenter_role === "professor" ||
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
                          className={`text-sm whitespace-pre-wrap leading-relaxed mt-1 ${comment.is_resolved
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

const ProgressBar = ({ stages, isDarkMode }) => {
  const approved = stages.filter((s) => s.status === "approved").length;
  const total = stages.length;
  const pct = total > 0 ? (approved / total) * 100 : 0;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <span className={`text-[15px] font-medium tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#3c4043]"}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
          Overall Progress
        </span>
        <span className={`text-[14px] font-bold ${isDarkMode ? "text-[#81c995]" : "text-[#1e8e3e]"}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
          {approved}/{total} stages complete
        </span>
      </div>
      <div className={`h-[8px] rounded-full overflow-hidden shadow-inner ${isDarkMode ? "bg-[#303134]" : "bg-[#f1f3f4]"}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className={`h-full rounded-full relative overflow-hidden ${isDarkMode ? "bg-[#81c995] shadow-[0_0_10px_rgba(129,201,149,0.5)]" : "bg-[#1e8e3e] shadow-[0_0_10px_rgba(30,142,62,0.4)]"}`}
        >
          {pct > 0 && pct < 100 && (
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12"
            />
          )}
        </motion.div>
      </div>
    </div>
  );
};

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
  const [activeView, setActiveView] = useState("status");
  const [expandedStages, setExpandedStages] = useState({ professors: true });
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && showCancelModal) {
        setShowCancelModal(false);
      }
    };
    if (showCancelModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showCancelModal]);

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

  const handleApply = async (portion) => {
    setApplying(portion);
    try {
      const response = await axios.post(`${API_URL}/graduation/apply`, {
        student_id: studentId,
        portion,
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

  const handleCancel = () => setShowCancelModal(true);

  const confirmCancel = async () => {
    setShowCancelModal(false);
    setCancelling(true);
    try {
      const response = await axios.delete(
        `${API_URL}/graduation/cancel/${studentId}`,
      );
      if (response.data.success) {
        toast.success("Request cancelled successfully");
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
    const profApprovals = clearanceStatus.professorApprovals || [];

    // Detect portion from assigned professors
    const UNDERGRAD_NAMES = ["Department Chairman", "College Dean", "Director Student Affairs", "NSTP Director", "Executive Officer"];
    const isUndergraduate = profApprovals.some((a) => UNDERGRAD_NAMES.includes(a.professor?.full_name));

    const findProf = (name) => profApprovals.find((a) => a.professor?.full_name === name);

    // Build a professor stage node
    const buildProfNode = (approval, locked) => {
      if (!approval) return null;
      const name = approval.professor?.full_name || "Unknown";
      const profCC = clearanceComments.filter((c) => c.commenter_id === approval.professor_id);
      const unresolvedCount =
        profCC.filter((c) => !c.is_resolved).length +
        (approval.comments && approval.comments.trim() && approval.status !== "approved" ? 1 : 0);
      const hasComments = profCC.length > 0 || !!(approval.comments && approval.comments.trim());
      return {
        key: `prof-${approval.id}`,
        title: name,
        description: "Clearance Approval",
        iconComponent: <UsersIcon className="w-4 h-4 text-white" />,
        status: locked && approval.status === "pending" ? "locked" : approval.status,
        comments: approval.comments,
        hasChildren: false,
        hasComments,
        unresolvedCount,
        approval,
        type: "professor",
      };
    };

    // Build an admin stage node
    const buildAdminNode = (key, title, description, icon, locked) => {
      const sField = { library: "library_status", cashier: "cashier_status", registrar: "registrar_status" }[key];
      const cField = { library: "library_comments", cashier: "cashier_comments", registrar: "registrar_comments" }[key];
      const st = r[sField] || "pending";
      const cm = r[cField];
      return {
        key,
        title,
        description,
        iconComponent: icon,
        status: locked && st === "pending" ? "locked" : st,
        comments: cm,
        hasComments: !!(cm && cm.trim()),
        unresolvedCount: cm ? 1 : 0,
        type: "stage",
      };
    };

    // Define form order per portion (REG Form 07)
    // Undergraduate: 7 steps | Graduate: 4 steps
    const steps = isUndergraduate
      ? [
        { type: "prof", name: "Department Chairman" },
        { type: "prof", name: "College Dean" },
        { type: "prof", name: "Director Student Affairs" },
        { type: "admin", key: "library", title: "Campus Librarian", desc: "Library clearance and book obligations", icon: <BookOpenIcon className="w-4 h-4 text-white" /> },
        { type: "admin", key: "cashier", title: "Chief Accountant", desc: "Financial obligations clearance", icon: <BanknotesIcon className="w-4 h-4 text-white" /> },
        { type: "prof", name: "NSTP Director" },
        { type: "prof", name: "Executive Officer" },
      ]
      : [
        { type: "admin", key: "cashier", title: "Chief Accountant", desc: "Financial obligations clearance", icon: <BanknotesIcon className="w-4 h-4 text-white" /> },
        { type: "admin", key: "library", title: "Campus Librarian", desc: "Library clearance and book obligations", icon: <BookOpenIcon className="w-4 h-4 text-white" /> },
        { type: "admin", key: "registrar", title: "Student's Record Evaluator", desc: "Record evaluation and validation", icon: <BuildingLibraryIcon className="w-4 h-4 text-white" /> },
        { type: "prof", name: "Dean Graduate School" },
      ];

    // Build stages with sequential locking
    const stages = [];
    let isLocked = false;
    for (const step of steps) {
      if (step.type === "prof") {
        const node = buildProfNode(findProf(step.name), isLocked);
        if (node) {
          stages.push(node);
          if (node.status !== "approved") isLocked = true;
        }
      } else {
        const sField = { library: "library_status", cashier: "cashier_status", registrar: "registrar_status" }[step.key];
        const node = buildAdminNode(step.key, step.title, step.desc, step.icon, isLocked);
        stages.push(node);
        if ((r[sField] || "pending") !== "approved") isLocked = true;
      }
    }
    return stages;
  };

  const unresolvedCommentCount = clearanceStatus?.unresolvedCommentCount || 0;

  const theme = {
    name: "ISU Clearance",
    abbrev: "SC",
    dashboardTitle: "Student Dashboard",
    sidebarGradient: isDarkMode ? "bg-[#202124] border-r border-[#3c4043]" : "bg-white border-r border-[#dadce0]",
    sidebarActive: isDarkMode ? "bg-primary-900/30 text-primary-400" : "bg-primary-50 text-primary-600",
    sidebarInactive: isDarkMode ? "text-[#e8eaed] hover:bg-[#3c4043]" : "text-[#3c4043] hover:bg-[#f1f3f4]",
    accentGradient: isDarkMode ? "bg-primary-400 text-[#202124]" : "bg-primary-600",
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
        avatar: user?.user_metadata?.avatar_url,
      }}
      onSignOut={onSignOut}
      onOpenSettings={onOpenSettings}
      onManageAccount={onManageAccount}
      toggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
    >
      {activeView === "status" && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mb-2">
            <h2 className={`text-[28px] font-normal tracking-tight ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
              Student Clearance
            </h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
              Track your student clearance progress
            </p>
          </div>

          {loading ? (
            <div className="space-y-6">

              <GlassCard isDark={isDarkMode} className="p-8 border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-3xl">
                <div className="flex justify-between items-start mb-6 w-full">
                  <div className="flex gap-4">
                    <div className={`p-3 rounded-2xl w-12 h-12 flex-shrink-0 animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
                    <div>
                      <div className={`h-6 w-32 rounded mb-2 animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
                      <div className={`h-4 w-48 rounded animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
                    </div>
                  </div>
                  <div className={`h-8 w-24 rounded-full animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
                </div>
              </GlassCard>


              <GlassCard isDark={isDarkMode} className="p-8 border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-3xl">
                <div className={`h-6 w-48 rounded mb-2 animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`h-4 w-64 rounded mb-8 animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />

                <div className="space-y-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-4">

                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
                        {i !== 4 && <div className={`w-0.5 h-[50px] animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />}
                      </div>


                      <div className="flex-1 pb-6 w-full">
                        <div className={`rounded-2xl p-4 flex items-center justify-between w-full h-[72px] animate-pulse ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-9 h-9 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                            <div>
                              <div className={`h-4 w-32 rounded mb-1.5 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                              <div className={`h-3 w-48 rounded ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                            </div>
                          </div>
                          <div className={`h-6 w-16 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
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
              className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mx-auto"
            >
              {/* Undergraduate Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="h-full relative group"
              >
                <GlassCard isDark={isDarkMode} className={`p-8 md:p-10 text-center flex flex-col justify-between h-full rounded-[24px] border ${isDarkMode ? 'border-[#3c4043] bg-[#202124]' : 'border-[#dadce0] bg-white'} shadow-[0_1px_2px_0_rgba(60,64,67,0.3)] hover:shadow-[0_4px_10px_0_rgba(60,64,67,0.15)] transition-all duration-300`}>
                  <div className={`absolute top-0 left-0 right-0 h-1 ${isDarkMode ? 'bg-primary-400' : 'bg-primary-600'} rounded-t-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                  <div className="flex-1 flex flex-col items-center">
                    <motion.div
                      whileHover={{ scale: 1.05, rotate: -5 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 mt-2 ${isDarkMode ? 'bg-primary-400/10' : 'bg-primary-50'}`}
                    >
                      <AcademicCapIcon className={`w-8 h-8 ${isDarkMode ? 'text-primary-400' : 'text-primary-600'}`} />
                    </motion.div>

                    <h3 className={`text-[20px] font-medium mb-3 tracking-tight ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                      Undergraduate Portion
                    </h3>
                    <p className={`mb-8 text-[14px] leading-relaxed max-w-[280px] mx-auto ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                      Standard clearance process including Department Chairman, College Dean, and Executive Officer approvals.
                    </p>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleApply("undergraduate")}
                    disabled={applying !== false}
                    className={`w-full py-2.5 rounded-full font-medium text-[14px] transition-all duration-200 border border-transparent ${applying !== false
                      ? 'opacity-50 cursor-not-allowed'
                      : isDarkMode
                        ? 'hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)] bg-primary-400 text-dark-bg hover:bg-primary-300'
                        : 'hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] bg-primary-600 text-white hover:bg-primary-700'
                      }`}
                    style={{ fontFamily: 'Google Sans, sans-serif' }}
                  >
                    {applying === "undergraduate" ? "Applying..." : "Select Undergraduate"}
                  </motion.button>
                </GlassCard>
              </motion.div>

              {/* Graduate Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.2, 0, 0, 1], delay: 0.05 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="h-full relative group"
              >
                <GlassCard isDark={isDarkMode} className={`p-8 md:p-10 text-center flex flex-col justify-between h-full rounded-[24px] border ${isDarkMode ? 'border-[#3c4043] bg-[#202124]' : 'border-[#dadce0] bg-white'} shadow-[0_1px_2px_0_rgba(60,64,67,0.3)] hover:shadow-[0_4px_10px_0_rgba(60,64,67,0.15)] transition-all duration-300`}>
                  <div className={`absolute top-0 left-0 right-0 h-1 ${isDarkMode ? 'bg-secondary-400' : 'bg-secondary-600'} rounded-t-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                  <div className="flex-1 flex flex-col items-center">
                    <motion.div
                      whileHover={{ scale: 1.05, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 mt-2 ${isDarkMode ? 'bg-secondary-400/10' : 'bg-secondary-50'}`}
                    >
                      <BookOpenIcon className={`w-8 h-8 ${isDarkMode ? 'text-secondary-400' : 'text-secondary-600'}`} />
                    </motion.div>

                    <h3 className={`text-[20px] font-medium mb-3 tracking-tight ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                      Graduate Portion
                    </h3>
                    <p className={`mb-8 text-[14px] leading-relaxed max-w-[280px] mx-auto ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                      Specialized clearance process for Master's and Doctoral students requiring Graduate School approval.
                    </p>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleApply("graduate")}
                    disabled={applying !== false}
                    className={`w-full py-2.5 rounded-full font-medium text-[14px] transition-all duration-200 border border-transparent ${applying !== false
                      ? 'opacity-50 cursor-not-allowed'
                      : isDarkMode
                        ? 'hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)] bg-secondary-400 text-dark-bg hover:bg-secondary-300'
                        : 'hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] bg-secondary-600 text-white hover:bg-secondary-700'
                      }`}
                    style={{ fontFamily: 'Google Sans, sans-serif' }}
                  >
                    {applying === "graduate" ? "Applying..." : "Select Graduate"}
                  </motion.button>
                </GlassCard>
              </motion.div>
            </motion.div>
          ) : (
            <>
              <GlassCard isDark={isDarkMode} className="p-7 border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-3xl relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${isDarkMode ? 'bg-[#8ab4f8]' : 'bg-[#1a73e8]'}`} />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pl-2">
                  <div className="flex items-start sm:items-center gap-5">
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-[#1a73e8]/20 text-[#8ab4f8]' : 'bg-[#e8f0fe] text-[#1a73e8]'}`}>
                        <AcademicCapIcon className="w-7 h-7" />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${isDarkMode ? 'bg-[#202124]' : 'bg-white'}`}>
                        <div className="w-3.5 h-3.5 rounded-full bg-[#1e8e3e] shadow-[0_0_8px_rgba(30,142,62,0.8)] animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <p className={`text-[12px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                          Applied on{" "}
                          {new Date(
                            clearanceStatus.request.created_at,
                          ).toLocaleDateString()}
                        </p>
                        <span className={`text-[10px] hidden sm:inline ${isDarkMode ? 'text-[#5f6368]' : 'text-[#dadce0]'}`}>•</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest shadow-sm ${isDarkMode ? 'bg-[#3c4043] text-[#e8eaed]' : 'bg-[#f8f9fa] text-[#3c4043] border border-[#dadce0]'
                          }`}>
                          {(() => {
                            const profs = clearanceStatus?.professorApprovals || [];
                            const isUG = profs.some((a) => [
                              "Department Chairman", "College Dean", "Director Student Affairs",
                              "NSTP Director", "Executive Officer"
                            ].includes(a.professor?.full_name));
                            return isUG ? "Undergraduate" : "Graduate";
                          })()} Portion
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className={`font-medium text-[18px] tracking-tight ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                          Current Stage:
                        </h3>
                        <span className={`px-3 py-1 rounded-md text-[14px] font-medium border border-transparent shadow-sm ${isDarkMode ? 'bg-[#1a73e8]/20 text-[#8ab4f8] ring-1 ring-[#8ab4f8]/30' : 'bg-[#e8f0fe] text-[#1967d2] ring-1 ring-[#1a73e8]/10'
                          }`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                          {clearanceStatus.request.current_stage}
                        </span>
                        {unresolvedCommentCount > 0 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-[#fce8e6] text-[#c5221f] shadow-[0_1px_2px_rgba(60,64,67,0.3)]"
                          >
                            <ChatBubbleIcon className="w-3.5 h-3.5 text-[#d93025]" />
                            {unresolvedCommentCount} unresolved comment{unresolvedCommentCount !== 1 ? "s" : ""}
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all duration-200 active:scale-[0.98] text-[14px] disabled:opacity-50 border ${isDarkMode
                      ? 'text-[#f28b82] border-[#f28b82]/30 hover:bg-[#f28b82]/10 hover:border-[#f28b82]/50'
                      : 'text-[#d93025] border-[#dadce0] hover:bg-[#fce8e6] hover:border-[#d93025]/50 hover:text-[#c5221f]'
                      }`}
                  >
                    <XMarkIcon className="w-4 h-4" />
                    {cancelling ? "Cancelling..." : "Cancel Request"}
                  </button>
                </div>
              </GlassCard>

              <GlassCard isDark={isDarkMode} className="p-7 sm:p-9 border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-[28px]">
                <div className="mb-8">
                  <h3 className={`text-[22px] font-medium tracking-tight mb-2 ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                    Clearance Progress Tree
                  </h3>
                  <p className={`text-[14px] leading-relaxed ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                    Track your graduation clearance step-by-step. Click any active stage to expand details and view specific requirements or professor notes.
                  </p>
                </div>
                <div className="mb-6">
                  <ProgressBar stages={buildStages()} isDarkMode={isDarkMode} />
                </div>
                <div className="mt-8 flex flex-col gap-2">
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
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute inset-0 bg-[#202124]/40 backdrop-blur-[4px]"
              onClick={() => setShowCancelModal(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-[420px] rounded-[28px] overflow-hidden flex flex-col shadow-[0_24px_38px_3px_rgba(0,0,0,0.14),0_9px_46px_8px_rgba(0,0,0,0.12),0_11px_15px_-7px_rgba(0,0,0,0.2)] ${isDarkMode ? "bg-[#28292a]" : "bg-white"
                }`}
              style={{ fontFamily: "'Google Sans', 'Inter', sans-serif" }}
            >
              {/* Top illustrative band */}
              <div className={`h-[6px] w-full ${isDarkMode ? "bg-[#f28b82]/90" : "bg-[#d93025]"}`} />

              {/* Content Container */}
              <div className="px-7 pt-8 pb-2 sm:px-9 sm:pt-9 sm:pb-4 flex flex-col items-center text-center">
                {/* Warning Icon - Top Centered */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-colors ${isDarkMode ? "bg-red-900/30 text-[#f28b82]" : "bg-red-50 text-[#d93025]"
                  }`}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>

                {/* Title */}
                <h3 className={`text-[24px] font-medium mb-3 leading-tight tracking-[-0.015em] ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"
                  }`}>
                  Cancel clearance?
                </h3>

                {/* Description */}
                <p className={`text-[15px] leading-[24px] font-normal ${isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]"
                  }`}>
                  This action will permanently discard your current graduation clearance progress and all approvals.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-7 pb-8 pt-6 sm:px-9 sm:pb-9">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className={`w-full sm:w-auto flex-1 py-3 px-5 rounded-full text-[15px] font-medium transition-all duration-200 active:scale-[0.98] ${isDarkMode
                    ? "bg-transparent text-[#e8eaed] hover:bg-[#3c4043]"
                    : "bg-transparent text-[#3c4043] hover:bg-[#f1f3f4]"
                    }`}
                >
                  Keep Request
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={cancelling}
                  className={`w-full sm:w-auto flex-1 py-3 px-5 rounded-full text-[15px] font-medium transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 ${cancelling ? "opacity-70 cursor-not-allowed" : ""
                    } ${isDarkMode
                      ? "bg-[#f28b82] text-[#202124] hover:bg-[#f5a19a] shadow-sm"
                      : "bg-[#d93025] text-white hover:bg-[#c5221f] shadow-[0_1px_2px_rgba(217,48,37,0.3)]"
                    }`}
                >
                  {cancelling ? (
                    <>
                      <svg className="animate-spin -ml-1 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
    </DashboardLayout>
  );
}
