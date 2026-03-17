import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { getClearanceComments, authAxios } from "../services/api";
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
} from "../components/ui/Icons";
import StudentRequestHistory from "../components/features/StudentRequestHistory";

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
  onRequestReevaluation,
  children,
  isDarkMode = false,
}) => {
  const isLast = index === total - 1;
  const statusConfig = {
    approved: {
      dotClass: "bg-[#1e8e3e]",
      icon: <CheckIcon className="w-3.5 h-3.5 text-white" />,
      lineClass: isDarkMode ? "bg-[#1e8e3e]/30" : "bg-[#1e8e3e]",
      titleClass: isDarkMode ? "text-[#e8eaed]" : "text-[#202124]",
      subtitleClass: isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]",
      badgeClass: isDarkMode ? "bg-[#1e8e3e]/20 text-[#81c995]" : "bg-[#e6f4ea] text-[#0d652d]",
      badgeText: "APPROVED",
      boxClass: isDarkMode ? "border-[#1e8e3e] bg-[#1e8e3e]/10 text-[#81c995]" : "border-[#1e8e3e] bg-[#e6f4ea]/30 text-[#1e8e3e]",
    },
    rejected: {
      dotClass: "bg-[#d93025]",
      icon: <XMarkIcon className="w-3.5 h-3.5 text-white" />,
      lineClass: isDarkMode ? "bg-[#d93025]/30" : "bg-[#d93025]",
      titleClass: isDarkMode ? "text-[#e8eaed]" : "text-[#202124]",
      subtitleClass: isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]",
      badgeClass: isDarkMode ? "bg-[#d93025]/20 text-[#f28b82]" : "bg-[#fce8e6] text-[#b31412]",
      badgeText: "REJECTED",
      boxClass: isDarkMode ? "border-[#d93025] bg-[#d93025]/10 text-[#f28b82]" : "border-[#fce8e6] bg-[#fce8e6]/30 text-[#d93025]",
    },
    pending: {
      dotClass: isDarkMode ? "bg-[#34a853] ring-[3px] ring-[#34a853]/20" : "bg-[#2e8e45] ring-[3px] ring-[#e6f4ea]",
      icon: <ClockIcon className="w-[13px] h-[13px] text-white" />,
      lineClass: isDarkMode ? "bg-[#5f6368]" : "bg-[#e8eaed]",
      titleClass: isDarkMode ? "text-[#e8eaed]" : "text-[#202124]",
      subtitleClass: isDarkMode ? "text-[#9aa0a6]" : "text-[#5f6368]",
      badgeClass: isDarkMode ? "bg-[#34a853]/20 text-[#81c995]" : "bg-[#e6f4ea] text-[#0d652d]",
      badgeText: "IN PROGRESS",
      boxClass: isDarkMode ? "border-[#5f6368] text-[#9aa0a6] bg-transparent" : "border-[#e8eaed] text-[#9aa0a6] bg-transparent",
    },
    locked: {
      dotClass: isDarkMode ? "bg-[#5f6368]" : "bg-[#e8eaed]",
      icon: null,
      lineClass: isDarkMode ? "bg-[#5f6368]" : "bg-[#e8eaed]",
      titleClass: isDarkMode ? "text-[#9aa0a6]" : "text-[#70757a]",
      subtitleClass: isDarkMode ? "text-[#5f6368]" : "text-[#9aa0a6]",
      badgeClass: isDarkMode ? "bg-[#202124] text-[#9aa0a6] border border-[#3c4043]" : "bg-[#f8f9fa] text-[#70757a] border border-[#f1f3f4]", // f1f3f4 to make it almost invisible except text
      badgeText: "LOCKED",
      boxClass: isDarkMode ? "border-[#3c4043] text-[#5f6368] bg-transparent" : "border-[#f1f3f4] text-[#dadce0] bg-transparent",
    }
  };

  const config = statusConfig[stage.status] || statusConfig.pending;

  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative flex gap-4 sm:gap-6"
    >
      <div className="flex flex-col items-center flex-shrink-0 w-8 pt-[18px] relative z-10">
        <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center z-10 transition-all duration-300 ${config.dotClass} ${stage.status === 'locked' ? 'scale-[0.5]' : 'shadow-sm'}`}>
          {config.icon}
        </div>
        {!isLast && (
          <div className={`absolute top-[40px] bottom-[-18px] w-[2px] transition-colors duration-300 ${config.lineClass}`} />
        )}
      </div>

      <div className={`flex-1 flex flex-col justify-center ${isLast ? "pb-0" : "pb-6"}`}>
        <div 
          onClick={stage.status !== 'locked' ? onToggle : undefined}
          className={`group rounded-[16px] p-2 sm:p-2.5 transition-all duration-200 ${stage.status !== 'locked' ? 'cursor-pointer' : ''} ${isDarkMode ? 'hover:bg-[#3c4043]/30' : 'hover:bg-slate-50'} ${isExpanded && stage.status !== 'locked' ? (isDarkMode ? 'bg-[#3c4043]/30' : 'bg-slate-50') : 'bg-transparent'}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex items-center gap-5">
              <div className={`w-[48px] h-[48px] rounded-[14px] flex items-center justify-center border transition-colors overflow-hidden ${stage.avatarUrl ? '' : config.boxClass}`}>
                {stage.avatarUrl ? (
                  <img src={stage.avatarUrl} alt={stage.title} className="w-full h-full object-cover" />
                ) : stage.title ? (
                  <span className={`text-lg font-bold ${stage.status === 'locked' ? (isDarkMode ? 'text-[#5f6368]' : 'text-[#dadce0]') : (isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]')}`}>
                    {stage.title.charAt(0)}
                  </span>
                ) : (
                  stage.iconComponent
                )}
              </div>
              
              <div className="flex flex-col justify-center">
                <h4 className={`font-bold text-[15px] tracking-tight transition-colors ${config.titleClass}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                  {stage.title}
                </h4>
                <p className={`text-[13px] mt-0.5 transition-colors ${config.subtitleClass}`}>
                  {stage.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto ml-[68px] sm:ml-0 px-2 sm:px-0">
              <span className={`px-4 py-[5px] rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${config.badgeClass}`} style={{ fontFamily: 'Google Sans, sans-serif', letterSpacing: '0.04em' }}>
                {config.badgeText}
              </span>
              <UnresolvedBadge count={unresolvedCount} />
              {stage.status === "rejected" && onRequestReevaluation && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestReevaluation(stage);
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${isDarkMode ? "bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20" : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"}`}
                  title="Request re-evaluation"
                >
                  Re-evaluate
                </button>
              )}
              {hasComments && !stage.hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewComments();
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? "bg-orange-500/10 hover:bg-orange-500/20 text-orange-400" : "bg-orange-50 hover:bg-orange-100 text-orange-600"}`}
                  title="View comments"
                >
                  <ChatBubbleIcon className="w-4 h-4" />
                </button>
              )}
              {children && (
                <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <ChevronDownIcon className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && children && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>
                  {children}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {stage.comments && (
          <div className="pl-[68px] pr-4">
            <div className={`mt-2 px-4 py-3 rounded-xl text-[13px] font-medium leading-relaxed flex gap-3 ${isDarkMode ? 'bg-[#3c4043]/50 text-[#e8eaed] border border-[#5f6368]' : 'bg-[#f8f9fa] border border-[#e8eaed] text-[#3c4043]'}`}>
              <ChatBubbleIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#1a73e8]" />
              <div>
                <span className="font-bold block mb-0.5 text-[#1a73e8]">{stage.title}</span>
                {stage.comments}
              </div>
            </div>
          </div>
        )}
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
              {approval.professor?.full_name || "Unknown Signatory"}
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
                {target.type === "signatory"
                  ? "Signatory feedback & comments"
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

            if (target.type === "signatory" && target.approval) {
              specificComments = clearanceComments.filter(
                (c) => c.commenter_id === target.approval.professor_id,
              );

              if (target.approval.comments && target.approval.comments.trim()) {
                specificComments = [
                  {
                    id: `approval-${target.approval.id}`,
                    commenter_name:
                      target.approval.professor?.full_name || "Signatory",
                    commenter_role: "signatory",
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
                library: "librarian",
                cashier: "cashier",
                registrar: "registrar",
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
                    {target.type === "signatory"
                      ? "This signatory hasn't left any feedback"
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
                      : target.type === "signatory"
                        ? "border-purple-400"
                        : "border-blue-400"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${comment.is_resolved
                          ? "bg-green-400"
                          : target.type === "signatory"
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
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${comment.commenter_role === "signatory" ||
                              comment.commenter_role === "department_head"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                          >
                            {comment.commenter_role === "signatory"
                              ? "Signatory"
                              : comment.commenter_role === "librarian"
                                ? "Library"
                                : comment.commenter_role === "cashier"
                                  ? "Cashier"
                                  : comment.commenter_role === "registrar"
                                    ? "Registrar"
                                    : "Staff"}
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
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`mb-10 w-full relative group transition-all duration-300`}
    >
      <div className={`p-6 sm:p-7 rounded-[28px] border transition-all duration-300 ${isDarkMode ? 'bg-[#202124]/90 backdrop-blur-md border-[#3c4043] shadow-[0_8px_30px_rgba(0,0,0,0.3)]' : 'bg-white/90 backdrop-blur-md border-[#dadce0] shadow-[0_8px_30px_rgba(60,64,67,0.06)]'} overflow-hidden`}>
        {/* Subtle decorative glow */}
        <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 pointer-events-none transition-all duration-700 ${isDarkMode ? 'bg-primary-900/40 group-hover:bg-primary-900/50' : 'bg-primary-100/60 group-hover:bg-primary-100/80'}`} />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${isDarkMode ? 'bg-[#3c4043] text-primary-400' : 'bg-primary-50 text-primary-600'}`}>
                <ChartBarIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className={`text-[22px] font-normal tracking-tight ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                  Overall Progress
                </h3>
                <p className={`text-[14px] mt-0.5 ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                  You have completed <strong className={isDarkMode ? 'text-primary-400' : 'text-primary-600'}>{approved}</strong> of <strong className={isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}>{total}</strong> clearance stages
                </p>
              </div>
            </div>
            
            <div className="flex flex-col items-start sm:items-end gap-1">
              <span className={`text-[32px] font-medium leading-none tracking-tighter ${pct === 100 ? (isDarkMode ? "text-primary-400" : "text-primary-600") : (isDarkMode ? "text-[#e8eaed]" : "text-[#202124]")}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                {Math.round(pct)}%
              </span>
              <span className={`text-[12px] font-medium uppercase tracking-wider ${isDarkMode ? 'text-[#5f6368]' : 'text-[#9aa0a6]'}`}>
                {pct === 100 ? 'Completed' : 'Completion'}
              </span>
            </div>
          </div>

          <div className="relative pt-2 pb-1">
            {/* Background track */}
            <div className={`h-3 w-full rounded-full overflow-hidden ${isDarkMode ? "bg-[#303134] shadow-inner" : "bg-[#f1f3f4] shadow-inner"}`}>
              {/* Progress fill */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
                className={`h-full rounded-full relative overflow-hidden transition-colors ${isDarkMode ? "bg-primary-400 shadow-[0_0_12px_rgba(74,222,128,0.4)]" : "bg-primary-500"}`}
              >
                {/* Subtle shimmer effect */}
                {pct > 0 && pct < 100 && (
                  <motion.div
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
                  />
                )}
              </motion.div>
            </div>
            
            {/* Glowing dot tracking completion tip */}
            {pct > 0 && (
              <motion.div
                initial={{ left: 0, opacity: 0 }}
                animate={{ left: `${pct}%`, opacity: 1 }}
                transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
                className="absolute top-[2px] -translate-x-1/2 flex items-center justify-center z-10"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-md ${isDarkMode ? "bg-[#202124] border-[2.5px] border-primary-400" : "bg-white border-[2.5px] border-primary-500"}`}>
                   <div className={`w-2 h-2 rounded-full ${isDarkMode ? "bg-primary-400" : "bg-primary-500"}`}></div>
                </div>
                {/* Soft glow behind dot */}
                <div className={`absolute w-12 h-12 rounded-full blur-xl opacity-50 pointer-events-none ${isDarkMode ? "bg-primary-400" : "bg-primary-500"} -z-10`} />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
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

  // B6 FIX: Wrap in useCallback to prevent stale closures in intervals/subscriptions
  const fetchClearanceComments = useCallback(async (reqId) => {
    if (!reqId) return;
    try {
      const commentsRes = await getClearanceComments(reqId, studentId);
      if (commentsRes.success) setClearanceComments(commentsRes.comments || []);
    } catch (e) {
      console.warn("Could not fetch clearance comments:", e);
    }
  }, [studentId]);

  useEffect(() => {
    document.title = "Student Dashboard | ISU Graduation Clearance";
    fetchClearanceStatus();
  }, []);

  // B6 FIX: Replace polling with realtime subscription on clearance_comments.
  // Falls back to a single interval with proper cleanup.
  useRealtimeSubscription("clearance_comments", () => {
    const reqId = clearanceStatus?.request?.request_id || clearanceStatus?.request?.id;
    if (reqId) fetchClearanceComments(reqId);
  });

  // Live updates — student sees clearance status changes in real-time
  useRealtimeSubscription("requests", () => fetchClearanceStatus(true));
  useRealtimeSubscription("professor_approvals", () => fetchClearanceStatus(true));

  // B10 FIX: Focus trap for cancel modal — traps Tab/Shift+Tab and Escape
  const cancelModalRef = useRef(null);
  useEffect(() => {
    if (!showCancelModal) return;

    const modal = cancelModalRef.current;
    if (!modal) return;

    // Focus the first focusable element
    const focusable = modal.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])');
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

  const fetchClearanceStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await authAxios.get(
        `/graduation/status/${studentId}`,
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
      const response = await authAxios.post(`/graduation/apply`, {
        student_id: studentId,
        portion,
      });
      if (response.data.success) {
        toast.success("Graduation clearance application submitted!");
        fetchClearanceStatus();
      }
    } catch (error) {
      const msg = error.response?.data?.error || "Failed to apply for clearance";
      toast.error(msg);
      // If backend says we already have a request, re-fetch to show the actual state
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
        // Reset state immediately so the UI shows the portion selection cards
        setClearanceStatus({ success: true, hasRequest: false });
        setClearanceComments([]);
        setCommentTarget(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to cancel clearance");
    } finally {
      setCancelling(false);
    }
  };



  const toggleStage = (key) =>
    setExpandedStages((prev) => ({ ...prev, [key]: !prev[key] }));

  const openSignatoryComments = async (approval) => {
    const reqId =
      clearanceStatus?.request?.request_id || clearanceStatus?.request?.id;

    await fetchClearanceComments(reqId);
    setCommentTarget({
      type: "signatory",
      key: `signatory-${approval.id}`,
      title: approval.professor?.full_name || "Signatory",
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

  // G1 FIX: Request re-evaluation on a rejected stage
  const handleRequestReevaluation = async (stage) => {
    try {
      const reqId = clearanceStatus?.request?.request_id || clearanceStatus?.request?.id;
      const payload = { request_id: reqId, stage_type: stage.type, stage_key: stage.key };
      if (stage.type === "signatory" && stage.approval) {
        payload.approval_id = stage.approval.id;
      }
      const response = await authAxios.post("/graduation/request-reevaluation", payload);
      if (response.data.success) {
        toast.success(response.data.message || "Re-evaluation requested");
        fetchClearanceStatus();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to request re-evaluation");
    }
  };

  // B7 FIX: Memoize stages so they're computed once per render, not 3 times
  const stages = useMemo(() => {
    if (!clearanceStatus?.request) return [];
    const r = clearanceStatus.request;
    const profApprovals = clearanceStatus.professorApprovals || [];

    // B5 FIX: Use stored portion from request, don't infer from professor names
    const isUndergraduate = r.portion === "undergraduate";

    const findProf = (name) => profApprovals.find((a) => a.professor?.full_name === name);

    const buildProfNode = (approval, locked, fallbackName) => {
      const name = approval?.professor?.full_name || fallbackName || "Unknown";
      const avatarUrl = approval?.professor?.avatar_url || null;
      // If no approval record exists (signatory account not yet created), show as locked/pending
      const effectiveStatus = !approval ? (locked ? "locked" : "pending") : (locked && approval.status === "pending" ? "locked" : approval.status);
      const profCC = approval ? clearanceComments.filter((c) => c.commenter_id === approval.professor_id) : [];
      const unresolvedCount =
        profCC.filter((c) => !c.is_resolved).length +
        (approval?.comments && approval.comments.trim() && approval.status !== "approved" ? 1 : 0);
      const hasComments = profCC.length > 0 || !!(approval?.comments && approval.comments.trim());
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

    const result = [];
    let isLocked = false;
    for (const step of steps) {
      if (step.type === "prof") {
        const node = buildProfNode(findProf(step.name), isLocked, step.name);
        result.push(node);
        if (node.status !== "approved") isLocked = true;
      } else {
        const sField = { library: "library_status", cashier: "cashier_status", registrar: "registrar_status" }[step.key];
        const node = buildAdminNode(step.key, step.title, step.desc, step.icon, isLocked);
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

    const studentName = (studentInfo?.full_name || "N/A").toUpperCase();
    const studentNum = studentInfo?.student_number || "N/A";
    const courseYear = studentInfo?.course_year || "N/A";
    const portion = r.portion === "undergraduate" ? "Undergraduate" : "Graduate";
    const dateApplied = new Date(r.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const stageRows = stages.map((s, i) => {
      const status = s.status === "approved" ? "CLEARED"
        : s.status === "rejected" ? "ON HOLD"
        : s.status === "locked" ? "LOCKED"
        : "PENDING";
      const statusColor = s.status === "approved" ? "#166534"
        : s.status === "rejected" ? "#b91c1c"
        : "#6b7280";
      return `<tr>
        <td style="border:1px solid #333;padding:5px 8px;text-align:center;">${i + 1}</td>
        <td style="border:1px solid #333;padding:5px 8px;">${s.title}</td>
        <td style="border:1px solid #333;padding:5px 8px;">${s.description || (s.type === "signatory" ? "Clearance Approval" : "Admin Clearance")}</td>
        <td style="border:1px solid #333;padding:5px 8px;text-align:center;font-weight:bold;color:${statusColor};">${status}</td>
        <td style="border:1px solid #333;padding:5px 8px;font-size:9px;color:#444;">${s.comments || ""}</td>
      </tr>`;
    }).join("");

    const approvedCount = stages.filter(s => s.status === "approved").length;
    const totalCount = stages.length;

    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:0;width:794px;background:#fff;";
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
              <th style="border:1px solid #333;padding:5px 8px;text-align:left;font-weight:bold;">DESCRIPTION</th>
              <th style="border:1px solid #333;padding:5px 8px;text-align:center;width:75px;font-weight:bold;">STATUS</th>
              <th style="border:1px solid #333;padding:5px 8px;text-align:left;width:110px;font-weight:bold;">REMARKS</th>
            </tr>
          </thead>
          <tbody style="font-size:10px;">${stageRows}</tbody>
        </table>

        <!-- PROGRESS SUMMARY -->
        <div style="border:1px solid #333;padding:6px 10px;font-size:10px;margin-bottom:20px;background:#fafafa;">
          <strong>Progress: ${approvedCount} of ${totalCount} stages cleared</strong>
          &nbsp;&mdash;&nbsp;
          ${r.is_completed
            ? '<span style="color:#166534;font-weight:bold;">ALL STAGES CLEARED</span>'
            : `<span style="color:#92400e;">${totalCount - approvedCount} stage(s) remaining</span>`}
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
        <div style="text-align:center;font-size:8px;color:#888;margin-top:18px;font-style:italic;">
          This document was generated by the SmartClearance System of Isabela State University.<br/>
          This is not an official clearance certificate. For official copies, please visit the Registrar's Office.
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const img = container.querySelector("img");
    if (img && !img.complete) {
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
    }

    try {
      const canvas = await html2canvas(container.firstElementChild, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 794,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
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
      id: "status",
      label: "Clearance Status",
      icon: <ChartBarIcon className="w-5 h-5" />,
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
              <GlassCard isDark={isDarkMode} className={`p-7 sm:p-9 border-none shadow-[0_4px_12px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.02)] rounded-[28px] relative overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-[#202124]' : 'bg-white'}`}>
                {/* Decorative background element */}
                <div className={`absolute top-0 right-0 w-64 h-64 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 pointer-events-none ${isDarkMode ? 'bg-primary-900/20' : 'bg-primary-100/50'}`} style={{ transform: 'translate(30%, -30%)' }} />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8">
                  
                  {/* Left Column: Icon + Dates + Status */}
                  <div className="flex items-start md:items-center gap-5 sm:gap-6 flex-1">
                    {/* Status Icon */}
                    <div className="relative flex-shrink-0 mt-1 md:mt-0">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-300 ${isDarkMode ? 'bg-primary-900/20 text-primary-400 shadow-[#000]/20' : 'bg-gradient-to-br from-primary-50 to-primary-100/80 text-primary-600'}`}>
                        <AcademicCapIcon className="w-8 h-8 drop-shadow-sm" />
                      </div>
                      <div className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-md ${isDarkMode ? 'bg-[#202124]' : 'bg-white'}`}>
                        <div className="w-4 h-4 rounded-full bg-secondary-500 shadow-[0_0_10px_rgba(234,179,8,0.6)] animate-pulse" />
                      </div>
                    </div>

                    {/* Metadata & Status */}
                    <div className="flex flex-col gap-2.5 flex-1">
                      {/* Top row: Date & Type badges */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.05em] ${isDarkMode ? 'bg-[#3c4043]/50 text-[#e8eaed]' : 'bg-slate-100 text-slate-600'}`}>
                          <ClockIcon className="w-4 h-4 opacity-70" />
                          <span>Applied {new Date(clearanceStatus.request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}</span>
                        </div>
                        <span className={`px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.05em] shadow-sm border ${isDarkMode ? 'bg-[#3c4043] text-[#e8eaed] border-[#5f6368]' : 'bg-white text-slate-800 border-slate-200'}`}>
                          {clearanceStatus.request.portion === "undergraduate" ? "Undergraduate Portion" : "Graduate Portion"}
                        </span>
                      </div>

                      {/* Bottom row: Current Stage Info */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-0.5">
                        <h3 className={`font-normal text-[16px] ${isDarkMode ? 'text-[#9aa0a6]' : 'text-slate-600'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                          Current Stage:
                        </h3>
                        <div className={`px-4 py-1.5 rounded-full text-[15px] font-bold flex items-center gap-2.5 border transition-all ${isDarkMode ? 'bg-primary-900/10 text-primary-400 border-primary-500/30' : 'bg-white text-primary-600 border-primary-500'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
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
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[#fce8e6] text-[#c5221f] border border-[#f28b82]/30"
                          >
                            <ChatBubbleIcon className="w-4 h-4 text-[#ea4335]" />
                            {unresolvedCommentCount} Action Required
                          </motion.span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Cancel Button */}
                  <div className={`hidden md:block w-px h-16 ${isDarkMode ? 'bg-[#3c4043]' : 'bg-slate-200'}`} />
                  
                  <div className="flex-shrink-0 w-full md:w-auto">
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className={`group flex items-center justify-center gap-2 w-full md:w-auto px-6 py-2.5 rounded-full font-bold transition-all duration-300 active:scale-[0.98] text-[13px] uppercase tracking-wide disabled:opacity-50 border-2 ${isDarkMode
                        ? 'bg-transparent text-[#f28b82] border-[#f28b82]/30 hover:bg-[#f28b82]/10 hover:border-[#f28b82]/50'
                        : 'bg-white text-[#ef4444] border-slate-200 hover:border-[#ef4444] hover:bg-red-50 hover:text-[#dc2626] shadow-sm hover:shadow-md'
                        }`}
                    >
                      {cancelling ? (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <XMarkIcon className="w-4 h-4 transition-transform group-hover:rotate-90" />
                      )}
                      <span>{cancelling ? "Cancelling..." : "Cancel Application"}</span>
                    </button>
                  </div>

                </div>
              </GlassCard>

              <GlassCard isDark={isDarkMode} className="p-7 sm:p-9 border-none shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] rounded-[28px]">
                <div className="mb-8">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-[22px] font-medium tracking-tight mb-2 ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
                      Clearance Progress Tree
                    </h3>
                    {/* G9: Print clearance progress */}
                    <button
                      onClick={handlePrintClearance}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all print:hidden ${
                        isDarkMode
                          ? "bg-[#3c4043] hover:bg-[#5f6368] text-[#e8eaed]"
                          : "bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043]"
                      }`}
                      title="Print clearance progress"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Print
                    </button>
                  </div>
                  <p className={`text-[14px] leading-relaxed ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                    Track your graduation clearance step-by-step. Click any active stage to expand details and view specific requirements or signatory notes.
                  </p>
                  {/* G4: Deadline countdown */}
                  {clearanceStatus?.request?.deadline && !clearanceStatus?.request?.is_completed && (() => {
                    const daysLeft = Math.ceil((new Date(clearanceStatus.request.deadline) - new Date()) / (1000 * 60 * 60 * 24));
                    const isUrgent = daysLeft <= 7;
                    const isOverdue = daysLeft < 0;
                    return (
                      <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold ${
                        isOverdue
                          ? isDarkMode ? "bg-red-500/15 text-red-400" : "bg-red-50 text-red-700"
                          : isUrgent
                            ? isDarkMode ? "bg-yellow-500/15 text-yellow-400" : "bg-yellow-50 text-yellow-700"
                            : isDarkMode ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-700"
                      }`}>
                        <ClockIcon className="w-3.5 h-3.5" />
                        {isOverdue ? `Overdue by ${Math.abs(daysLeft)} days` : `${daysLeft} days remaining`}
                      </div>
                    );
                  })()}
                </div>
                <div className="mb-6">
                  <ProgressBar stages={stages} isDarkMode={isDarkMode} />
                </div>
                <div className="mt-6 flex flex-col">
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
                        if (stage.type === "signatory" && stage.approval) {
                          openSignatoryComments(stage.approval);
                        } else {
                          openStageComments(stage);
                        }
                      }}
                      onRequestReevaluation={handleRequestReevaluation}
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </div>
              </GlassCard>
            </>
          )}
        </div>
      )}

      {activeView === "history" && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mb-2">
            <h2 className={`text-[28px] font-normal tracking-tight ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`} style={{ fontFamily: 'Google Sans, sans-serif' }}>
              Request History
            </h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
              View your past clearance requests and their outcomes
            </p>
          </div>
          <StudentRequestHistory studentId={studentId} isDarkMode={isDarkMode} />
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
          <div ref={cancelModalRef} className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
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
                <h3 id="cancel-modal-title" className={`text-[24px] font-medium mb-3 leading-tight tracking-[-0.015em] ${isDarkMode ? "text-[#e8eaed]" : "text-[#202124]"
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
