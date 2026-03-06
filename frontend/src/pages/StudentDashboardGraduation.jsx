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
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-orange-50 text-orange-700 border-orange-200 shadow-sm"
    >
      <motion.span
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="w-1.5 h-1.5 rounded-full bg-orange-500"
      />
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
}) => {
  const isLast = index === total - 1;
  const statusConfig = {
    approved: {
      gradient: "from-emerald-400 to-green-500",
      ring: "ring-emerald-400/30",
      bg: "bg-emerald-50",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: <CheckIcon className="w-5 h-5 text-white" />,
      label: "Approved",
    },
    rejected: {
      gradient: "from-red-400 to-rose-500",
      ring: "ring-red-400/30",
      bg: "bg-red-50",
      badge: "bg-red-50 text-red-700 border-red-200",
      icon: <XMarkIcon className="w-5 h-5 text-white" />,
      label: "Rejected",
    },
    pending: {
      gradient: "from-amber-400 to-orange-500",
      ring: "ring-amber-400/30",
      bg: "bg-amber-50",
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      icon: <ClockIcon className="w-4.5 h-4.5 text-white" />,
      label: "Pending",
    },
  };

  const config = statusConfig[stage.status] || statusConfig.pending;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        delay: index * 0.1,
        type: "spring",
        stiffness: 200,
        damping: 25,
      }}
      className="relative"
    >
      <div className="flex items-start gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
          <motion.div
            whileHover={{ scale: 1.1 }}
            className={`relative w-11 h-11 rounded-full bg-gradient-to-br ${config.gradient} ring-4 ${config.ring} flex items-center justify-center shadow-lg z-10 cursor-pointer`}
            onClick={onToggle}
          >
            {config.icon}
            {stage.status === "pending" && (
              <div
                className={`absolute inset-0 rounded-full bg-gradient-to-br ${config.gradient} animate-ping opacity-20`}
              />
            )}
          </motion.div>
          {!isLast && (
            <div
              className={`w-0.5 flex-1 min-h-[60px] ${
                stage.status === "approved"
                  ? "bg-gradient-to-b from-emerald-400 to-emerald-400/30"
                  : "bg-gray-200"
              }`}
            />
          )}
        </div>

        <div className={`flex-1 ${isLast ? "pb-0" : "pb-6"}`}>
          <div
            className={`rounded-xl p-4 transition-all duration-300 cursor-pointer ${config.bg} ${
              isExpanded ? "ring-1 ring-green-200/50" : ""
            }`}
            onClick={onToggle}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient} bg-opacity-20 flex items-center justify-center`}
                >
                  {stage.iconComponent}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">
                    {stage.title}
                  </h4>
                  <p className="text-xs mt-0.5 text-gray-500">
                    {stage.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${config.badge}`}
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
              className="mt-2 px-4 py-2.5 rounded-lg text-xs bg-gray-50 text-gray-600"
            >
              <span className="font-semibold">Note:</span> {stage.comments}
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
}) => {
  const statusColors = {
    approved: {
      dot: "bg-emerald-500",
      badge: "bg-emerald-50 text-emerald-700",
    },
    rejected: { dot: "bg-red-500", badge: "bg-red-50 text-red-700" },
    pending: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
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
      className="group flex items-center justify-between p-3 rounded-xl transition-all duration-200 hover:bg-white/80 hover:shadow-md hover:shadow-green-500/5 cursor-pointer border border-transparent hover:border-green-100"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-px bg-gray-300 group-hover:bg-green-300 transition-colors" />
          <div
            className={`w-3 h-3 rounded-full ${colors.dot} shadow-sm ring-2 ring-offset-1 ring-offset-white ring-gray-200 ${approval.status === "pending" ? "animate-pulse" : ""}`}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-gray-800 group-hover:text-gray-900 transition-colors">
              {approval.professor?.full_name || "Unknown Professor"}
            </p>
            <CommentIndicator hasComment={hasComment} />
          </div>
          {hasComment && (
            <p className="text-xs mt-0.5 text-gray-400 italic truncate max-w-[250px]">
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
          className="text-green-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500">
          Overall Progress
        </span>
        <span className="text-xs font-bold text-emerald-600">
          {approved}/{total} stages complete
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-gray-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-600 shadow-sm shadow-emerald-500/30"
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
  _isDarkMode = false,
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
    const approvalCount = clearanceStatus.professorApprovals?.length || 0;
    const approvedCount =
      clearanceStatus.professorApprovals?.filter((a) => a.status === "approved")
        .length || 0;

    const professorApprovalCommentCount =
      clearanceStatus.professorApprovals?.filter(
        (a) => a.comments && a.comments.trim(),
      ).length || 0;
    const professorIds = (clearanceStatus.professorApprovals || []).map(
      (a) => a.professor_id,
    );
    const professorClearanceComments = clearanceComments.filter((c) =>
      professorIds.includes(c.commenter_id),
    );
    const professorUnresolvedClearanceCount = professorClearanceComments.filter(
      (c) => !c.is_resolved,
    ).length;
    const totalProfessorCommentCount =
      professorApprovalCommentCount + professorClearanceComments.length;
    const totalProfessorUnresolvedCount =
      professorApprovalCommentCount + professorUnresolvedClearanceCount;

    return [
      {
        key: "professors",
        title: "Professors Approval",
        description: `${approvedCount} of ${approvalCount} professors approved`,
        iconComponent: <UsersIcon className="w-4 h-4 text-white" />,
        status: r.professors_status || "pending",
        comments: null,
        hasChildren: true,
        hasComments: totalProfessorCommentCount > 0,
        unresolvedCount: totalProfessorUnresolvedCount,
      },
      {
        key: "library",
        title: "Library Clearance",
        description: "Check for unsettled books and obligations",
        iconComponent: <BookOpenIcon className="w-4 h-4 text-white" />,
        status: r.library_status || "pending",
        comments: r.library_comments,
        hasComments: !!(r.library_comments && r.library_comments.trim()),
        unresolvedCount: r.library_comments ? 1 : 0,
      },
      {
        key: "cashier",
        title: "Cashier Clearance",
        description: "Verify financial obligations",
        iconComponent: <BanknotesIcon className="w-4 h-4 text-white" />,
        status: r.cashier_status || "pending",
        comments: r.cashier_comments,
        hasComments: !!(r.cashier_comments && r.cashier_comments.trim()),
        unresolvedCount: r.cashier_comments ? 1 : 0,
      },
      {
        key: "registrar",
        title: "Registrar Final Approval",
        description: "Final validation and certificate generation",
        iconComponent: <BuildingLibraryIcon className="w-4 h-4 text-white" />,
        status: r.registrar_status || "pending",
        comments: r.registrar_comments,
        hasComments: !!(r.registrar_comments && r.registrar_comments.trim()),
        unresolvedCount: r.registrar_comments ? 1 : 0,
      },
    ];
  };

  const unresolvedCommentCount = clearanceStatus?.unresolvedCommentCount || 0;

  const theme = {
    name: "ISU Clearance",
    abbrev: "SC",
    dashboardTitle: "Student Dashboard",
    sidebarGradient:
      "bg-gradient-to-b from-green-600 to-emerald-700 border-r border-green-500/20",
    sidebarActive: "bg-white text-green-700 shadow-green-900/20",
    accentGradient: "bg-gradient-to-br from-green-500 to-emerald-600",
    accentShadow: "shadow-green-500/20",
    dotColor: "bg-green-300",
    bg: "bg-gradient-to-br from-green-50 via-emerald-50/30 to-white",
    glow1: "bg-green-400/10",
    glow2: "bg-emerald-400/5",
    topbar: "bg-white/80 border-b border-green-100",
    topbarText: "text-gray-900",
    topbarSub: "text-gray-500",
    topbarBtn: "hover:bg-green-50",
    topbarIcon: "text-gray-500",
    topbarDivider: "bg-gray-200",
    logoutBtn:
      "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white",
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
          <div>
            <h2 className="text-3xl font-bold mb-1 text-gray-900">
              Graduation Clearance
            </h2>
            <p className="text-gray-500">
              Track your graduation clearance progress
            </p>
          </div>

          {loading ? (
            <GlassCard className="p-8">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500">
                  Loading clearance status...
                </p>
              </div>
            </GlassCard>
          ) : !clearanceStatus?.hasRequest ? (
            <GlassCard className="p-8">
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center mx-auto mb-5"
                >
                  <AcademicCapIcon className="w-10 h-10 text-green-600" />
                </motion.div>
                <h3 className="text-2xl font-bold mb-2 text-gray-900">
                  Apply for Graduation Clearance
                </h3>
                <p className="mb-8 max-w-md mx-auto text-gray-500">
                  Start your graduation clearance process. All professors and
                  offices must approve before you can graduate.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleApply}
                  disabled={applying}
                  className="px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-green-500/25 disabled:opacity-50 transition-all duration-200"
                >
                  {applying
                    ? "Submitting..."
                    : "Apply for Graduation Clearance"}
                </motion.button>
              </div>
            </GlassCard>
          ) : (
            <>
              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                      <AcademicCapIcon className="w-7 h-7 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-gray-500">
                        Applied on{" "}
                        {new Date(
                          clearanceStatus.request.created_at,
                        ).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900">
                          Current Stage:
                        </h3>
                        <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full text-xs font-bold shadow-sm">
                          {clearanceStatus.request.current_stage}
                        </span>
                        {unresolvedCommentCount > 0 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200 shadow-sm"
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
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white font-medium transition-all duration-200 text-sm disabled:opacity-50"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    {cancelling ? "Cancelling..." : "Cancel"}
                  </motion.button>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h3 className="text-lg font-bold mb-1 text-gray-900">
                  Clearance Progress Tree
                </h3>
                <p className="text-xs mb-4 text-gray-500">
                  Click on each stage to expand details · Click a professor row
                  to view comments
                </p>
                <ProgressBar stages={buildStages()} />
                <div className="mt-2">
                  {buildStages().map((stage, i) => (
                    <StageNode
                      key={stage.key}
                      stage={stage}
                      index={i}
                      total={buildStages().length}
                      isExpanded={!!expandedStages[stage.key]}
                      onToggle={() =>
                        stage.hasChildren && toggleStage(stage.key)
                      }
                      unresolvedCount={stage.unresolvedCount || 0}
                      hasComments={stage.hasComments}
                      onViewComments={() => openStageComments(stage)}
                    >
                      {stage.key === "professors" &&
                        clearanceStatus.professorApprovals?.length > 0 && (
                          <div className="space-y-1">
                            {clearanceStatus.professorApprovals.map(
                              (approval, j) => (
                                <ProfessorCard
                                  key={approval.id}
                                  approval={approval}
                                  index={j}
                                  onViewComments={openProfessorComments}
                                  clearanceComments={clearanceComments}
                                />
                              ),
                            )}
                          </div>
                        )}
                    </StageNode>
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
